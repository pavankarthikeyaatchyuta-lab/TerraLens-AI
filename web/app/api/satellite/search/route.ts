import { NextRequest, NextResponse } from "next/server";
import {
  getSatelliteProvider,
  normalizeBoundingBox,
  validateSearchQuery,
  SatelliteSearchQuery,
} from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * POST /api/satellite/search
 * 
 * Searches open-access Copernicus Sentinel-2 L2A scenes via server-side STAC.
 * STRICT ISOLATION: Operates purely under LIVE_PUBLIC_DATA mode.
 * Does not expose external credentials or mutate controlled benchmark data.
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Malformed request payload: valid JSON body is required." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    // Accept bounding box from either 'bbox' or 'aoi' property
    const rawBbox = body.bbox !== undefined ? body.bbox : body.aoi;
    const normalizedBbox = normalizeBoundingBox(rawBbox);

    if (!normalizedBbox) {
      return NextResponse.json(
        {
          error:
            "Invalid bounding box. Provide 'bbox' or 'aoi' as { minLat, minLon, maxLat, maxLon }, { min_lat, min_lon, max_lat, max_lon }, or [minLon, minLat, maxLon, maxLat].",
        },
        { status: 400 }
      );
    }

    const searchQuery: SatelliteSearchQuery = {
      aoi: normalizedBbox,
      startDate: body.startDate,
      endDate: body.endDate,
      maxCloudCover: body.maxCloudCover !== undefined ? Number(body.maxCloudCover) : undefined,
      limit: body.limit !== undefined ? Number(body.limit) : 10,
    };

    const validation = validateSearchQuery(searchQuery);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Validation error: ${validation.error}` },
        { status: 400 }
      );
    }

    const provider = getSatelliteProvider("LIVE_PUBLIC_DATA");
    const scenes = await provider.searchScenes(searchQuery);

    return NextResponse.json(
      {
        mode: "LIVE_PUBLIC_DATA",
        provider: provider.providerName,
        query: {
          aoi: searchQuery.aoi,
          startDate: searchQuery.startDate,
          endDate: searchQuery.endDate,
          maxCloudCover: searchQuery.maxCloudCover,
          limit: searchQuery.limit,
        },
        count: scenes.length,
        scenes,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.toLowerCase().includes("timed out")) {
      return NextResponse.json(
        {
          error: "Satellite catalog search timed out. Try narrowing your date range or geographic bounds.",
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
      { error: "Satellite search encountered an unexpected failure.", details: message },
      { status: 500 }
    );
  }
}
