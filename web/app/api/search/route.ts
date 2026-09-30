import { NextRequest, NextResponse } from "next/server";
import { searchScenes } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = body.query;
    const topK = body.top_k || 5;

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Field 'query' string is required in request body" },
        { status: 400 }
      );
    }

    const outcome = searchScenes(query, topK);

    if (!outcome.supported) {
      return NextResponse.json({
        mode: "controlled-benchmark",
        supported: false,
        query,
        message: outcome.message || "This query is not available in Controlled Benchmark Mode. Please use one of the supported benchmark queries.",
        results: [],
        total_matches: 0,
        latency_ms: outcome.latencyMs,
        supported_benchmark_queries: [
          "urban expansion and new construction near river",
          "water reservoir shoreline drying and lake shrinkage",
          "forest road clearing corridor and tree removal",
          "coastal port reclamation and ocean harbor pier",
          "solar panel farm photovoltaic arrays in desert terrain",
        ],
      });
    }

    return NextResponse.json({
      mode: "controlled-benchmark",
      supported: true,
      query,
      top_k: topK,
      total_matches: outcome.results.length,
      latency_ms: outcome.latencyMs,
      retrieval_mode: "Exact 512-dim Normalized Cosine Similarity (IndexFlatIP baseline)",
      results: outcome.results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Search failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
