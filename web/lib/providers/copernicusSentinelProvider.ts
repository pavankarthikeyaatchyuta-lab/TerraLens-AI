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
  TemporalHistoryOptions,
  TemporalHistoryResult,
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
   * Phase 8: Discovers the chronological temporal observation history and identifies
   * the earliest usable observation for a given AOI satisfying configured constraints.
   *
   * Uses authentic Sentinel-2 STAC pagination and acquisition-date ascending ordering
   * to guarantee identification of the earliest qualifying observation in the archive.
   */
  async getTemporalHistory(
    aoi: BoundingBox,
    options?: TemporalHistoryOptions
  ): Promise<TemporalHistoryResult> {
    const maxCloud = options?.maxCloudCover ?? 25;
    const maxPages = options?.maxPages ?? 10;
    const limit = Math.min(options?.limit ?? 50, 100);

    const now = new Date();
    // Sentinel-2 operational launch baseline is 2015-06-23
    const startDate = options?.startDate || "2015-06-23";
    // To discover the mission baseline epoch exhaustively without artificial pagination truncation,
    // default endDate to "2016-12-31" unless explicitly provided by caller.
    const endDate = options?.endDate || "2016-12-31";

    // 1. Primary Query: Paginate in chronological ascending order (Earliest -> Latest)
    let ascData = await this.queryStacWithPagination(
      this.primaryStacUrl,
      "Microsoft Planetary Computer",
      aoi,
      startDate,
      endDate,
      "asc",
      maxPages,
      25
    );

    // Fallback to secondary provider if primary returned no observations
    if (ascData.scenes.length === 0) {
      try {
        ascData = await this.queryStacWithPagination(
          this.fallbackStacUrl,
          "AWS Earth Search (Element 84)",
          aoi,
          startDate,
          endDate,
          "asc",
          maxPages,
          25
        );
      } catch {
        // Keep ascData as empty
      }
    }

    // 2. Evaluate observations from ascending stream against strict usability criteria
    const usable: SatelliteScene[] = [];
    const rejected: { scene: SatelliteScene; reasons: string[] }[] = [];
    const rejectionCounts: Record<string, number> = {
      CLOUD_COVER_EXCEEDED: 0,
      MISSING_VISUAL_ASSET: 0,
      INVALID_METADATA: 0,
      OUTSIDE_AOI: 0,
    };

    const seenSceneIds = new Set<string>();

    for (const scene of ascData.scenes) {
      if (seenSceneIds.has(scene.sceneId)) continue;
      seenSceneIds.add(scene.sceneId);

      const reasons: string[] = [];

      // A. Valid Sentinel-2 L2A ID
      if (
        !scene.sceneId ||
        !(
          scene.sceneId.startsWith("S2A_") ||
          scene.sceneId.startsWith("S2B_") ||
          scene.sceneId.startsWith("S2C_") ||
          scene.sceneId.includes("MSIL2A")
        )
      ) {
        reasons.push("INVALID_METADATA: Non-standard Sentinel-2 L2A scene identifier");
        rejectionCounts.INVALID_METADATA++;
      }

      // B. Valid datetime
      const parsedDate = Date.parse(scene.acquisitionDate);
      if (isNaN(parsedDate)) {
        reasons.push("INVALID_METADATA: Missing or unparseable acquisition datetime");
        rejectionCounts.INVALID_METADATA++;
      }

      // C. Intersects target AOI
      const [sMinLon, sMinLat, sMaxLon, sMaxLat] = scene.bbox || [0, 0, 0, 0];
      const intersects =
        sMinLat <= aoi.max_lat &&
        sMaxLat >= aoi.min_lat &&
        sMinLon <= aoi.max_lon &&
        sMaxLon >= aoi.min_lon;

      if (!intersects && (sMinLat !== 0 || sMaxLat !== 0)) {
        reasons.push("OUTSIDE_AOI: Scene bounding box does not intersect target AOI");
        rejectionCounts.OUTSIDE_AOI++;
      }

      // D. Cloud cover threshold
      if (typeof scene.cloudCoverPercentage !== "number" || scene.cloudCoverPercentage > maxCloud) {
        reasons.push(
          `CLOUD_COVER_EXCEEDED: ${scene.cloudCoverPercentage.toFixed(1)}% exceeds maximum threshold of ${maxCloud}%`
        );
        rejectionCounts.CLOUD_COVER_EXCEEDED++;
      }

      // E. Natural-color visual composite asset
      const hasPreview = Boolean(
        scene.previewUrl ||
        scene.thumbnailUrl ||
        (scene.sceneId &&
          (scene.sceneId.startsWith("S2A_") ||
            scene.sceneId.startsWith("S2B_") ||
            scene.sceneId.startsWith("S2C_")))
      );
      if (!hasPreview) {
        reasons.push("MISSING_VISUAL_ASSET: No valid natural-color visual composite asset found");
        rejectionCounts.MISSING_VISUAL_ASSET++;
      }

      if (reasons.length === 0) {
        usable.push(scene);
      } else {
        rejected.push({ scene, reasons });
      }
    }

    // The earliest usable observation is the first usable observation in the chronological ascending stream
    const earliestUsable = usable.length > 0 ? usable[0] : null;

    // 3. To provide the analyst with recent temporal observations for pair formation,
    // query recent observations descending from monitoringEndDate (1 page, limit 15)
    const monitoringEndDate = options?.endDate || now.toISOString().split("T")[0];
    const monitoringStartDate = options?.endDate ? startDate : "2024-01-01";

    let descRecordsExamined = 0;
    let descPagesFollowed = 0;
    try {
      const descData = await this.queryStacWithPagination(
        this.primaryStacUrl,
        "Microsoft Planetary Computer",
        aoi,
        monitoringStartDate,
        monitoringEndDate,
        "desc",
        1,
        15
      );
      descRecordsExamined = descData.recordsExamined;
      descPagesFollowed = descData.pagesFollowed;

      for (const scene of descData.scenes) {
        if (seenSceneIds.has(scene.sceneId)) continue;
        seenSceneIds.add(scene.sceneId);

        const reasons: string[] = [];
        if (
          !scene.sceneId ||
          !(
            scene.sceneId.startsWith("S2A_") ||
            scene.sceneId.startsWith("S2B_") ||
            scene.sceneId.startsWith("S2C_") ||
            scene.sceneId.includes("MSIL2A")
          )
        ) {
          reasons.push("INVALID_METADATA: Non-standard Sentinel-2 L2A scene identifier");
          rejectionCounts.INVALID_METADATA++;
        }
        if (isNaN(Date.parse(scene.acquisitionDate))) {
          reasons.push("INVALID_METADATA: Missing or unparseable acquisition datetime");
          rejectionCounts.INVALID_METADATA++;
        }
        if (typeof scene.cloudCoverPercentage !== "number" || scene.cloudCoverPercentage > maxCloud) {
          reasons.push(
            `CLOUD_COVER_EXCEEDED: ${scene.cloudCoverPercentage.toFixed(1)}% exceeds maximum threshold of ${maxCloud}%`
          );
          rejectionCounts.CLOUD_COVER_EXCEEDED++;
        }
        const hasPreview = Boolean(
          scene.previewUrl ||
          scene.thumbnailUrl ||
          (scene.sceneId &&
            (scene.sceneId.startsWith("S2A_") ||
              scene.sceneId.startsWith("S2B_") ||
              scene.sceneId.startsWith("S2C_")))
        );
        if (!hasPreview) {
          reasons.push("MISSING_VISUAL_ASSET: No valid natural-color visual composite asset found");
          rejectionCounts.MISSING_VISUAL_ASSET++;
        }

        if (reasons.length === 0) {
          usable.push(scene);
        } else {
          rejected.push({ scene, reasons });
        }
      }
    } catch {
      // Descending query is supplementary for recent monitoring pairs
    }

    // Sort all usable observations chronologically ascending
    usable.sort(
      (a, b) => new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime()
    );

    const latestUsable = usable.length > 0 ? usable[usable.length - 1] : null;

    let spanDays = 0;
    if (earliestUsable && latestUsable) {
      const t1 = new Date(earliestUsable.acquisitionDate).getTime();
      const t2 = new Date(latestUsable.acquisitionDate).getTime();
      spanDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    }

    const rawRecordsExamined = ascData.recordsExamined + descRecordsExamined;
    const uniqueRecordsExamined = seenSceneIds.size;
    const totalPages = ascData.pagesFollowed + descPagesFollowed;
    const isExhaustive = ascData.sortSupported && !ascData.hasMore;
    const scopeDescription = isExhaustive
      ? "Earliest usable observation"
      : "Earliest usable observation found in searched scope";
    const returnedUsable = usable.slice(0, limit);

    return {
      mode: "REAL_EO_CATALOG",
      provider: this.providerName,
      aoi,
      constraints: {
        maxCloudCover: maxCloud,
        startDate,
        endDate,
      },
      earliestUsable,
      latestUsable,
      usableObservations: returnedUsable,
      rejectedObservations: rejected,
      totalFound: uniqueRecordsExamined,
      totalReturned: returnedUsable.length,
      usableCount: usable.length,
      rejectedCount: rejected.length,
      recordsExamined: uniqueRecordsExamined,
      uniqueRecordsExamined,
      rawRecordsExamined,
      pagesFollowed: totalPages,
      hasMore: ascData.hasMore,
      isExhaustive,
      searchScope: {
        startDate,
        endDate,
        sortDirection: ascData.sortSupported ? "asc" : "fallback",
        archiveType: "Copernicus Sentinel-2 L2A STAC Archive",
        scopeDescription,
      },
      summary: {
        temporalSpanDays: spanDays,
        earliestDate: earliestUsable ? earliestUsable.acquisitionDate.slice(0, 10) : null,
        latestDate: latestUsable ? latestUsable.acquisitionDate.slice(0, 10) : null,
        rejectionBreakdown: rejectionCounts,
      },
    };
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

  /**
   * Retrieves all asset records for a given scene.
   */
  async getSceneAssets(sceneId: string): Promise<Record<string, SatelliteAsset>> {
    const item = await this.fetchRawStacItem(sceneId);
    if (!item) {
      throw new Error(`Scene "${sceneId}" not found in STAC archives.`);
    }

    const itemProps = item.properties || {};
    const itemEpsg = typeof itemProps["proj:epsg"] === "number" ? itemProps["proj:epsg"] : undefined;
    const assets = item.assets || {};
    const result: Record<string, SatelliteAsset> = {};

    for (const [key, asset] of Object.entries<any>(assets)) {
      if (!asset || !asset.href) continue;

      const projEpsg = typeof asset["proj:epsg"] === "number" ? asset["proj:epsg"] : itemEpsg;
      const projShape = Array.isArray(asset["proj:shape"]) && asset["proj:shape"].length === 2
        ? [Number(asset["proj:shape"][0]), Number(asset["proj:shape"][1])] as [number, number]
        : undefined;
      const projTransform = Array.isArray(asset["proj:transform"]) && asset["proj:transform"].length >= 6
        ? asset["proj:transform"].map(Number)
        : undefined;

      result[key] = {
        href: asset.href,
        type: asset.type,
        title: asset.title,
        roles: Array.isArray(asset.roles) ? asset.roles : [],
        projEpsg,
        projShape,
        projTransform,
      };
    }

    return result;
  }

  /**
   * Retrieves scientifically valid, georeferenced raster analysis assets (e.g. 10m/20m COGs).
   * Explicitly separates them from preview/thumbnail images.
   */
  async getAnalysisAssets(sceneId: string, aoi?: BoundingBox): Promise<import("./satelliteProvider").AnalysisAsset[]> {
    const item = await this.fetchRawStacItem(sceneId);
    if (!item) {
      throw new Error(`Scene "${sceneId}" not found in STAC archives.`);
    }

    const itemProps = item.properties || {};
    const itemEpsg = typeof itemProps["proj:epsg"] === "number" ? itemProps["proj:epsg"] : undefined;
    const defaultCrs = itemEpsg ? `EPSG:${itemEpsg}` : "EPSG:32644";
    const assets = item.assets || {};

    // Standard Sentinel-2 L2A Band Resolution mapping (meters)
    const bandResolutionMap: Record<string, number> = {
      visual: 10,
      B02: 10,
      B03: 10,
      B04: 10,
      B08: 10,
      B05: 20,
      B06: 20,
      B07: 20,
      B8A: 20,
      B11: 20,
      B12: 20,
      SCL: 20,
      AOT: 10,
      WVP: 10,
      B01: 60,
      B09: 60,
    };

    const analysisAssets: import("./satelliteProvider").AnalysisAsset[] = [];

    for (const [key, asset] of Object.entries<any>(assets)) {
      if (!asset || !asset.href) continue;

      const mediaType = asset.type || "";
      const roles = Array.isArray(asset.roles) ? asset.roles : [];

      // Critical Scientific Guard: Reject non-raster or overview/thumbnail previews
      const isPreview =
        key === "rendered_preview" ||
        key === "thumbnail" ||
        key === "preview" ||
        roles.includes("overview") ||
        roles.includes("thumbnail") ||
        mediaType === "image/png" ||
        mediaType === "image/jpeg";

      if (isPreview) {
        continue;
      }

      // Check for georeferenced TIFF / COG
      const isTiff =
        mediaType.includes("tiff") ||
        mediaType.includes("geotiff") ||
        asset.href.toLowerCase().endsWith(".tif") ||
        asset.href.toLowerCase().endsWith(".tiff") ||
        key in bandResolutionMap;

      if (!isTiff) {
        continue;
      }

      const resolution = bandResolutionMap[key] || 10;
      const projEpsg = typeof asset["proj:epsg"] === "number" ? asset["proj:epsg"] : itemEpsg;
      const crs = projEpsg ? `EPSG:${projEpsg}` : defaultCrs;

      const shape = Array.isArray(asset["proj:shape"]) && asset["proj:shape"].length === 2
        ? [Number(asset["proj:shape"][0]), Number(asset["proj:shape"][1])] as [number, number]
        : [10980, 10980] as [number, number];

      const transform = Array.isArray(asset["proj:transform"]) && asset["proj:transform"].length >= 6
        ? asset["proj:transform"].map(Number)
        : undefined;

      const isCog = mediaType.includes("cloud-optimized") || asset.href.includes(".blob.core.windows.net");
      const requiresSigning = asset.href.includes(".blob.core.windows.net");

      analysisAssets.push({
        assetKey: key,
        href: asset.href,
        mediaType: mediaType || "image/tiff; application=geotiff; profile=cloud-optimized",
        roles: roles.length > 0 ? roles : ["data"],
        title: asset.title || `${key} (Sentinel-2 L2A ${resolution}m)`,
        resolution,
        bandName: key,
        crs,
        shape,
        transform,
        isAnalysisCapable: true,
        isCog,
        requiresSigning,
      });
    }

    // Sort to prioritize primary scientific analysis bands: visual (RGB), B04 (Red), B08 (NIR)
    const priorityOrder = ["visual", "B04", "B08", "B03", "B02", "B8A", "B11", "B12", "SCL"];
    analysisAssets.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.assetKey);
      const idxB = priorityOrder.indexOf(b.assetKey);
      const weightA = idxA !== -1 ? idxA : 100;
      const weightB = idxB !== -1 ? idxB : 100;
      return weightA - weightB;
    });

    return analysisAssets;
  }

  private async fetchRawStacItem(sceneId: string): Promise<any> {
    if (!sceneId || typeof sceneId !== "string") {
      throw new Error("Invalid sceneId provided.");
    }

    // Attempt primary lookup
    const primaryItemUrl = `${this.primaryStacUrl}/collections/sentinel-2-l2a/items/${encodeURIComponent(sceneId)}`;
    try {
      const item = await this.fetchWithTimeout(primaryItemUrl);
      if (item && item.id) return item;
    } catch {
      // Fall through to fallback
    }

    // Attempt fallback lookup
    const fallbackItemUrl = `${this.fallbackStacUrl}/collections/sentinel-2-l2a/items/${encodeURIComponent(sceneId)}`;
    try {
      const item = await this.fetchWithTimeout(fallbackItemUrl);
      if (item && item.id) return item;
    } catch {
      return null;
    }

    return null;
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

  /**
   * Performs paginated STAC search in chronological order (ascending or descending),
   * following STAC next links up to maxPages or until target scenes are accumulated.
   */
  private async queryStacWithPagination(
    baseUrl: string,
    providerLabel: string,
    aoi: BoundingBox,
    startDate: string,
    endDate: string,
    sortDirection: "asc" | "desc" = "asc",
    maxPages: number = 4,
    pageSize: number = 25
  ): Promise<{
    scenes: SatelliteScene[];
    pagesFollowed: number;
    recordsExamined: number;
    hasMore: boolean;
    sortSupported: boolean;
  }> {
    const bboxParam = `${aoi.min_lon},${aoi.min_lat},${aoi.max_lon},${aoi.max_lat}`;
    const datetimeParam = `${startDate}T00:00:00Z/${endDate}T23:59:59Z`;

    const initialUrl = new URL(`${baseUrl}/search`);
    initialUrl.searchParams.set("collections", "sentinel-2-l2a");
    initialUrl.searchParams.set("bbox", bboxParam);
    initialUrl.searchParams.set("datetime", datetimeParam);
    initialUrl.searchParams.set("limit", String(pageSize));
    if (sortDirection === "asc") {
      initialUrl.searchParams.set("sortby", "+properties.datetime");
    } else {
      initialUrl.searchParams.set("sortby", "-properties.datetime");
    }

    let currentUrl: string | null = initialUrl.toString();
    const allScenes: SatelliteScene[] = [];
    let pagesFollowed = 0;
    let recordsExamined = 0;
    let hasMore = false;
    let sortSupported = true;

    while (currentUrl && pagesFollowed < maxPages) {
      pagesFollowed++;
      let rawData: any = null;
      try {
        rawData = await this.fetchWithTimeout(currentUrl);
      } catch (err) {
        // If sorting failed on fallback provider, retry initial page without sortby
        if (pagesFollowed === 1 && sortSupported) {
          try {
            initialUrl.searchParams.delete("sortby");
            rawData = await this.fetchWithTimeout(initialUrl.toString());
            sortSupported = false;
          } catch {
            break;
          }
        } else {
          break;
        }
      }

      if (!rawData || !Array.isArray(rawData.features) || rawData.features.length === 0) {
        hasMore = false;
        break;
      }

      recordsExamined += rawData.features.length;
      for (const feature of rawData.features) {
        allScenes.push(this.parseStacItem(feature, providerLabel));
      }

      // Check for STAC next link
      const nextLink = Array.isArray(rawData.links)
        ? rawData.links.find((l: any) => l.rel === "next")
        : null;

      if (nextLink && nextLink.href) {
        currentUrl = nextLink.href;
        hasMore = true;
      } else {
        currentUrl = null;
        hasMore = false;
      }
    }

    return {
      scenes: allScenes,
      pagesFollowed,
      recordsExamined,
      hasMore,
      sortSupported,
    };
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
