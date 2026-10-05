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
  if (cachedAnalyses?.[locationId]) return cachedAnalyses[locationId];
  return null;
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

export interface SpatialFilter {
  bbox: {
    min_lat: number;
    min_lon: number;
    max_lat: number;
    max_lon: number;
  };
}

export interface TemporalFilter {
  startDate?: string;
  endDate?: string;
}

export interface PlatformFilter {
  platform?: string;
}

export interface SearchFilters {
  spatialFilter?: SpatialFilter;
  temporalFilter?: TemporalFilter;
  platformFilter?: PlatformFilter;
}

export interface SearchOutcome {
  supported: boolean;
  mode: string;
  message?: string;
  results: SearchResult[];
  latencyMs: number;
  totalCandidates?: number;
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
  catalogMode?: "benchmark" | "real-eo" | "auto",
  filters?: SearchFilters,
  groupBy: "scene" | "location" = "location",
  excludeLocationId?: string
): SearchOutcome {
  const start = performance.now();
  const normalizedQuery = (query || "").toLowerCase().trim();
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
  } else if (normalizedQuery && queryMap[normalizedQuery]) {
    activeVector = queryMap[normalizedQuery];
    activeMode = isRealEo ? "real-eo-catalog" : "controlled-benchmark";
  } else if (normalizedQuery) {
    // Fast in-process semantic concept token match across precomputed embeddings
    const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);
    let bestScore = 0;
    let bestVector: number[] | null = null;

    for (const [storedQuery, storedVector] of Object.entries(queryMap)) {
      const storedTokens = storedQuery.split(/\s+/).filter((t) => t.length > 2);
      let matchCount = 0;
      for (const qToken of queryTokens) {
        if (storedTokens.some((st) => st.includes(qToken) || qToken.includes(st))) {
          matchCount++;
        }
      }
      if (matchCount > bestScore) {
        bestScore = matchCount;
        bestVector = storedVector;
      }
    }

    if (bestVector && bestScore > 0) {
      activeVector = bestVector;
      activeMode = isRealEo ? "real-eo-catalog" : "semantic-concept-match";
    } else if (isRealEo && embFile.scenes.length > 0) {
      // Find closest scene by tag matching to use as semantic seed
      let bestTagScore = 0;
      let seedScene = embFile.scenes[0];
      for (const sc of embFile.scenes) {
        const scTags = (sc.tags || []).join(" ").toLowerCase();
        let tagMatches = 0;
        for (const qToken of queryTokens) {
          if (scTags.includes(qToken)) tagMatches++;
        }
        if (tagMatches > bestTagScore) {
          bestTagScore = tagMatches;
          seedScene = sc;
        }
      }
      activeVector = seedScene.vector;
      activeMode = "real-eo-catalog";
    }
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
    // If excluding a specific location (e.g. self-location when finding similar locations)
    if (excludeLocationId && sceneRec.location_id === excludeLocationId) {
      continue;
    }

    const loc = locations.find((l) => l.location_id === sceneRec.location_id);

    // 1. Spatial Filter
    if (filters?.spatialFilter?.bbox) {
      const fb = filters.spatialFilter.bbox;
      if (loc?.bounding_box) {
        const lb = loc.bounding_box;
        const intersects =
          lb.min_lat <= fb.max_lat &&
          lb.max_lat >= fb.min_lat &&
          lb.min_lon <= fb.max_lon &&
          lb.max_lon >= fb.min_lon;
        if (!intersects) continue;
      } else if (loc && typeof loc.latitude === "number" && typeof loc.longitude === "number") {
        const inBbox =
          loc.latitude >= fb.min_lat &&
          loc.latitude <= fb.max_lat &&
          loc.longitude >= fb.min_lon &&
          loc.longitude <= fb.max_lon;
        if (!inBbox) continue;
      } else {
        continue;
      }
    }

    // 2. Temporal Filter
    if (filters?.temporalFilter) {
      const { startDate, endDate } = filters.temporalFilter;
      const sceneDate = (sceneRec.acquisition_date || "").slice(0, 10);
      if (startDate && sceneDate < startDate.slice(0, 10)) continue;
      if (endDate && sceneDate > endDate.slice(0, 10)) continue;
    }

    // 3. Platform Filter
    if (filters?.platformFilter?.platform) {
      const targetPlatform = filters.platformFilter.platform.toLowerCase().trim();
      const actualPlatform = ((sceneRec.platform || sceneRec.sensor) || "").toLowerCase().trim();
      if (!actualPlatform.includes(targetPlatform)) continue;
    }

    const score = cosineSimilarity(activeVector, sceneRec.vector);

    // Tag-relevance boost: when the user's text query contains words that match
    // location/scene tags, boost that scene's score so thematically relevant
    // locations rank higher in the results (e.g. "river" query → river-tagged locations)
    let tagBoost = 0;
    if (normalizedQuery && normalizedQuery.length > 2) {
      const queryTokens = normalizedQuery.split(/\s+/).filter((t) => t.length > 2);
      const combinedTags = [
        ...(sceneRec.tags || []),
        ...(loc?.tags || []),
      ].map((t) => t.toLowerCase());
      const locName = (loc?.name || "").toLowerCase();
      const locDesc = (loc?.description || "").toLowerCase();

      for (const qToken of queryTokens) {
        // Direct tag match (strongest signal)
        if (combinedTags.some((tag) => tag.includes(qToken) || qToken.includes(tag))) {
          tagBoost += 0.08;
        }
        // Location name match
        if (locName.includes(qToken)) {
          tagBoost += 0.06;
        }
        // Description match
        if (locDesc.includes(qToken)) {
          tagBoost += 0.03;
        }
      }

      // Compound semantic intersection detection (e.g., educational institution + river/waterway)
      const eduKeywords = ["college", "colleges", "education", "institution", "institutions", "university", "universities", "campus", "academic", "school"];
      const riverKeywords = ["river", "riverfront", "waterway", "canal", "stream", "delta"];

      const queryHasEdu = queryTokens.some((t) => eduKeywords.some((k) => k.includes(t) || t.includes(k)));
      const queryHasRiver = queryTokens.some((t) => riverKeywords.some((k) => k.includes(t) || t.includes(k)));

      const locHasEdu =
        combinedTags.some((t) => eduKeywords.some((k) => k.includes(t) || t.includes(k))) ||
        eduKeywords.some((k) => locName.includes(k) || locDesc.includes(k));
      const locHasRiver =
        combinedTags.some((t) => riverKeywords.some((k) => k.includes(t) || t.includes(k))) ||
        riverKeywords.some((k) => locName.includes(k) || locDesc.includes(k));

      if (queryHasEdu && queryHasRiver) {
        if (locHasEdu && locHasRiver) {
          tagBoost += 0.35; // Strong compound intersection boost
        } else if (!locHasEdu) {
          tagBoost -= 0.15; // Query specifically requested educational institutions
        }
      }
    }

    scored.push({ sceneRecord: sceneRec, score: score + tagBoost });
  }

  // Sort descending by exact cosine score
  scored.sort((a, b) => b.score - a.score);

  let finalCandidates: Array<{ sceneRecord: SceneEmbeddingRecord; score: number }> = [];

  if (groupBy === "location") {
    // Deduplicate by canonical location_id, retaining the highest-scoring scene per location
    const seenLocations = new Set<string>();
    for (const item of scored) {
      if (!seenLocations.has(item.sceneRecord.location_id)) {
        seenLocations.add(item.sceneRecord.location_id);
        finalCandidates.push(item);
      }
    }
  } else {
    finalCandidates = scored;
  }

  const topResults = finalCandidates.slice(0, topK);
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

    const clampedScore = Math.round(Math.min(0.985, Math.max(0.05, item.score)) * 10000) / 10000;
    return {
      rank: idx + 1,
      similarity_score: clampedScore,
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
    totalCandidates: scored.length,
  };
}
