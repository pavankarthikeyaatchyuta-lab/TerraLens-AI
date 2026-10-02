import { NextRequest, NextResponse } from "next/server";
import { getSatelliteProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: {
    sceneId: string;
  };
}

/**
 * GET /api/satellite/scene/[sceneId]
 * 
 * Fetches standardized metadata and asset references for a specific Sentinel-2 scene.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const sceneId = params?.sceneId ? decodeURIComponent(params.sceneId).trim() : "";

    if (!sceneId) {
      return NextResponse.json(
        { error: "Scene ID parameter is required." },
        { status: 400 }
      );
    }

    // Sanitize sceneId: Sentinel-2 STAC IDs typically consist of alphanumeric chars, dashes, underscores, and colons
    if (sceneId.includes("..") || sceneId.includes("/") || sceneId.includes("\\")) {
      return NextResponse.json(
        { error: "Invalid characters in Scene ID." },
        { status: 400 }
      );
    }

    const provider = getSatelliteProvider("LIVE_PUBLIC_DATA");
    const scene = await provider.getScene(sceneId);

    if (!scene) {
      return NextResponse.json(
        {
          error: `Satellite scene "${sceneId}" was not found in public archives.`,
          sceneId,
        },
        { status: 404 }
      );
    }

    let metadata: Record<string, unknown> = {};
    try {
      metadata = await provider.getMetadata(sceneId);
    } catch {
      // Fallback to scene properties if deep metadata fetch encounters a non-fatal issue
      metadata = {
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

    return NextResponse.json(
      {
        mode: "LIVE_PUBLIC_DATA",
        provider: provider.providerName,
        scene,
        metadata,
        thumbnailUrl: provider.getThumbnailUrl(sceneId),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.toLowerCase().includes("timed out")) {
      return NextResponse.json(
        {
          error: "Scene metadata request timed out.",
          details: message,
        },
        { status: 504 }
      );
    }

    if (
      message.includes("STAC providers unavailable") ||
      message.includes("HTTP error 5") ||
      message.includes("fetch failed")
    ) {
      return NextResponse.json(
        {
          error: "Upstream Copernicus STAC providers are temporarily unavailable.",
          details: message,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: "Failed to retrieve scene metadata.", details: message },
      { status: 500 }
    );
  }
}
