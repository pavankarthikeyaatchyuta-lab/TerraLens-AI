/**
 * Copernicus Sentinel-2 L2A Public STAC Data Provider.
 * 
 * Interacts with open-access public STAC APIs:
 * - Primary: Microsoft Planetary Computer STAC (Sentinel-2 L2A)
 * - Fallback: AWS Earth Search by Element 84 (Sentinel-2 L2A)
 * 
 * SERVER-SIDE ONLY: Consumes 100% public, unclassified Earth Observation metadata.
 * Does not expose external credentials or endpoints to browser clients.
 */

import {
  SatelliteDataProvider,
  SatelliteSearchQuery,
  SatelliteScene,
  SatelliteAsset,
  TemporalConstraints,
  TemporalPairCandidate,
  validateSearchQuery,
} from "./satelliteProvider";
import { BoundingBox } from "@/types";

export interface CopernicusProviderOptions {
  timeoutMs?: number;
  primaryStacUrl?: string;
  fallbackStacUrl?: string;
  fetchFn?: typeof fetch;
}

export class CopernicusSentinelProvider implements SatelliteDataProvider {
  readonly providerId = "copernicus_sentinel2_stac";
  readonly providerName = "Copernicus Sentinel-2 L2A (Public STAC)";
  readonly isLive = true;

  private readonly timeoutMs: number;
  private readonly primaryStacUrl: string;
  private readonly fallbackStacUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: CopernicusProviderOptions = {}) {
    const envTimeout = process.env.SATELLITE_PROVIDER_TIMEOUT_MS
      ? parseInt(process.env.SATELLITE_PROVIDER_TIMEOUT_MS, 10)
      : undefined;

    this.timeoutMs = options.timeoutMs || envTimeout || 8000;
    this.primaryStacUrl =
      options.primaryStacUrl || "https://planetarycomputer.microsoft.com/api/stac/v1";
    this.fallbackStacUrl =
      options.fallbackStacUrl || "https://earth-search.aws.element84.com/v1";
    this.fetchFn = options.fetchFn || fetch;
  }

  /**
   * Searches Sentinel-2 L2A scenes across primary STAC, falling back to secondary if primary fails.
   */
  async searchScenes(query: SatelliteSearchQuery): Promise<SatelliteScene[]> {
    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      throw new Error(`Invalid satellite search query: ${validation.error}`);
    }

    // 1. Attempt Primary STAC (Microsoft Planetary Computer)
    try {
      const primaryResults = await this.queryStacEndpoint(
        this.primaryStacUrl,
        "Microsoft Planetary Computer",
        query
      );
      if (primaryResults.length > 0) {
        return primaryResults;
      }
      // If primary returned empty or zero scenes for query, still return empty (no need to fallback on valid 0 results)
      return primaryResults;
    } catch (primaryError: unknown) {
      const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      console.warn(`[CopernicusSentinelProvider] Primary STAC failed (${primaryMsg}). Attempting fallback STAC...`);

      // 2. Attempt Fallback STAC (AWS Earth Search by Element 84)
      try {
        const fallbackResults = await this.queryStacEndpoint(
          this.fallbackStacUrl,
          "AWS Earth Search (Element 84)",
          query
        );
        return fallbackResults;
      } catch (fallbackError: unknown) {
        const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(
          `All Sentinel-2 STAC providers unavailable. Primary error: "${primaryMsg}". Fallback error: "${fallbackMsg}".`
        );
      }
    }
  }

  /**
   * Fetches metadata for an individual Sentinel-2 scene by ID.
   */
  async getScene(sceneId: string): Promise<SatelliteScene | null> {
    if (!sceneId || typeof sceneId !== "string") {
      throw new Error("Invalid sceneId provided.");
    }

    // Attempt primary lookup
    const primaryItemUrl = `${this.primaryStacUrl}/collections/sentinel-2-l2a/items/${encodeURIComponent(sceneId)}`;
    try {
      const item = await this.fetchWithTimeout(primaryItemUrl);
      if (item && item.id) {
        return this.parseStacItem(item, "Microsoft Planetary Computer");
      }
    } catch {
      // Fall through to fallback
    }

    // Attempt fallback lookup
    const fallbackItemUrl = `${this.fallbackStacUrl}/collections/sentinel-2-l2a/items/${encodeURIComponent(sceneId)}`;
    try {
      const item = await this.fetchWithTimeout(fallbackItemUrl);
      if (item && item.id) {
        return this.parseStacItem(item, "AWS Earth Search (Element 84)");
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Retrieves thumbnail/preview URL for a given scene.
   */
  getThumbnailUrl(sceneId: string): string | null {
    if (!sceneId) return null;
    // Standard Planetary Computer preview format for Sentinel-2
    return `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item=${encodeURIComponent(
      sceneId
    )}&assets=visual&asset_bidx=visual%7C1,2,3&nodata=0&format=png&width=512&height=512`;
  }

  /**
   * Discovers suitable before/after temporal pairs for change analysis.
   */
  async getTemporalPairs(
    aoi: BoundingBox,
    constraints?: TemporalConstraints
  ): Promise<TemporalPairCandidate[]> {
    const minDays = constraints?.minDaysDifference ?? 14;
    const maxDays = constraints?.maxDaysDifference ?? 730;
    const maxCloud = constraints?.maxCloudCover ?? 25;

    // Search scenes over last 24 months
    const now = new Date();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(now.getFullYear() - 2);

    const scenes = await this.searchScenes({
      aoi,
      startDate: twoYearsAgo.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
      maxCloudCover: maxCloud,
      limit: 30,
    });

    if (scenes.length < 2) {
      return [];
    }

    // Sort chronologically ascending
    const sorted = [...scenes].sort(
      (a, b) => new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime()
    );

    const candidates: TemporalPairCandidate[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const before = sorted[i];
        const after = sorted[j];

        const tBefore = new Date(before.acquisitionDate).getTime();
        const tAfter = new Date(after.acquisitionDate).getTime();
        const diffDays = Math.round((tAfter - tBefore) / (1000 * 60 * 60 * 24));

        if (diffDays >= minDays && diffDays <= maxDays) {
          // Calculate composite quality: low cloud coverage on both scenes gives higher score
          const avgCloud = (before.cloudCoverPercentage + after.cloudCoverPercentage) / 2.0;
          const qualityScore = Math.max(0.1, 1.0 - avgCloud / 100.0);

          candidates.push({
            beforeScene: before,
            afterScene: after,
            daysDifference: diffDays,
            recommended: false,
            qualityScore: parseFloat(qualityScore.toFixed(3)),
          });
        }
      }
    }

    if (candidates.length > 0) {
      // Sort candidates by highest quality score and designate top as recommended
      candidates.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
      candidates[0].recommended = true;
    }

    return candidates;
  }

  /**
   * Retrieves raw STAC asset metadata dictionary.
   */
  async getMetadata(sceneId: string): Promise<Record<string, unknown>> {
    const scene = await this.getScene(sceneId);
    if (!scene) {
      throw new Error(`Scene "${sceneId}" not found in STAC archives.`);
    }
    return {
      scene_id: scene.sceneId,
      platform: scene.platform,
      instrument: scene.instrument,
      acquisition_date: scene.acquisitionDate,
      cloud_cover_percentage: scene.cloudCoverPercentage,
      mgrs_tile: scene.mgrsTile,
      bbox: scene.bbox,
      collection: scene.collection,
      source_provider: scene.sourceProvider,
      assets: scene.assetsSummary,
      extra_properties: scene.extraProperties,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal STAC Query & HTTP Engine
  // ---------------------------------------------------------------------------

  private async queryStacEndpoint(
    baseUrl: string,
    providerLabel: string,
    query: SatelliteSearchQuery
  ): Promise<SatelliteScene[]> {
    const { aoi, startDate, endDate, maxCloudCover, limit = 10 } = query;

    // Standard STAC BBOX format: [min_lon, min_lat, max_lon, max_lat]
    const bboxParam = `${aoi.min_lon},${aoi.min_lat},${aoi.max_lon},${aoi.max_lat}`;
    const datetimeParam = `${startDate}T00:00:00Z/${endDate}T23:59:59Z`;

    const searchUrl = new URL(`${baseUrl}/search`);
    searchUrl.searchParams.set("collections", "sentinel-2-l2a");
    searchUrl.searchParams.set("bbox", bboxParam);
    searchUrl.searchParams.set("datetime", datetimeParam);
    searchUrl.searchParams.set("limit", String(Math.min(limit, 50)));

    const rawData = await this.fetchWithTimeout(searchUrl.toString());

    if (!rawData || !Array.isArray(rawData.features)) {
      return [];
    }

    let scenes = rawData.features.map((feature: any) =>
      this.parseStacItem(feature, providerLabel)
    );

    // Apply client-side cloud cover filter if provided and not handled by backend
    if (maxCloudCover !== undefined) {
      scenes = scenes.filter((s: SatelliteScene) => s.cloudCoverPercentage <= maxCloudCover);
    }

    return scenes;
  }

  private async fetchWithTimeout(url: string): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchFn(url, {
        method: "GET",
        headers: {
          Accept: "application/geo+json, application/json",
          "User-Agent": "TerraLens-AI-EarthObservation-Adapter/1.0",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`Request timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseStacItem(item: any, providerLabel: string): SatelliteScene {
    const props = item.properties || {};
    const assets = item.assets || {};

    // Standardize cloud cover into [0.0, 100.0] %
    let cloudCover = 0.0;
    if (typeof props["eo:cloud_cover"] === "number") {
      cloudCover = props["eo:cloud_cover"];
      // If representation is fractional [0.0 - 1.0], scale up to percentage
      if (cloudCover <= 1.0 && cloudCover > 0.0) {
        cloudCover = cloudCover * 100.0;
      }
    } else if (typeof props["cloud_cover"] === "number") {
      cloudCover = props["cloud_cover"];
    }

    // Determine preview and thumbnail asset URLs
    let thumbnailUrl: string | undefined;
    let previewUrl: string | undefined;

    if (assets["rendered_preview"]?.href) {
      thumbnailUrl = assets["rendered_preview"].href;
      previewUrl = assets["rendered_preview"].href;
    } else if (assets["thumbnail"]?.href) {
      thumbnailUrl = assets["thumbnail"].href;
    } else if (assets["preview"]?.href) {
      previewUrl = assets["preview"].href;
    }

    // Fallback thumbnail using Planetary Computer tile server if sceneId is present
    if (!thumbnailUrl && item.id) {
      thumbnailUrl = `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item=${encodeURIComponent(
        item.id
      )}&assets=visual&asset_bidx=visual%7C1,2,3&nodata=0&format=png&width=512&height=512`;
    }

    // Normalize assets summary
    const assetsSummary: Record<string, SatelliteAsset> = {};
    for (const [key, asset] of Object.entries<any>(assets)) {
      if (asset && asset.href) {
        assetsSummary[key] = {
          href: asset.href,
          type: asset.type,
          title: asset.title,
          roles: asset.roles,
        };
      }
    }

    const platformRaw = props.platform || props["constellation"] || "Sentinel-2";
    const platform = platformRaw.toLowerCase().includes("sentinel-2b")
      ? "Sentinel-2B"
      : platformRaw.toLowerCase().includes("sentinel-2a")
      ? "Sentinel-2A"
      : platformRaw;

    const instrument = Array.isArray(props.instruments)
      ? props.instruments[0].toUpperCase()
      : (props.instrument || "MSI").toUpperCase();

    const bbox: [number, number, number, number] = Array.isArray(item.bbox) && item.bbox.length === 4
      ? [item.bbox[0], item.bbox[1], item.bbox[2], item.bbox[3]]
      : [0, 0, 0, 0];

    return {
      sceneId: item.id,
      platform,
      instrument,
      acquisitionDate: props.datetime || new Date().toISOString(),
      cloudCoverPercentage: parseFloat(cloudCover.toFixed(2)),
      mgrsTile: props["s2:mgrs_tile"] || undefined,
      bbox,
      geometry: item.geometry,
      collection: item.collection || "sentinel-2-l2a",
      sourceProvider: providerLabel,
      thumbnailUrl,
      previewUrl,
      assetsSummary,
      extraProperties: {
        orbit_state: props["sat:orbit_state"],
        relative_orbit: props["sat:relative_orbit"],
        processing_baseline: props["s2:processing_baseline"],
        datatake_id: props["s2:datatake_id"],
      },
    };
  }
}
