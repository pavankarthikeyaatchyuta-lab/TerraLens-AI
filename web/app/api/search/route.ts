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

    const { results, latencyMs } = searchScenes(query, topK);

    return NextResponse.json({
      query,
      top_k: topK,
      total_matches: results.length,
      latency_ms: latencyMs,
      retrieval_mode: "Exact 512-dim Normalized Cosine Similarity (IndexFlatIP baseline)",
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Search failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
