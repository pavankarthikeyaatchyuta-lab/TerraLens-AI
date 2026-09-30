import { NextRequest, NextResponse } from "next/server";
import { getLocationById, getSceneById, getScenes } from "@/lib/data";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  
  // Try finding location first
  const location = getLocationById(id);
  if (location) {
    const scenes = getScenes().filter((s) => s.location_id === id);
    return NextResponse.json({
      type: "location",
      location,
      scenes,
    });
  }

  // Try finding scene
  const scene = getSceneById(id);
  if (scene) {
    const loc = getLocationById(scene.location_id);
    return NextResponse.json({
      type: "scene",
      scene,
      location: loc,
    });
  }

  return NextResponse.json(
    { error: `Entity not found for identifier: ${id}` },
    { status: 404 }
  );
}
