import { NextRequest, NextResponse } from "next/server";
import {
  getSatelliteProvider,
  normalizeBoundingBox,
  validateTemporalConstraints,
  TemporalConstraints,
} from "@/lib/providers";

export const dynamic = "force-dynamic";

/**
 * POST /api/satellite/pairs
 * 
 * Automatically discovers suitable before/after temporal scene pairs for change analysis
 * from live Sentinel-2 public STAC imagery.
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

    const constraints: TemporalConstraints = {
      minDaysDifference:
        body.minDaysDifference !== undefined ? Number(body.minDaysDifference) : undefined,
      maxDaysDifference:
        body.maxDaysDifference !== undefined ? Number(body.maxDaysDifference) : undefined,
      maxCloudCover:
        body.maxCloudCover !== undefined ? Number(body.maxCloudCover) : undefined,
    };

    const constraintsValidation = validateTemporalConstraints(constraints);
    if (!constraintsValidation.valid) {
      return NextResponse.json(
        { error: `Validation error: ${constraintsValidation.error}` },
        { status: 400 }
      );
    }

    const provider = getSatelliteProvider("LIVE_PUBLIC_DATA");
    const pairs = await provider.getTemporalPairs(normalizedBbox, constraints);

    return NextResponse.json(
      {
        mode: "LIVE_PUBLIC_DATA",
        provider: provider.providerName,
        aoi: normalizedBbox,
        constraints: {
          minDaysDifference: constraints.minDaysDifference ?? 14,
          maxDaysDifference: constraints.maxDaysDifference ?? 730,
          maxCloudCover: constraints.maxCloudCover ?? 25,
        },
        count: pairs.length,
        pairs,
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
          error: "Temporal pair discovery timed out. Try constraining the search parameters.",
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
      { error: "Temporal pair discovery encountered an unexpected failure.", details: message },
      { status: 500 }
    );
  }
}
