/**
 * TerraLens AI - Client-side Satellite API Service Layer
 * 
 * Provides safe frontend interfaces to interact with server-side STAC endpoints:
 * - /api/satellite/search
 * - /api/satellite/pairs
 * - /api/satellite/scene/[sceneId]
 * 
 * Authored by Divija Jangam (divijajangam)
 */

import {
  SatelliteScene,
  SatelliteSearchQuery,
  TemporalPairCandidate,
  TemporalConstraints,
} from "@/lib/providers/satelliteProvider";
import { BoundingBox } from "@/types";

export interface SatelliteSearchResponse {
  mode: "LIVE_PUBLIC_DATA";
  provider: string;
  query: {
    aoi: BoundingBox;
    startDate: string;
    endDate: string;
    maxCloudCover?: number;
    limit?: number;
  };
  count: number;
  scenes: SatelliteScene[];
  timestamp: string;
}

export interface TemporalPairsResponse {
  mode: "LIVE_PUBLIC_DATA";
  provider: string;
  aoi: BoundingBox;
  constraints: TemporalConstraints;
  count: number;
  pairs: TemporalPairCandidate[];
  timestamp: string;
}

export interface SceneDetailResponse {
  mode: "LIVE_PUBLIC_DATA";
  provider: string;
  scene: SatelliteScene;
  metadata: Record<string, unknown>;
  thumbnailUrl: string | null;
}

export class SatelliteApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  /**
   * Searches live public Sentinel-2 scenes for a given bounding box and date range.
   */
  async searchScenes(query: SatelliteSearchQuery): Promise<SatelliteSearchResponse> {
    const response = await fetch(`${this.baseUrl}/api/satellite/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Satellite search failed with HTTP status ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * Discovers suitable before/after temporal scene pairs for change analysis.
   */
  async getTemporalPairs(
    aoi: BoundingBox,
    constraints?: TemporalConstraints
  ): Promise<TemporalPairsResponse> {
    const response = await fetch(`${this.baseUrl}/api/satellite/pairs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aoi,
        minDaysDifference: constraints?.minDaysDifference,
        maxDaysDifference: constraints?.maxDaysDifference,
        maxCloudCover: constraints?.maxCloudCover,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Temporal pair discovery failed with HTTP status ${response.status}`
      );
    }

    return response.json();
  }

  /**
   * Retrieves detailed scene metadata and preview assets for a specific Sentinel-2 scene.
   */
  async getScene(sceneId: string): Promise<SceneDetailResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/satellite/scene/${encodeURIComponent(sceneId)}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Scene lookup failed with HTTP status ${response.status}`
      );
    }

    return response.json();
  }
}

export const satelliteClient = new SatelliteApiClient();
