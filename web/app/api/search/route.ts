import { NextRequest, NextResponse } from "next/server";
import { searchScenes, getEoSceneEmbeddings, getSceneEmbeddings, SearchFilters } from "@/lib/data";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";

const execFileAsync = util.promisify(execFile);

const BENCHMARK_QUERIES = [
  "urban expansion and new construction near river",
  "water reservoir shoreline drying and lake shrinkage",
  "forest road clearing corridor and tree removal",
  "coastal port reclamation and ocean harbor pier",
  "solar panel farm photovoltaic arrays in desert terrain",
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = typeof body.query === "string" ? body.query : "";
    const imageSceneId = typeof body.imageSceneId === "string" ? body.imageSceneId.trim() : undefined;
    const image = typeof body.image === "string" ? body.image.trim() : undefined;
    const clientVector = Array.isArray(body.vector) ? body.vector : undefined;
    const topK = typeof body.top_k === "number" ? body.top_k : 5;
    const groupBy: "scene" | "location" = body.groupBy === "scene" ? "scene" : "location";
    const catalogParam = body.catalog || (body.mode === "real-eo" || body.mode === "real_eo" ? "real-eo" : undefined);
    const spatialFilter = body.spatialFilter;
    const temporalFilter = body.temporalFilter;
    const platformFilter = body.platformFilter;
    let excludeLocationId = typeof body.excludeLocationId === "string" ? body.excludeLocationId : undefined;
    const excludeSelf = body.excludeSelf !== undefined ? Boolean(body.excludeSelf) : true;

    if (!query && !imageSceneId && !image && !clientVector) {
      return NextResponse.json(
        { error: "Provide 'query', 'imageSceneId', 'image', or 'vector' in request body" },
        { status: 400 }
      );
    }

    const isExplicitBenchmark =
      catalogParam === "benchmark" ||
      catalogParam === "controlled-benchmark" ||
      (!catalogParam && !imageSceneId && !image && query && BENCHMARK_QUERIES.includes(query.toLowerCase().trim()));

    const effectiveCatalog: "benchmark" | "real-eo" = isExplicitBenchmark ? "benchmark" : "real-eo";

    const filters: SearchFilters | undefined = (spatialFilter || temporalFilter || platformFilter)
      ? {
          spatialFilter: spatialFilter?.bbox ? spatialFilter : undefined,
          temporalFilter: (temporalFilter?.startDate || temporalFilter?.endDate) ? temporalFilter : undefined,
          platformFilter: platformFilter?.platform ? platformFilter : undefined,
        }
      : undefined;

    // 1. Primary Tier: Client-side provided ONNX/WASM CLIP vector
    if (clientVector && Array.isArray(clientVector)) {
      if (clientVector.length !== 512) {
        return NextResponse.json(
          { error: `Invalid vector dimension: expected 512, got ${clientVector.length}` },
          { status: 400 }
        );
      }
      const isValid = clientVector.every((v) => typeof v === "number" && !isNaN(v) && isFinite(v));
      if (!isValid) {
        return NextResponse.json(
          { error: "Vector contains invalid or non-finite numbers" },
          { status: 400 }
        );
      }

      const outcome = searchScenes(
        query || "client-vector-query",
        topK,
        clientVector,
        effectiveCatalog === "real-eo" ? "real-eo-catalog" : "client-onnx-clip",
        effectiveCatalog,
        filters,
        groupBy,
        excludeLocationId
      );

      return NextResponse.json({
        mode: effectiveCatalog === "real-eo" ? "real-eo-catalog" : "arbitrary-semantic-clip",
        catalog: effectiveCatalog,
        supported: true,
        queryType: "vector",
        query: query || "client-vector-query",
        top_k: topK,
        total_matches: outcome.results.length,
        latency_ms: outcome.latencyMs,
        retrieval_mode: effectiveCatalog === "real-eo"
          ? "Client Packaged ONNX/WASM CLIP Text Encoder over Real Sentinel-2 Catalog (IndexFlatIP-equivalent Cosine Similarity)"
          : "Client Packaged ONNX/WASM CLIP Text Encoder (IndexFlatIP-equivalent Cosine Similarity)",
        embedding_dimension: 512,
        similarity_metric: "cosine",
        filters_applied: filters || null,
        group_by: groupBy,
        results: outcome.results,
      });
    }

    // 2. Query by existing catalog Scene ID (Instant Precomputed Vector Lookup)
    if (imageSceneId) {
      const primaryEmb = effectiveCatalog === "real-eo" ? getEoSceneEmbeddings() : getSceneEmbeddings();
      const fallbackEmb = effectiveCatalog === "real-eo" ? getSceneEmbeddings() : getEoSceneEmbeddings();

      let matchedRecord = primaryEmb?.scenes.find((s) => s.scene_id === imageSceneId);
      if (!matchedRecord && fallbackEmb) {
        matchedRecord = fallbackEmb.scenes.find((s) => s.scene_id === imageSceneId);
      }

      if (!matchedRecord) {
        return NextResponse.json(
          { error: `Scene ID '${imageSceneId}' not found in catalog embeddings` },
          { status: 404 }
        );
      }

      if (groupBy === "location" && excludeSelf) {
        excludeLocationId = excludeLocationId || matchedRecord.location_id;
      }

      const outcome = searchScenes(
        query || imageSceneId,
        topK,
        matchedRecord.vector,
        "catalog-scene-visual",
        effectiveCatalog,
        filters,
        groupBy,
        excludeLocationId
      );

      return NextResponse.json({
        mode: effectiveCatalog === "real-eo" ? "real-eo-catalog" : "arbitrary-semantic-clip",
        catalog: effectiveCatalog,
        supported: true,
        queryType: "scene",
        query: imageSceneId,
        imageSceneId,
        top_k: topK,
        total_matches: outcome.results.length,
        latency_ms: outcome.latencyMs,
        retrieval_mode: effectiveCatalog === "real-eo"
          ? "Catalog Scene Visual Vector Match over Real Sentinel-2 Catalog (IndexFlatIP-equivalent Exact Cosine Similarity)"
          : "Catalog Scene Visual Vector Match (IndexFlatIP-equivalent Exact Cosine Similarity)",
        embedding_dimension: 512,
        similarity_metric: "cosine",
        filters_applied: filters || null,
        group_by: groupBy,
        results: outcome.results,
      });
    }

    // 3. Query by User-Uploaded Image (Base64)
    if (image) {
      const candidateImageScripts = [
        path.join(process.cwd(), "scripts", "encode_image.py"),
        path.join(process.cwd(), "..", "scripts", "encode_image.py"),
      ];
      let imageScript: string | null = null;
      for (const p of candidateImageScripts) {
        if (fs.existsSync(p)) {
          imageScript = p;
          break;
        }
      }

      if (!imageScript) {
        return NextResponse.json(
          { error: "Image encoder script not found on server" },
          { status: 500 }
        );
      }

      try {
        const { stdout } = await execFileAsync("python", [imageScript, "--base64", image], { timeout: 25000 });
        const parsed = JSON.parse(stdout);
        if (!parsed.vector || !Array.isArray(parsed.vector) || parsed.vector.length !== 512) {
          throw new Error("Invalid vector output from image encoder");
        }

        const outcome = searchScenes(
          "image_query",
          topK,
          parsed.vector,
          "image-to-image-clip",
          effectiveCatalog,
          filters,
          groupBy,
          excludeLocationId
        );

        return NextResponse.json({
          mode: effectiveCatalog === "real-eo" ? "real-eo-catalog" : "arbitrary-semantic-clip",
          catalog: effectiveCatalog,
          supported: true,
          queryType: "image",
          query: "uploaded_image",
          top_k: topK,
          total_matches: outcome.results.length,
          latency_ms: outcome.latencyMs,
          retrieval_mode: effectiveCatalog === "real-eo"
            ? "Multimodal Image-to-Image CLIP Encoder over Real Sentinel-2 Catalog (IndexFlatIP-equivalent Cosine Similarity)"
            : "Multimodal Image-to-Image CLIP Encoder (IndexFlatIP-equivalent Cosine Similarity)",
          embedding_dimension: 512,
          similarity_metric: "cosine",
          filters_applied: filters || null,
          group_by: groupBy,
          results: outcome.results,
        });
      } catch (imgErr: any) {
        return NextResponse.json(
          { error: "Failed to embed image query", details: imgErr?.message || String(imgErr) },
          { status: 500 }
        );
      }
    }

    // 4. In-Process High-Speed Exact / Semantic Concept Retrieval (< 5ms)
    const fastOutcome = searchScenes(query, topK, null, undefined, effectiveCatalog, filters, groupBy, excludeLocationId);
    if (fastOutcome.supported && fastOutcome.results.length > 0) {
      return NextResponse.json({
        mode: effectiveCatalog === "real-eo" ? "real-eo-catalog" : "semantic-concept-match",
        catalog: effectiveCatalog,
        supported: true,
        queryType: "text",
        query,
        top_k: topK,
        total_matches: fastOutcome.results.length,
        latency_ms: fastOutcome.latencyMs,
        retrieval_mode: effectiveCatalog === "real-eo"
          ? "Exact 512-dim Normalized Cosine Similarity over Real Sentinel-2 Catalog (IndexFlatIP baseline)"
          : "Exact 512-dim Normalized Cosine Similarity (IndexFlatIP baseline)",
        embedding_dimension: 512,
        similarity_metric: "cosine",
        filters_applied: filters || null,
        group_by: groupBy,
        results: fastOutcome.results,
      });
    }

    // 5. Fallback Tier: Server-side Local Python/ONNX CLIP text encoder
    const candidateScriptPaths = [
      path.join(process.cwd(), "scripts", "encode_query.py"),
      path.join(process.cwd(), "..", "scripts", "encode_query.py"),
    ];
    let scriptPath: string | null = null;
    for (const p of candidateScriptPaths) {
      if (fs.existsSync(p)) {
        scriptPath = p;
        break;
      }
    }

    if (scriptPath && query) {
      try {
        const { stdout } = await execFileAsync("python", [scriptPath, query], { timeout: 15000 });
        const parsed = JSON.parse(stdout);
        if (parsed.vector && Array.isArray(parsed.vector) && parsed.vector.length === 512) {
          const fallbackOutcome = searchScenes(
            query,
            topK,
            parsed.vector,
            "server-python-clip",
            effectiveCatalog,
            filters,
            groupBy,
            excludeLocationId
          );
          return NextResponse.json({
            mode: effectiveCatalog === "real-eo" ? "real-eo-catalog" : "server-python-clip",
            catalog: effectiveCatalog,
            supported: true,
            queryType: "text",
            query,
            top_k: topK,
            total_matches: fallbackOutcome.results.length,
            latency_ms: fallbackOutcome.latencyMs,
            retrieval_mode: effectiveCatalog === "real-eo"
              ? "Server-side Local Python/ONNX CLIP Text Encoder over Real Sentinel-2 Catalog (IndexFlatIP-equivalent Cosine Similarity)"
              : "Server-side Local Python/ONNX CLIP Text Encoder (IndexFlatIP-equivalent Cosine Similarity)",
            embedding_dimension: 512,
            similarity_metric: "cosine",
            filters_applied: filters || null,
            group_by: groupBy,
            results: fallbackOutcome.results,
          });
        }
      } catch (execErr: any) {
        // Fallback error, proceed to unsupported response
      }
    }

    // 6. Universal Semantic & Keyword Catalog Retrieval Fallback
    const catalogOutcome = searchScenes(
      query,
      topK,
      null,
      undefined,
      "real-eo",
      filters,
      groupBy,
      excludeLocationId
    );

    if (catalogOutcome.results.length > 0) {
      return NextResponse.json({
        mode: "real-eo-catalog",
        catalog: "real-eo",
        supported: true,
        queryType: "text",
        query,
        top_k: topK,
        total_matches: catalogOutcome.results.length,
        latency_ms: catalogOutcome.latencyMs,
        retrieval_mode: "Compound Semantic Concept & Geographic Token Match over Real Sentinel-2 Catalog",
        embedding_dimension: 512,
        similarity_metric: "cosine_and_lexical",
        filters_applied: filters || null,
        group_by: groupBy,
        results: catalogOutcome.results,
      });
    }

    return NextResponse.json({
      mode: "controlled-benchmark",
      supported: false,
      queryType: "text",
      query,
      message: "No matching satellite observations found for query.",
      results: [],
      total_matches: 0,
      latency_ms: 0,
      supported_benchmark_queries: BENCHMARK_QUERIES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Search failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || searchParams.get("query") || "";
  const topK = parseInt(searchParams.get("top_k") || "5", 10);
  const catalog = (searchParams.get("catalog") || "real-eo") as "benchmark" | "real-eo";
  const groupBy = (searchParams.get("groupBy") || "location") as "scene" | "location";

  if (!query) {
    return NextResponse.json({ error: "Missing 'q' or 'query' parameter" }, { status: 400 });
  }

  const outcome = searchScenes(query, topK, null, undefined, catalog, undefined, groupBy);
  return NextResponse.json({
    mode: "real-eo-catalog",
    catalog,
    supported: outcome.supported,
    queryType: "text",
    query,
    top_k: topK,
    total_matches: outcome.results.length,
    latency_ms: outcome.latencyMs,
    retrieval_mode: "Compound Semantic Concept & Geographic Token Match over Real Sentinel-2 Catalog",
    results: outcome.results,
  });
}

