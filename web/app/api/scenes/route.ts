import { NextRequest, NextResponse } from "next/server";
import { getLocations, getScenes, getEoLocations, getEoScenes } from "@/lib/data";

export async function GET(request: NextRequest) {
  const catalog = request.nextUrl.searchParams.get("catalog");
  const isRealEo = catalog === "real-eo" || catalog === "real_eo";

  const locations = isRealEo ? getEoLocations() : getLocations();
  const scenes = isRealEo ? getEoScenes() : getScenes();

  return NextResponse.json({
    total_locations: locations.length,
    total_scenes: scenes.length,
    locations,
    scenes,
    mode: isRealEo ? "real-eo-catalog" : "controlled-benchmark",
  });
}
