import { NextRequest, NextResponse } from "next/server";
import { getSatelliteProvider } from "@/lib/providers";
import { normalizeBoundingBox, OperatingMode } from "@/lib/providers/satelliteProvider";
import { RasterAlignmentService } from "@/lib/services/rasterAlignmentService";

// Security: Enforce safe alphanumeric and standard delimiter scene ID format
const SAFE_SCENE_ID_REGEX = /^[A-Za-z0-9_\-\.\:\+]+$/;

export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a valid JSON object." },
        { status: 400 }
      );
    }

    const { beforeSceneId, afterSceneId, aoi, mode = "LIVE_PUBLIC_DATA" } = body;

    // 1. Validate Scene IDs
    if (
      !beforeSceneId ||
      typeof beforeSceneId !== "string" ||
      !SAFE_SCENE_ID_REGEX.test(beforeSceneId.trim())
    ) {
      return NextResponse.json(
        { error: "Invalid or malformed beforeSceneId provided." },
        { status: 400 }
      );
    }

    if (
      !afterSceneId ||
      typeof afterSceneId !== "string" ||
      !SAFE_SCENE_ID_REGEX.test(afterSceneId.trim())
    ) {
      return NextResponse.json(
        { error: "Invalid or malformed afterSceneId provided." },
        { status: 400 }
      );
    }

    const cleanBeforeId = beforeSceneId.trim();
    const cleanAfterId = afterSceneId.trim();

    if (cleanBeforeId === cleanAfterId) {
      return NextResponse.json(
        { error: "Before and After scenes must be distinct acquisitions." },
        { status: 400 }
      );
    }

    // 2. Validate AOI Bounding Box
    const normalizedAoi = normalizeBoundingBox(aoi);
    if (!normalizedAoi) {
      return NextResponse.json(
        { error: "A valid AOI bounding box is required for analysis preparation." },
        { status: 400 }
      );
    }

    // 3. Resolve Mode & Provider
    const validModes: OperatingMode[] = [
      "LIVE_PUBLIC_DATA",
      "CONTROLLED_BENCHMARK",
      "OFFLINE_RESEARCH",
    ];
    const targetMode: OperatingMode = validModes.includes(mode) ? mode : "LIVE_PUBLIC_DATA";
    const provider = getSatelliteProvider(targetMode);

    // 4. Retrieve Scenes in Parallel
    const [beforeScene, afterScene] = await Promise.all([
      provider.getScene(cleanBeforeId),
      provider.getScene(cleanAfterId),
    ]);

    if (!beforeScene) {
      return NextResponse.json(
        { error: `Before scene "${cleanBeforeId}" not found in provider archives.` },
        { status: 404 }
      );
    }

    if (!afterScene) {
      return NextResponse.json(
        { error: `After scene "${cleanAfterId}" not found in provider archives.` },
        { status: 404 }
      );
    }

    // 5. Discover Analysis Assets in Parallel
    const [beforeAssets, afterAssets] = await Promise.all([
      provider.getAnalysisAssets(cleanBeforeId, normalizedAoi),
      provider.getAnalysisAssets(cleanAfterId, normalizedAoi),
    ]);

    // 6. Perform Temporal Pair Validation, Spatial Alignment & Provenance Generation
    const preparation = RasterAlignmentService.validateAndPrepareAnalysis(
      beforeScene,
      afterScene,
      beforeAssets,
      afterAssets,
      normalizedAoi
    );

    return NextResponse.json(preparation);
  } catch (error: any) {
    console.error("[/api/satellite/prepare] Internal Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to prepare satellite analysis." },
      { status: 500 }
    );
  }
}
