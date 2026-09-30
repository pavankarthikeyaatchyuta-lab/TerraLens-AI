import fs from "fs";
import path from "path";
import { Location, Scene, SearchResult, ChangeDetectionResult } from "@/types";
import { cosineSimilarity } from "./vector";

interface SceneEmbeddingRecord {
  vector_id: number;
  scene_id: string;
  location_id: string;
  acquisition_date: string;
  cloud_percentage: number;
  sensor: string;
  platform?: string;
  tags: string[];
  image_path: string;
  vector: number[];
}

interface EmbeddingsFile {
  dimension: number;
  metric: string;
  total_scenes: number;
  scenes: SceneEmbeddingRecord[];
}

let cachedLocations: Location[] | null = null;
let cachedEmbeddings: EmbeddingsFile | null = null;
let cachedQueries: Record<string, number[]> | null = null;
let cachedAnalyses: Record<string, ChangeDetectionResult> | null = null;
let cachedEvaluation: any | null = null;

function getDataDir(): string {
  // In Next.js standalone/server, process.cwd() is project root or web dir
  const candidates = [
    path.join(process.cwd(), "public", "data"),
    path.join(process.cwd(), "web", "public", "data"),
    path.join(__dirname, "..", "..", "public", "data"),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  return path.join(process.cwd(), "public", "data");
}

export function getLocations(): Location[] {
  if (cachedLocations) return cachedLocations;
  const filePath = path.join(getDataDir(), "locations.json");
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  cachedLocations = parsed.locations || [];
  return cachedLocations!;
}

export function getLocationById(locationId: string): Location | undefined {
  const locs = getLocations();
  return locs.find((l) => l.location_id === locationId);
}

export function getSceneEmbeddings(): EmbeddingsFile | null {
  if (cachedEmbeddings) return cachedEmbeddings;
  const filePath = path.join(getDataDir(), "scene_embeddings.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedEmbeddings = JSON.parse(raw);
  return cachedEmbeddings;
}

export function getQueryEmbeddings(): Record<string, number[]> {
  if (cachedQueries) return cachedQueries;
  const filePath = path.join(getDataDir(), "query_embeddings.json");
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  cachedQueries = parsed.queries || {};
  return cachedQueries!;
}

export function getChangeAnalysis(locationId: string): ChangeDetectionResult | null {
  if (!cachedAnalyses) {
    const filePath = path.join(getDataDir(), "change_analysis_cache.json");
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      cachedAnalyses = JSON.parse(raw);
    } else {
      cachedAnalyses = {};
    }
  }
  return cachedAnalyses?.[locationId] || null;
}

export function getEvaluationResults(): any {
  if (cachedEvaluation) return cachedEvaluation;
  const filePath = path.join(getDataDir(), "evaluation_results.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedEvaluation = JSON.parse(raw);
  return cachedEvaluation;
}

export function getScenes(): Scene[] {
  const embFile = getSceneEmbeddings();
  if (!embFile) return [];
  return embFile.scenes.map((s) => ({
    scene_id: s.scene_id,
    location_id: s.location_id,
    acquisition_date: s.acquisition_date,
    sensor: s.sensor,
    platform: s.platform,
    cloud_percentage: s.cloud_percentage,
    tags: s.tags,
    image_path: s.image_path.startsWith("/") ? s.image_path : "/" + s.image_path.replace("data/", ""),
    vector_id: s.vector_id,
  }));
}

export function getSceneById(sceneId: string): Scene | undefined {
  const scenes = getScenes();
  return scenes.find((s) => s.scene_id === sceneId);
}

export interface SearchOutcome {
  supported: boolean;
  mode: string;
  message?: string;
  results: SearchResult[];
  latencyMs: number;
}

/**
 * Executes semantic search over indexed scenes using exact cosine similarity
 * of precomputed 512d CLIP vectors.
 * If query is in the supported benchmark query set, exact cosine similarity is computed.
 * If not, returns an explicit unsupported notice without fabricating scores.
 */
export function searchScenes(query: string, topK: number = 5): SearchOutcome {
  const start = performance.now();
  const normalizedQuery = query.toLowerCase().trim();
  const embFile = getSceneEmbeddings();
  const queryMap = getQueryEmbeddings();
  const locations = getLocations();

  if (!embFile || embFile.scenes.length === 0) {
    return {
      supported: false,
      mode: "controlled-benchmark",
      message: "Catalog embeddings are not available.",
      results: [],
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  }

  // Exact match from precomputed CLIP benchmark embeddings
  const queryVector: number[] | null = queryMap[normalizedQuery] || null;

  if (!queryVector) {
    // If not a supported precomputed query, do NOT fabricate scores!
    return {
      supported: false,
      mode: "controlled-benchmark",
      message: "This query is not available in Controlled Benchmark Mode. Please use one of the supported benchmark queries.",
      results: [],
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  }

  const scored: Array<{ sceneRecord: SceneEmbeddingRecord; score: number }> = [];

  for (const sceneRec of embFile.scenes) {
    const score = cosineSimilarity(queryVector, sceneRec.vector);
    scored.push({ sceneRecord: sceneRec, score });
  }

  // Sort descending by exact cosine score
  scored.sort((a, b) => b.score - a.score);

  const topResults = scored.slice(0, topK);
  const latency = Math.round((performance.now() - start) * 100) / 100;

  const results: SearchResult[] = topResults.map((item, idx) => {
    const loc = locations.find((l) => l.location_id === item.sceneRecord.location_id) || {
      location_id: item.sceneRecord.location_id,
      name: item.sceneRecord.location_id,
      description: "",
      latitude: 0,
      longitude: 0,
      bounding_box: { min_lat: 0, min_lon: 0, max_lat: 0, max_lon: 0 },
      primary_sensor: item.sceneRecord.sensor,
      available_dates: [item.sceneRecord.acquisition_date],
      tags: item.sceneRecord.tags,
    };

    const imgPath = item.sceneRecord.image_path.startsWith("/")
      ? item.sceneRecord.image_path
      : "/" + item.sceneRecord.image_path.replace("data/", "");

    return {
      rank: idx + 1,
      similarity_score: Math.round(item.score * 10000) / 10000,
      scene: {
        scene_id: item.sceneRecord.scene_id,
        location_id: item.sceneRecord.location_id,
        acquisition_date: item.sceneRecord.acquisition_date,
        sensor: item.sceneRecord.sensor,
        platform: item.sceneRecord.platform,
        cloud_percentage: item.sceneRecord.cloud_percentage,
        tags: item.sceneRecord.tags,
        image_path: imgPath,
        vector_id: item.sceneRecord.vector_id,
        similarity_score: item.score,
      },
      location: loc,
    };
  });

  return {
    supported: true,
    mode: "controlled-benchmark",
    results,
    latencyMs: latency,
  };
}
