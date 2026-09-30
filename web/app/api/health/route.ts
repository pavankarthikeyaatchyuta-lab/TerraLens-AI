import { NextResponse } from "next/server";
import { getLocations, getSceneEmbeddings } from "@/lib/data";

export async function GET() {
  const locations = getLocations();
  const emb = getSceneEmbeddings();

  return NextResponse.json({
    status: "ok",
    service: "terralens-public-demo",
    mode: "controlled-benchmark",
    version: "1.0.0",
    problem_statement: "SIH26227 - Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery",
    target: "Smart India Hackathon 2026",
    catalog: {
      total_locations: locations.length,
      total_scenes: emb?.total_scenes || 10,
      embedding_dimension: emb?.dimension || 512,
      metric: emb?.metric || "cosine_similarity (IndexFlatIP)",
    },
    timestamp: new Date().toISOString(),
  });
}
