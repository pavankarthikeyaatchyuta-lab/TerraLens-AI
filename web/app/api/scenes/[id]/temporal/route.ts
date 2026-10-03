import { NextRequest, NextResponse } from "next/server";
import { getLocationById, getSceneById, getScenes, getEoLocations, getEoScenes } from "@/lib/data";
import { Scene } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const catalogParam = request.nextUrl.searchParams.get("catalog");
  const isRealEo =
    catalogParam === "real-eo" ||
    catalogParam === "real_eo" ||
    id.startsWith("LOC_EO_") ||
    id.startsWith("S2");

  let location = isRealEo
    ? (getEoLocations().find((l) => l.location_id === id) || getLocationById(id))
    : getLocationById(id);

  let targetScene: Scene | null = null;
  if (!location) {
    const scene = getSceneById(id);
    if (scene) {
      targetScene = scene;
      location = isRealEo
        ? (getEoLocations().find((l) => l.location_id === scene.location_id) || getLocationById(scene.location_id))
        : getLocationById(scene.location_id);
    }
  }

  if (!location) {
    return NextResponse.json(
      { error: `Location not found for identifier: ${id}` },
      { status: 404 }
    );
  }

  const allScenes = isRealEo
    ? getEoScenes().filter((s) => s.location_id === location.location_id)
    : getScenes().filter((s) => s.location_id === location.location_id);

  let beforeScene: Scene | null = location.before_scene_id ? (getSceneById(location.before_scene_id) || null) : (allScenes[0] || null);
  let afterScene: Scene | null = location.after_scene_id ? (getSceneById(location.after_scene_id) || null) : (allScenes[1] || null);

  // If a specific scene was queried directly, ensure it is represented
  if (targetScene) {
    beforeScene = targetScene;
    afterScene = allScenes.find((s) => s.scene_id !== targetScene?.scene_id) || null;
  }

  return NextResponse.json({
    catalog_mode: isRealEo ? "real-eo" : "benchmark",
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
