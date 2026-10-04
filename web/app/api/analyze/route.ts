import { NextRequest, NextResponse } from "next/server";
import { getChangeAnalysis, getLocationById, getSceneById } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locationId = body.location_id;

    if (!locationId) {
      return NextResponse.json(
        { error: "Field 'location_id' is required" },
        { status: 400 }
      );
    }

    const location = getLocationById(locationId);
    if (!location) {
      return NextResponse.json(
        { error: `Location ${locationId} not found` },
        { status: 404 }
      );
    }

    const cached = getChangeAnalysis(locationId);
    if (cached) {
      // Ensure paths are web-accessible (/outputs/change_masks/...)
      const sanitizePath = (p?: string) => {
        if (!p) return undefined;
        const norm = p.replace(/\\/g, "/");
        if (norm.includes("outputs/change_masks")) {
          return "/outputs/change_masks/" + norm.split("/").pop();
        }
        return norm.startsWith("/") ? norm : "/" + norm;
      };

      return NextResponse.json({
        ...cached,
        analysis_mode: "precomputed_benchmark",
        mask_path: sanitizePath(cached.mask_path),
        heatmap_path: sanitizePath(cached.heatmap_path),
        overlay_path: sanitizePath(cached.overlay_path),
        location: {
          location_id: location.location_id,
          name: location.name,
          latitude: location.latitude,
          longitude: location.longitude,
          bounding_box: location.bounding_box,
        },
      });
    }

    // If not cached, return honest UNAVAILABLE state rather than fabricating results
    return NextResponse.json({
      status: "UNAVAILABLE",
      change_type: "Analysis Unavailable",
      detector_name: "DeterministicBiTemporalChangeDetector",
      detector_label: "Deterministic Bi-Temporal Baseline",
      message: "Analysis unavailable for selected observations",
      details: "Insufficient verified bi-temporal imagery cached for this target location.",
      changed_pixels: 0,
      total_pixels: 262144,
      change_ratio: 0.0,
      changed_area_m2: 0,
      changed_area_ha: 0,
      change_regions: [],
      clusters: [],
      cluster_count: 0,
      confidence_score: null,
      confidence: null,
      valid_pixel_count: 0,
      valid_pixel_percentage: "N/A",
      quality: {
        validPercentage: "N/A",
        status: "Insufficient valid observations",
      },
      alignment_status: "No observation pair available",
      location: {
        location_id: location.location_id,
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        bounding_box: location.bounding_box,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Analysis execution failed", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
