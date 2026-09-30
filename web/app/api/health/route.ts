import { NextResponse } from "next/server";
import { getLocations, getSceneEmbeddings } from "@/lib/data";

export async function GET() {
  const locations = getLocations();
  const emb = getSceneEmbeddings();

  return NextResponse.json({
    status: "healthy",
    service: "TerraLens AI Web Architecture",
    problem_statement: "SIH26227 - Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery",
    target: "Smart India Hackathon 2026",
    version: "1.0.0",
    deployment: "Vercel Serverless Production Ready",
    catalog: {
      total_locations: locations.length,
      total_scenes: emb?.total_scenes || 0,
      embedding_dimension: emb?.dimension || 512,
      metric: emb?.metric || "cosine_similarity (IndexFlatIP)",
    },
    capabilities: [
      "Exact Cosine Vector Retrieval (512-dim)",
      "Multi-Temporal Pair Visualization",
      "Deterministic Bi-Temporal Change Detection",
      "Radiometric Illumination Normalization",
      "Morphological Spatial Noise Filtering",
      "Measurable Analytical Confidence Scoring",
      "Auditable Provenance Logging",
      "Evaluation Benchmark Metrics (Precision, Recall, IoU)",
    ],
    timestamp: new Date().toISOString(),
  });
}
