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
let cachedEoLocations: Location[] | null = null;
let cachedEmbeddings: EmbeddingsFile | null = null;
let cachedEoEmbeddings: EmbeddingsFile | null = null;
let cachedQueries: Record<string, number[]> | null = null;
let cachedAnalyses: Record<string, ChangeDetectionResult> | null = null;
let cachedEvaluation: any | null = null;
let cachedEoScenes: Scene[] | null = null;

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

export function getEoLocations(): Location[] {
  if (cachedEoLocations) return cachedEoLocations;
  const filePath = path.join(getDataDir(), "eo_locations.json");
  if (!fs.existsSync(filePath)) return getLocations();
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  cachedEoLocations = parsed.locations || [];
  return cachedEoLocations!;
}

export function getLocationById(locationId: string): Location | undefined {
  const locs = getLocations();
  const found = locs.find((l) => l.location_id === locationId);
  if (found) return found;
  const eoLocs = getEoLocations();
  return eoLocs.find((l) => l.location_id === locationId);
}

export function getSceneEmbeddings(): EmbeddingsFile | null {
  if (cachedEmbeddings) return cachedEmbeddings;
  const filePath = path.join(getDataDir(), "scene_embeddings.json");
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedEmbeddings = JSON.parse(raw);
  return cachedEmbeddings;
}

export function getEoSceneEmbeddings(): EmbeddingsFile | null {
  if (cachedEoEmbeddings) return cachedEoEmbeddings;
  const filePath = path.join(getDataDir(), "eo_catalog_embeddings.json");
  if (!fs.existsSync(filePath)) return getSceneEmbeddings();
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedEoEmbeddings = JSON.parse(raw);
  return cachedEoEmbeddings;
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

export function getEoScenes(): Scene[] {
  if (cachedEoScenes) return cachedEoScenes;
  const filePath = path.join(getDataDir(), "eo_scenes.json");
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.scenes && Array.isArray(parsed.scenes)) {
        cachedEoScenes = parsed.scenes.map((s: any) => ({
          scene_id: s.scene_id,
          location_id: s.location_id,
          acquisition_date: s.acquisition_date,
          sensor: s.sensor || "Sentinel-2 MSI",
          platform: s.platform,
          cloud_percentage: s.cloud_percentage,
          tags: s.tags || [],
          image_path: s.image_path,
          vector_id: s.vector_id,
        }));
        return cachedEoScenes!;
      }
    } catch {
      // Fall through to embeddings
    }
  }
  const embFile = getEoSceneEmbeddings();
  if (!embFile) return [];
  cachedEoScenes = embFile.scenes.map((s) => ({
    scene_id: s.scene_id,
    location_id: s.location_id,
    acquisition_date: s.acquisition_date,
    sensor: s.sensor,
    platform: s.platform,
    cloud_percentage: s.cloud_percentage,
    tags: s.tags,
    image_path: s.image_path,
    vector_id: s.vector_id,
  }));
  return cachedEoScenes;
}

export function getSceneById(sceneId: string): Scene | undefined {
  const scenes = getScenes();
  const found = scenes.find((s) => s.scene_id === sceneId);
  if (found) return found;
  const eoScenes = getEoScenes();
  return eoScenes.find((s) => s.scene_id === sceneId);
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
 * If query is in the supported benchmark query set or an explicit 512d queryVector is provided,
 * exact cosine similarity is computed.
 * If neither is provided, returns an explicit unsupported notice without fabricating scores.
 */
export function searchScenes(
  query: string,
  topK: number = 5,
  queryVector?: number[] | null,
  retrievalMode?: string,
  catalogMode?: "benchmark" | "real-eo" | "auto"
): SearchOutcome {
  const start = performance.now();
  const normalizedQuery = query.toLowerCase().trim();
  const queryMap = getQueryEmbeddings();

  const isRealEo = catalogMode === "real-eo";
  const embFile = isRealEo ? (getEoSceneEmbeddings() || getSceneEmbeddings()) : getSceneEmbeddings();
  const locations = isRealEo ? getEoLocations() : getLocations();

  if (!embFile || embFile.scenes.length === 0) {
    return {
      supported: false,
      mode: isRealEo ? "real-eo-catalog" : "controlled-benchmark",
      message: "Catalog embeddings are not available.",
      results: [],
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  }

  // Exact match from provided client vector or precomputed CLIP benchmark embeddings
  let activeVector: number[] | null = null;
  let activeMode = isRealEo ? "real-eo-catalog" : "controlled-benchmark";

  if (queryVector && Array.isArray(queryVector) && queryVector.length === 512) {
    activeVector = queryVector;
    activeMode = isRealEo ? "real-eo-catalog" : (retrievalMode || "arbitrary-semantic-clip");
  } else if (queryMap[normalizedQuery]) {
    activeVector = queryMap[normalizedQuery];
    activeMode = isRealEo ? "real-eo-catalog" : "controlled-benchmark";
  }

  if (!activeVector) {
    // If not a supported precomputed query and no valid vector provided
    return {
      supported: false,
      mode: isRealEo ? "real-eo-catalog" : "controlled-benchmark",
      message: "This query is not available in Controlled Benchmark Mode and no client vector was provided. Please use arbitrary search or a supported benchmark query.",
      results: [],
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
  }

  const scored: Array<{ sceneRecord: SceneEmbeddingRecord; score: number }> = [];

  for (const sceneRec of embFile.scenes) {
    const score = cosineSimilarity(activeVector, sceneRec.vector);
    scored.push({ sceneRecord: sceneRec, score });
  }

  // Sort descending by exact cosine score
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate by canonical location_id, retaining the highest-scoring scene per location
  const seenLocations = new Set<string>();
  const uniqueLocationResults: Array<{ sceneRecord: SceneEmbeddingRecord; score: number }> = [];

  for (const item of scored) {
    if (!seenLocations.has(item.sceneRecord.location_id)) {
      seenLocations.add(item.sceneRecord.location_id);
      uniqueLocationResults.push(item);
    }
  }

  const topResults = uniqueLocationResults.slice(0, topK);
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
    mode: activeMode,
    results,
    latencyMs: latency,
  };
}
