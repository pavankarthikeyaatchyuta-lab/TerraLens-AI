import { NextRequest, NextResponse } from "next/server";
import { getLocationById, getSceneById, getScenes } from "@/lib/data";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  let location = getLocationById(id);

  if (!location) {
    const scene = getSceneById(id);
    if (scene) {
      location = getLocationById(scene.location_id);
    }
  }

  if (!location) {
    return NextResponse.json(
      { error: `Location not found for identifier: ${id}` },
      { status: 404 }
    );
  }

  const allScenes = getScenes().filter((s) => s.location_id === location.location_id);
  const beforeScene = location.before_scene_id ? getSceneById(location.before_scene_id) : allScenes[0];
  const afterScene = location.after_scene_id ? getSceneById(location.after_scene_id) : allScenes[1];

  return NextResponse.json({
    location_id: location.location_id,
    location_name: location.name,
    latitude: location.latitude,
    longitude: location.longitude,
    bounding_box: location.bounding_box,
    primary_sensor: location.primary_sensor,
    before_scene: beforeScene || null,
    after_scene: afterScene || null,
    is_complete: Boolean(beforeScene && afterScene),
    available_dates: location.available_dates,
  });
}
