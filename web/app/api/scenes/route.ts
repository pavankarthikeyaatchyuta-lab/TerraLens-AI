import { NextResponse } from "next/server";
import { getLocations, getScenes } from "@/lib/data";

export async function GET() {
  const locations = getLocations();
  const scenes = getScenes();

  return NextResponse.json({
    total_locations: locations.length,
    total_scenes: scenes.length,
    locations,
    scenes,
  });
}
