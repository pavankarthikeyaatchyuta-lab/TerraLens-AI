import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface GeocodeResult {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  boundingbox?: [number, number, number, number];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    // 1. Check if user typed direct coordinates (e.g., "17.385, 78.486" or "17.385 78.486")
    const coordMatch = query.match(/^([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lon = parseFloat(coordMatch[2]);

      if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const directCoordResult: GeocodeResult = {
          name: `Point (${lat.toFixed(4)}, ${lon.toFixed(4)})`,
          display_name: `Coordinates: Latitude ${lat.toFixed(5)}, Longitude ${lon.toFixed(5)}`,
          lat,
          lon,
          boundingbox: [lat - 0.05, lat + 0.05, lon - 0.05, lon + 0.05],
        };
        return NextResponse.json({ results: [directCoordResult] });
      }
    }

    // 2. Query OSM Nominatim global geocoding API
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query
    )}&limit=5&addressdetails=1`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "TerraLens-AI-MissionControl/1.0",
        Accept: "application/json",
      },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();

    const results: GeocodeResult[] = (data || []).map((item: any) => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const bb = item.boundingbox ? item.boundingbox.map((x: string) => parseFloat(x)) : undefined;

      return {
        name: item.name || item.display_name?.split(",")[0] || query,
        display_name: item.display_name || "",
        lat,
        lon,
        boundingbox: bb,
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    return NextResponse.json({ results: [], error: error.message || "Geocoding lookup failed" });
  }
}
