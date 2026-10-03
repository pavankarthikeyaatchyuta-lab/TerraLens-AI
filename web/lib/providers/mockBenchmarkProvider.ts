/**
 * Mock Benchmark Provider for TerraLens AI.
 * 
 * Wraps the curated 5-location, 10-scene benchmark archive.
 * Guarantees 100% deterministic reproducibility for Controlled Benchmark Mode
 * and Offline Research Mode.
 */

import {
  SatelliteDataProvider,
  SatelliteSearchQuery,
  SatelliteScene,
  TemporalConstraints,
  TemporalPairCandidate,
  TemporalHistoryOptions,
  TemporalHistoryResult,
  validateSearchQuery,
} from "./satelliteProvider";
import { getLocations, getScenes, getLocationById } from "@/lib/data";
import { BoundingBox } from "@/types";

export class MockBenchmarkProvider implements SatelliteDataProvider {
  readonly providerId = "mock_benchmark_provider";
  readonly providerName = "Controlled Benchmark Archive";
  readonly isLive = false;

  async searchScenes(query: SatelliteSearchQuery): Promise<SatelliteScene[]> {
    const validation = validateSearchQuery(query);
    if (!validation.valid) {
      throw new Error(`Invalid satellite search query: ${validation.error}`);
    }

    const scenes = getScenes();
    const locations = getLocations();
    const { aoi, startDate, endDate, maxCloudCover } = query;

    const startMs = Date.parse(startDate);
    const endMs = Date.parse(endDate);

    const matchedScenes: SatelliteScene[] = [];

    for (const s of scenes) {
      const sceneDateMs = Date.parse(s.acquisition_date);
      if (isNaN(sceneDateMs) || sceneDateMs < startMs || sceneDateMs > endMs) {
        continue;
      }

      if (maxCloudCover !== undefined && s.cloud_percentage > maxCloudCover) {
        continue;
      }

      const loc = locations.find((l) => l.location_id === s.location_id);
      if (!loc) continue;

      // Spatial intersection check with query AOI
      const intersects =
        loc.bounding_box.min_lat <= aoi.max_lat &&
        loc.bounding_box.max_lat >= aoi.min_lat &&
        loc.bounding_box.min_lon <= aoi.max_lon &&
        loc.bounding_box.max_lon >= aoi.min_lon;

      if (!intersects) {
        continue;
      }

      matchedScenes.push(this.mapToSatelliteScene(s, loc));
    }

    return matchedScenes;
  }

  async getScene(sceneId: string): Promise<SatelliteScene | null> {
    if (!sceneId) return null;
    const scenes = getScenes();
    const target = scenes.find((s) => s.scene_id === sceneId);
    if (!target) return null;

    const loc = getLocationById(target.location_id);
    if (!loc) return null;

    return this.mapToSatelliteScene(target, loc);
  }

  getThumbnailUrl(sceneId: string): string | null {
    if (!sceneId) return null;
    const scenes = getScenes();
    const target = scenes.find((s) => s.scene_id === sceneId);
    if (!target) return null;
    return target.image_path.startsWith("/") ? target.image_path : "/" + target.image_path;
  }

  async getTemporalPairs(
    aoi: BoundingBox,
    constraints?: TemporalConstraints
  ): Promise<TemporalPairCandidate[]> {
    const locations = getLocations();
    const scenes = getScenes();

    // Find overlapping benchmark location
    const matchedLoc = locations.find(
      (loc) =>
        loc.bounding_box.min_lat <= aoi.max_lat &&
        loc.bounding_box.max_lat >= aoi.min_lat &&
        loc.bounding_box.min_lon <= aoi.max_lon &&
        loc.bounding_box.max_lon >= aoi.min_lon
    );

    if (!matchedLoc || !matchedLoc.before_scene_id || !matchedLoc.after_scene_id) {
      return [];
    }

    const beforeSceneRaw = scenes.find((s) => s.scene_id === matchedLoc.before_scene_id);
    const afterSceneRaw = scenes.find((s) => s.scene_id === matchedLoc.after_scene_id);

    if (!beforeSceneRaw || !afterSceneRaw) {
      return [];
    }

    const beforeScene = this.mapToSatelliteScene(beforeSceneRaw, matchedLoc);
    const afterScene = this.mapToSatelliteScene(afterSceneRaw, matchedLoc);

    const tBefore = new Date(beforeScene.acquisitionDate).getTime();
    const tAfter = new Date(afterScene.acquisitionDate).getTime();
    const daysDifference = Math.max(1, Math.round(Math.abs(tAfter - tBefore) / (1000 * 60 * 60 * 24)));

    // Check constraints if provided
    if (constraints?.maxCloudCover !== undefined) {
      if (
        beforeScene.cloudCoverPercentage > constraints.maxCloudCover ||
        afterScene.cloudCoverPercentage > constraints.maxCloudCover
      ) {
        return [];
      }
    }

    return [
      {
        beforeScene,
        afterScene,
        daysDifference,
        recommended: true,
        qualityScore: 1.0,
      },
    ];
  }

  async getTemporalHistory(
    aoi: BoundingBox,
    options?: TemporalHistoryOptions
  ): Promise<TemporalHistoryResult> {
    const locations = getLocations();
    const scenes = getScenes();

    const matchedLoc = locations.find(
      (loc) =>
        loc.bounding_box.min_lat <= aoi.max_lat &&
        loc.bounding_box.max_lat >= aoi.min_lat &&
        loc.bounding_box.min_lon <= aoi.max_lon &&
        loc.bounding_box.max_lon >= aoi.min_lon
    ) || locations[0];

    const locScenes = scenes
      .filter((s) => s.location_id === matchedLoc.location_id)
      .map((s) => this.mapToSatelliteScene(s, matchedLoc))
      .sort((a, b) => new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime());

    const earliestUsable = locScenes.length > 0 ? locScenes[0] : null;
    const latestUsable = locScenes.length > 0 ? locScenes[locScenes.length - 1] : null;

    let spanDays = 0;
    if (earliestUsable && latestUsable) {
      const t1 = new Date(earliestUsable.acquisitionDate).getTime();
      const t2 = new Date(latestUsable.acquisitionDate).getTime();
      spanDays = Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
    }

    return {
      mode: "CONTROLLED_BENCHMARK",
      provider: this.providerName,
      aoi,
      constraints: {
        maxCloudCover: options?.maxCloudCover ?? 25,
        startDate: options?.startDate || "2023-01-01",
        endDate: options?.endDate || "2025-12-31",
      },
      earliestUsable,
      latestUsable,
      usableObservations: locScenes,
      rejectedObservations: [],
      totalFound: locScenes.length,
      totalReturned: locScenes.length,
      usableCount: locScenes.length,
      rejectedCount: 0,
      recordsExamined: locScenes.length,
      uniqueRecordsExamined: locScenes.length,
      rawRecordsExamined: locScenes.length,
      pagesFollowed: 1,
      hasMore: false,
      isExhaustive: true,
      searchScope: {
        startDate: options?.startDate || "2023-01-01",
        endDate: options?.endDate || "2025-12-31",
        sortDirection: "asc",
        archiveType: "Controlled Synthetic Benchmark Catalog",
        scopeDescription: "Earliest usable observation",
      },
      summary: {
        temporalSpanDays: spanDays,
        earliestDate: earliestUsable ? earliestUsable.acquisitionDate.slice(0, 10) : null,
        latestDate: latestUsable ? latestUsable.acquisitionDate.slice(0, 10) : null,
        rejectionBreakdown: {},
      },
    };
  }

  async getMetadata(sceneId: string): Promise<Record<string, unknown>> {
    const scene = await this.getScene(sceneId);
    if (!scene) {
      throw new Error(`Scene "${sceneId}" not found in benchmark archive.`);
    }
    return {
      scene_id: scene.sceneId,
      platform: scene.platform,
      instrument: scene.instrument,
      acquisition_date: scene.acquisitionDate,
      cloud_cover_percentage: scene.cloudCoverPercentage,
      bbox: scene.bbox,
      collection: scene.collection,
      source_provider: scene.sourceProvider,
      benchmark_tags: scene.extraProperties?.benchmark_tags,
    };
  }

  async getSceneAssets(sceneId: string): Promise<Record<string, import("./satelliteProvider").SatelliteAsset>> {
    const scene = await this.getScene(sceneId);
    if (!scene) {
      throw new Error(`Scene "${sceneId}" not found in benchmark archive.`);
    }
    return {
      visual: {
        href: scene.thumbnailUrl || "",
        type: "image/tiff; application=geotiff; profile=cloud-optimized",
        title: "Controlled Benchmark Visual (RGB) 10m",
        roles: ["data", "visual"],
        projEpsg: 32644,
        projShape: [512, 512],
        projTransform: [10, 0, 500000, 0, -10, 5000000],
      },
      B04: {
        href: scene.thumbnailUrl || "",
        type: "image/tiff; application=geotiff; profile=cloud-optimized",
        title: "Controlled Benchmark Band 4 - Red - 10m",
        roles: ["data"],
        projEpsg: 32644,
        projShape: [512, 512],
        projTransform: [10, 0, 500000, 0, -10, 5000000],
      },
      B08: {
        href: scene.thumbnailUrl || "",
        type: "image/tiff; application=geotiff; profile=cloud-optimized",
        title: "Controlled Benchmark Band 8 - NIR - 10m",
        roles: ["data"],
        projEpsg: 32644,
        projShape: [512, 512],
        projTransform: [10, 0, 500000, 0, -10, 5000000],
      },
      rendered_preview: {
        href: scene.thumbnailUrl || "",
        type: "image/png",
        title: "Controlled Benchmark Preview (Overview)",
        roles: ["overview", "thumbnail"],
      },
    };
  }

  async getAnalysisAssets(sceneId: string, aoi?: BoundingBox): Promise<import("./satelliteProvider").AnalysisAsset[]> {
    const scene = await this.getScene(sceneId);
    if (!scene) {
      throw new Error(`Scene "${sceneId}" not found in benchmark archive.`);
    }

    return [
      {
        assetKey: "visual",
        href: scene.thumbnailUrl || "",
        mediaType: "image/tiff; application=geotiff; profile=cloud-optimized",
        roles: ["data", "visual"],
        title: "Controlled Benchmark Visual (RGB) 10m",
        resolution: 10,
        bandName: "visual",
        crs: "EPSG:32644",
        shape: [512, 512],
        transform: [10, 0, 500000, 0, -10, 5000000],
        isAnalysisCapable: true,
        isCog: false,
        requiresSigning: false,
      },
      {
        assetKey: "B04",
        href: scene.thumbnailUrl || "",
        mediaType: "image/tiff; application=geotiff; profile=cloud-optimized",
        roles: ["data"],
        title: "Controlled Benchmark Band 4 - Red - 10m",
        resolution: 10,
        bandName: "B04",
        crs: "EPSG:32644",
        shape: [512, 512],
        transform: [10, 0, 500000, 0, -10, 5000000],
        isAnalysisCapable: true,
        isCog: false,
        requiresSigning: false,
      },
      {
        assetKey: "B08",
        href: scene.thumbnailUrl || "",
        mediaType: "image/tiff; application=geotiff; profile=cloud-optimized",
        roles: ["data"],
        title: "Controlled Benchmark Band 8 - NIR - 10m",
        resolution: 10,
        bandName: "B08",
        crs: "EPSG:32644",
        shape: [512, 512],
        transform: [10, 0, 500000, 0, -10, 5000000],
        isAnalysisCapable: true,
        isCog: false,
        requiresSigning: false,
      },
    ];
  }

  private mapToSatelliteScene(s: any, loc: any): SatelliteScene {
    const imagePath = s.image_path.startsWith("/") ? s.image_path : "/" + s.image_path;

    return {
      sceneId: s.scene_id,
      platform: s.platform || "Sentinel-2 MSI (Controlled Synthetic Benchmark)",
      instrument: s.sensor || "MSI",
      acquisitionDate: s.acquisition_date,
      cloudCoverPercentage: s.cloud_percentage,
      bbox: [
        loc.bounding_box.min_lon,
        loc.bounding_box.min_lat,
        loc.bounding_box.max_lon,
        loc.bounding_box.max_lat,
      ],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [loc.bounding_box.min_lon, loc.bounding_box.min_lat],
            [loc.bounding_box.max_lon, loc.bounding_box.min_lat],
            [loc.bounding_box.max_lon, loc.bounding_box.max_lat],
            [loc.bounding_box.min_lon, loc.bounding_box.max_lat],
            [loc.bounding_box.min_lon, loc.bounding_box.min_lat],
          ],
        ],
      },
      collection: "terralens-controlled-benchmark",
      sourceProvider: "Controlled Benchmark Archive",
      thumbnailUrl: imagePath,
      previewUrl: imagePath,
      assetsSummary: {
        visual: {
          href: imagePath,
          title: "Controlled Benchmark True Color Image",
          roles: ["visual", "benchmark"],
        },
      },
      extraProperties: {
        location_id: loc.location_id,
        location_name: loc.name,
        benchmark_tags: s.tags,
      },
    };
  }
}
