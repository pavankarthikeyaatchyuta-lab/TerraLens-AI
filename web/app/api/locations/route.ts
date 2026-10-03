import { NextRequest, NextResponse } from "next/server";
import { getLocations, getEoLocations } from "@/lib/data";

export async function GET(request: NextRequest) {
  const catalog = request.nextUrl.searchParams.get("catalog");
  const isRealEo = catalog === "real-eo" || catalog === "real_eo";
  const locations = isRealEo ? getEoLocations() : getLocations();

  return NextResponse.json({
    total_locations: locations.length,
    locations,
    source: isRealEo
      ? "Copernicus Sentinel-2 L2A STAC Archive (Phase 7B Catalog)"
      : "TerraLens Prototype Dataset (SIH-2026 Benchmark Sandbox)",
    mode: isRealEo ? "real-eo-catalog" : "controlled-benchmark",
  });
}
