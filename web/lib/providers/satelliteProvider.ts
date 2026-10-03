/**
 * Satellite Data Provider Abstraction Layer for TerraLens AI.
 * 
 * Supports both Live Public Data Mode (Copernicus Sentinel-2 L2A via STAC)
 * and Controlled Benchmark / Offline Research Mode with deterministic reproducibility.
 */

export type { BoundingBox } from "@/types";
import type { BoundingBox } from "@/types";

export type OperatingMode = "CONTROLLED_BENCHMARK" | "LIVE_PUBLIC_DATA" | "OFFLINE_RESEARCH" | "REAL_EO_CATALOG";

export interface SatelliteSearchQuery {
  aoi: BoundingBox;
  startDate: string; // ISO 8601 Date string (YYYY-MM-DD or full ISO)
  endDate: string;   // ISO 8601 Date string (YYYY-MM-DD or full ISO)
  maxCloudCover?: number; // 0 to 100 percentage
  limit?: number;         // 1 to 50
  collections?: string[];
}

export interface RasterBandInfo {
  name?: string;
  commonName?: string;
  description?: string;
  nodata?: number | string;
  spatialResolution?: number; // meters e.g. 10, 20, 60
  dataType?: string;
}

export interface SatelliteAsset {
  href: string;
  type?: string;
  title?: string;
  roles?: string[];
  projEpsg?: number;
  projShape?: [number, number];
  projTransform?: number[];
  rasterBands?: RasterBandInfo[];
}

/**
 * Georeferenced raster asset suitable for scientific analysis (e.g. 10m/20m COGs).
 * Explicitly distinguished from preview / thumbnail assets.
 */
export interface AnalysisAsset {
  assetKey: string;           // e.g. "B02", "B03", "B04", "B08", "visual"
  href: string;
  signedHref?: string;        // SAS-signed or direct HTTP URL
  mediaType: string;          // e.g. "image/tiff; application=geotiff; profile=cloud-optimized"
  roles: string[];            // e.g. ["data"]
  title: string;
  resolution: number;         // spatial resolution in meters (e.g. 10, 20)
  bandName?: string;
  crs: string;                // e.g. "EPSG:32644"
  shape?: [number, number];   // [height, width] e.g. [10980, 10980]
  transform?: number[];       // Affine transform [10, 0, x0, 0, -10, y0]
  isAnalysisCapable: boolean; // true for georeferenced COG bands
  isCog: boolean;
  requiresSigning: boolean;
}

export interface RasterWindow {
  colOff: number;
  rowOff: number;
  width: number;
  height: number;
  aoiBbox: [number, number, number, number];
  pixelResolution: number;
  estimatedSizeBytes: number;
  rangeHeaderSupported: boolean;
}

export interface SpatialAlignmentInfo {
  status: "ALIGNED" | "RECONCILED" | "MISMATCH";
  beforeCrs: string;
  afterCrs: string;
  crsMatch: boolean;
  targetCrs: string;
  beforeResolution: number;
  afterResolution: number;
  targetResolution: number;
  aoiIntersectionPercentage: number;
  intersectionBbox: [number, number, number, number];
  dimensionReconciliation: {
    beforeShape: [number, number];
    afterShape: [number, number];
    reconciledShape: [number, number];
    method: string;
  };
}

export interface ProvenanceRecord {
  provenanceId: string;
  timestamp: string;
  provider: string;
  collection: string;
  beforeSceneId: string;
  afterSceneId: string;
  platform: {
    before: string;
    after: string;
  };
  instrument: {
    before: string;
    after: string;
  };
  processingLevel: string;
  selectedAssets: string[];
  crs: string;
  resolutionMeters: number;
  aoi: [number, number, number, number];
  processingChain: string[];
}

export interface AnalysisPreparationResult {
  status: "READY_FOR_ANALYSIS" | "NOT_READY";
  beforeScene: SatelliteScene;
  afterScene: SatelliteScene;
  aoi: BoundingBox;
  analysisAssets: {
    before: AnalysisAsset[];
    after: AnalysisAsset[];
  };
  alignment: SpatialAlignmentInfo;
  temporalSeparationDays: number;
  provenance: ProvenanceRecord;
  issues: string[];
}

export interface SatelliteScene {
  sceneId: string;
  platform: string;               // e.g. "Sentinel-2A", "Sentinel-2B", "Sentinel-2 MSI (Synthetic)"
  instrument: string;             // e.g. "MSI"
  acquisitionDate: string;        // Full ISO 8601 timestamp
  cloudCoverPercentage: number;   // 0.0 to 100.0%
  mgrsTile?: string;              // e.g. "44QKE"
  bbox: [number, number, number, number]; // [min_lon, min_lat, max_lon, max_lat]
  geometry?: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  collection: string;             // e.g. "sentinel-2-l2a"
  sourceProvider: string;         // e.g. "Microsoft Planetary Computer", "AWS Earth Search", "Controlled Benchmark"
  thumbnailUrl?: string;          // Direct URL to true-color preview/thumbnail
  previewUrl?: string;            // Direct URL to full rendering overview
  assetsSummary?: Record<string, SatelliteAsset>;
  extraProperties?: Record<string, unknown>;
}

export interface TemporalConstraints {
  minDaysDifference?: number; // default: 14
  maxDaysDifference?: number; // default: 730
  maxCloudCover?: number;     // default: 20
}

export interface TemporalPairCandidate {
  beforeScene: SatelliteScene;
  afterScene: SatelliteScene;
  daysDifference: number;
  recommended: boolean;
  qualityScore?: number;
}

/**
 * Common strongly typed interface for all satellite data access providers.
 */
export interface SatelliteDataProvider {
  readonly providerId: string;
  readonly providerName: string;
  readonly isLive: boolean;

  searchScenes(query: SatelliteSearchQuery): Promise<SatelliteScene[]>;
  getScene(sceneId: string): Promise<SatelliteScene | null>;
  getThumbnailUrl(sceneId: string): string | null;
  getTemporalPairs(aoi: BoundingBox, constraints?: TemporalConstraints): Promise<TemporalPairCandidate[]>;
  getMetadata(sceneId: string): Promise<Record<string, unknown>>;
  getSceneAssets(sceneId: string): Promise<Record<string, SatelliteAsset>>;
  getAnalysisAssets(sceneId: string, aoi?: BoundingBox): Promise<AnalysisAsset[]>;
}

/**
 * Validates a SatelliteSearchQuery strictly and safely.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateSearchQuery(query: SatelliteSearchQuery): { valid: boolean; error?: string } {
  if (!query) {
    return { valid: false, error: "Search query object is required." };
  }

  // 1. AOI / BoundingBox Validation
  const { aoi } = query;
  if (!aoi) {
    return { valid: false, error: "Bounding box (aoi) is required." };
  }

  const { min_lat, min_lon, max_lat, max_lon } = aoi;
  if (
    typeof min_lat !== "number" ||
    typeof min_lon !== "number" ||
    typeof max_lat !== "number" ||
    typeof max_lon !== "number" ||
    isNaN(min_lat) ||
    isNaN(min_lon) ||
    isNaN(max_lat) ||
    isNaN(max_lon)
  ) {
    return { valid: false, error: "Bounding box coordinates must be finite numeric values." };
  }

  if (min_lat < -90 || min_lat > 90 || max_lat < -90 || max_lat > 90) {
    return { valid: false, error: "Latitude must be within the range [-90, 90]." };
  }

  if (min_lon < -180 || min_lon > 180 || max_lon < -180 || max_lon > 180) {
    return { valid: false, error: "Longitude must be within the range [-180, 180]." };
  }

  if (min_lat > max_lat) {
    return { valid: false, error: "min_lat cannot be greater than max_lat." };
  }

  if (min_lon > max_lon) {
    return { valid: false, error: "min_lon cannot be greater than max_lon." };
  }

  // 2. Date Range Validation
  if (!query.startDate || !query.endDate) {
    return { valid: false, error: "Both startDate and endDate are required." };
  }

  const startMs = Date.parse(query.startDate);
  const endMs = Date.parse(query.endDate);

  if (isNaN(startMs)) {
    return { valid: false, error: `Invalid startDate format: "${query.startDate}". Expected ISO-8601 date.` };
  }

  if (isNaN(endMs)) {
    return { valid: false, error: `Invalid endDate format: "${query.endDate}". Expected ISO-8601 date.` };
  }

  if (startMs > endMs) {
    return { valid: false, error: "startDate must be chronologically earlier than or equal to endDate." };
  }

  // 3. Cloud Cover Bounds Validation
  if (query.maxCloudCover !== undefined) {
    if (typeof query.maxCloudCover !== "number" || isNaN(query.maxCloudCover)) {
      return { valid: false, error: "maxCloudCover must be a numeric value." };
    }
    if (query.maxCloudCover < 0 || query.maxCloudCover > 100) {
      return { valid: false, error: "maxCloudCover must be bounded between 0 and 100 percent." };
    }
  }

  // 4. Limit Validation
  if (query.limit !== undefined) {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
      return { valid: false, error: "limit must be an integer between 1 and 100." };
    }
  }

  return { valid: true };
}

/**
 * Normalizes various bounding box representations into canonical TerraLens BoundingBox:
 * { min_lat, min_lon, max_lat, max_lon }
 */
export function normalizeBoundingBox(input: unknown): BoundingBox | null {
  if (!input) return null;

  if (Array.isArray(input) && input.length === 4) {
    const [minLon, minLat, maxLon, maxLat] = input.map(Number);
    if ([minLon, minLat, maxLon, maxLat].every((n) => typeof n === "number" && !isNaN(n))) {
      return {
        min_lat: minLat,
        min_lon: minLon,
        max_lat: maxLat,
        max_lon: maxLon,
      };
    }
    return null;
  }

  if (typeof input === "object" && input !== null) {
    const obj = input as Record<string, unknown>;

    // Handle camelCase { minLat, minLon, maxLat, maxLon }
    if (
      "minLat" in obj &&
      "minLon" in obj &&
      "maxLat" in obj &&
      "maxLon" in obj
    ) {
      const min_lat = Number(obj.minLat);
      const min_lon = Number(obj.minLon);
      const max_lat = Number(obj.maxLat);
      const max_lon = Number(obj.maxLon);
      if ([min_lat, min_lon, max_lat, max_lon].every((n) => !isNaN(n))) {
        return { min_lat, min_lon, max_lat, max_lon };
      }
    }

    // Handle snake_case { min_lat, min_lon, max_lat, max_lon }
    if (
      "min_lat" in obj &&
      "min_lon" in obj &&
      "max_lat" in obj &&
      "max_lon" in obj
    ) {
      const min_lat = Number(obj.min_lat);
      const min_lon = Number(obj.min_lon);
      const max_lat = Number(obj.max_lat);
      const max_lon = Number(obj.max_lon);
      if ([min_lat, min_lon, max_lat, max_lon].every((n) => !isNaN(n))) {
        return { min_lat, min_lon, max_lat, max_lon };
      }
    }
  }

  return null;
}

/**
 * Validates TemporalConstraints for temporal pair discovery.
 */
export function validateTemporalConstraints(
  constraints?: TemporalConstraints
): { valid: boolean; error?: string } {
  if (!constraints) return { valid: true };

  if (constraints.minDaysDifference !== undefined) {
    if (
      typeof constraints.minDaysDifference !== "number" ||
      isNaN(constraints.minDaysDifference) ||
      constraints.minDaysDifference < 0
    ) {
      return { valid: false, error: "minDaysDifference must be a non-negative number." };
    }
  }

  if (constraints.maxDaysDifference !== undefined) {
    if (
      typeof constraints.maxDaysDifference !== "number" ||
      isNaN(constraints.maxDaysDifference) ||
      constraints.maxDaysDifference < 0
    ) {
      return { valid: false, error: "maxDaysDifference must be a non-negative number." };
    }
  }

  if (
    constraints.minDaysDifference !== undefined &&
    constraints.maxDaysDifference !== undefined &&
    constraints.minDaysDifference > constraints.maxDaysDifference
  ) {
    return { valid: false, error: "minDaysDifference cannot exceed maxDaysDifference." };
  }

  if (constraints.maxCloudCover !== undefined) {
    if (
      typeof constraints.maxCloudCover !== "number" ||
      isNaN(constraints.maxCloudCover) ||
      constraints.maxCloudCover < 0 ||
      constraints.maxCloudCover > 100
    ) {
      return { valid: false, error: "maxCloudCover must be bounded between 0 and 100 percent." };
    }
  }

  return { valid: true };
}
