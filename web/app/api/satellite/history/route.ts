import { NextRequest, NextResponse } from "next/server";
import {
  getSatelliteProvider,
  normalizeBoundingBox,
  OperatingMode,
} from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * POST /api/satellite/history
 * 
 * Phase 8: Discovers the chronological temporal observation history for a given AOI
 * and identifies the earliest observation satisfying configured usability constraints.
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

    // Accept bounding box from either 'aoi' or 'bbox' property
    const rawBbox = body.aoi !== undefined ? body.aoi : body.bbox;
    const normalizedBbox = normalizeBoundingBox(rawBbox);

    if (!normalizedBbox) {
      return NextResponse.json(
        {
          error:
            "Invalid bounding box. Provide 'aoi' or 'bbox' as { minLat, minLon, maxLat, maxLon }, { min_lat, min_lon, max_lat, max_lon }, or [minLon, minLat, maxLon, maxLat].",
        },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    const { min_lat, min_lon, max_lat, max_lon } = normalizedBbox;
    if (min_lat < -90 || min_lat > 90 || max_lat < -90 || max_lat > 90) {
      return NextResponse.json(
        { error: "Latitude must be within the range [-90, 90]." },
        { status: 400 }
      );
    }
    if (min_lon < -180 || min_lon > 180 || max_lon < -180 || max_lon > 180) {
      return NextResponse.json(
        { error: "Longitude must be within the range [-180, 180]." },
        { status: 400 }
      );
    }
    if (min_lat > max_lat || min_lon > max_lon) {
      return NextResponse.json(
        { error: "Minimum coordinates cannot exceed maximum coordinates." },
        { status: 400 }
      );
    }

    const maxCloud = body.maxCloudCover !== undefined ? Number(body.maxCloudCover) : 25;
    if (isNaN(maxCloud) || maxCloud < 0 || maxCloud > 100) {
      return NextResponse.json(
        { error: "maxCloudCover must be a number between 0 and 100." },
        { status: 400 }
      );
    }

    const mode: OperatingMode =
      body.mode === "CONTROLLED_BENCHMARK" ? "CONTROLLED_BENCHMARK" : "REAL_EO_CATALOG";

    const provider = getSatelliteProvider(mode);

    if (!provider.getTemporalHistory) {
      return NextResponse.json(
        { error: `Provider "${provider.providerName}" does not support temporal history discovery.` },
        { status: 501 }
      );
    }

    const historyResult = await provider.getTemporalHistory(normalizedBbox, {
      startDate: typeof body.startDate === "string" ? body.startDate : undefined,
      endDate: typeof body.endDate === "string" ? body.endDate : undefined,
      maxCloudCover: maxCloud,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
      limit: typeof body.limit === "number" ? body.limit : 50,
    });

    return NextResponse.json(historyResult, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.toLowerCase().includes("timed out")) {
      return NextResponse.json(
        {
          error: "Temporal history discovery timed out. Try constraining search parameters.",
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
      { error: "Temporal history discovery encountered an unexpected failure.", details: message },
      { status: 500 }
    );
  }
}
