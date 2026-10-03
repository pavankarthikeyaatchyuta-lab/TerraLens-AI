import { NextRequest, NextResponse } from "next/server";
import { searchScenes } from "@/lib/data";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import util from "util";

const execFileAsync = util.promisify(execFile);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query;
    const topK = body.top_k || 5;
    const clientVector = body.vector;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Field 'query' string is required in request body" },
        { status: 400 }
      );
    }

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

      const outcome = searchScenes(query, topK, clientVector, "client-onnx-clip");
      return NextResponse.json({
        mode: "arbitrary-semantic-clip",
        supported: true,
        query,
        top_k: topK,
        total_matches: outcome.results.length,
        latency_ms: outcome.latencyMs,
        retrieval_mode: "Client Packaged ONNX/WASM CLIP Text Encoder (IndexFlatIP-equivalent Cosine Similarity)",
        results: outcome.results,
      });
    }

    // 2. Precomputed Benchmark Query Check
    const benchmarkOutcome = searchScenes(query, topK);
    if (benchmarkOutcome.supported) {
      return NextResponse.json({
        mode: "controlled-benchmark",
        supported: true,
        query,
        top_k: topK,
        total_matches: benchmarkOutcome.results.length,
        latency_ms: benchmarkOutcome.latencyMs,
        retrieval_mode: "Exact 512-dim Normalized Cosine Similarity (IndexFlatIP baseline)",
        results: benchmarkOutcome.results,
      });
    }

    // 3. Fallback Tier: Server-side Local Python/ONNX CLIP encoder
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

    if (scriptPath) {
      try {
        const { stdout } = await execFileAsync("python", [scriptPath, query], { timeout: 15000 });
        const parsed = JSON.parse(stdout);
        if (parsed.vector && Array.isArray(parsed.vector) && parsed.vector.length === 512) {
          const fallbackOutcome = searchScenes(query, topK, parsed.vector, "server-python-clip");
          return NextResponse.json({
            mode: "server-python-clip",
            supported: true,
            query,
            top_k: topK,
            total_matches: fallbackOutcome.results.length,
            latency_ms: fallbackOutcome.latencyMs,
            retrieval_mode: "Server-side Local Python/ONNX CLIP Text Encoder (IndexFlatIP-equivalent Cosine Similarity)",
            results: fallbackOutcome.results,
          });
        }
      } catch (execErr: any) {
        // Fallback error, proceed to unsupported response
      }
    }

    return NextResponse.json({
      mode: "controlled-benchmark",
      supported: false,
      query,
      message: benchmarkOutcome.message || "This query is not available in Controlled Benchmark Mode and local inference was unavailable.",
      results: [],
      total_matches: 0,
      latency_ms: benchmarkOutcome.latencyMs,
      supported_benchmark_queries: [
        "urban expansion and new construction near river",
        "water reservoir shoreline drying and lake shrinkage",
        "forest road clearing corridor and tree removal",
        "coastal port reclamation and ocean harbor pier",
        "solar panel farm photovoltaic arrays in desert terrain",
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Search failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
