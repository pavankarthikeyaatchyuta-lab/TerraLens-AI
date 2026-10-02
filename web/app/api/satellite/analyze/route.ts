import { NextRequest, NextResponse } from "next/server";
import { getSatelliteProvider } from "@/lib/providers";
import { normalizeBoundingBox, OperatingMode } from "@/lib/providers/satelliteProvider";
import { ChangeAnalysisEngine } from "@/lib/services/changeAnalysisEngine";

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

    const {
      beforeSceneId,
      afterSceneId,
      aoi,
      threshold,
      minClusterAreaM2,
      mode = "LIVE_PUBLIC_DATA",
    } = body;

    // 1. Input Validation: Scene IDs
    if (!beforeSceneId || typeof beforeSceneId !== "string" || !SAFE_SCENE_ID_REGEX.test(beforeSceneId.trim())) {
      return NextResponse.json(
        { error: "Invalid or malformed beforeSceneId provided." },
        { status: 400 }
      );
    }

    if (!afterSceneId || typeof afterSceneId !== "string" || !SAFE_SCENE_ID_REGEX.test(afterSceneId.trim())) {
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

    // 2. Input Validation: AOI Bounding Box
    const normalizedAoi = normalizeBoundingBox(aoi);
    if (!normalizedAoi) {
      return NextResponse.json(
        { error: "A valid AOI bounding box is required for change analysis." },
        { status: 400 }
      );
    }

    // 3. Operating Mode Resolution
    const validModes: OperatingMode[] = [
      "LIVE_PUBLIC_DATA",
      "CONTROLLED_BENCHMARK",
      "OFFLINE_RESEARCH",
    ];
    const targetMode: OperatingMode = validModes.includes(mode) ? mode : "LIVE_PUBLIC_DATA";
    const provider = getSatelliteProvider(targetMode);

    // 4. Retrieve Scenes and Analysis Assets
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

    const [beforeAssets, afterAssets] = await Promise.all([
      provider.getAnalysisAssets(cleanBeforeId, normalizedAoi),
      provider.getAnalysisAssets(cleanAfterId, normalizedAoi),
    ]);

    // Find B04 (Red) and B08 (NIR)
    const b_b04 = beforeAssets.find((a) => a.assetKey === "B04") || beforeAssets[0];
    const b_b08 = beforeAssets.find((a) => a.assetKey === "B08") || beforeAssets[1] || beforeAssets[0];
    const a_b04 = afterAssets.find((a) => a.assetKey === "B04") || afterAssets[0];
    const a_b08 = afterAssets.find((a) => a.assetKey === "B08") || afterAssets[1] || afterAssets[0];

    if (!b_b04 || !b_b08 || !a_b04 || !a_b08) {
      return NextResponse.json(
        { error: "Missing required quantitative analysis bands (B04 Red and B08 NIR)." },
        { status: 422 }
      );
    }

    const b_scl = beforeAssets.find((a) => a.assetKey === "SCL");
    const a_scl = afterAssets.find((a) => a.assetKey === "SCL");

    // 5. Execute Scientific Change Analysis Engine
    const result = await ChangeAnalysisEngine.runAnalysis({
      beforeScene,
      afterScene,
      aoi: normalizedAoi,
      beforeB04Url: b_b04.href,
      beforeB08Url: b_b08.href,
      afterB04Url: a_b04.href,
      afterB08Url: a_b08.href,
      beforeSclUrl: b_scl?.href,
      afterSclUrl: a_scl?.href,
      fixedThreshold: typeof threshold === "number" && !isNaN(threshold) ? threshold : undefined,
      minClusterAreaM2: typeof minClusterAreaM2 === "number" && !isNaN(minClusterAreaM2) ? minClusterAreaM2 : undefined,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[/api/satellite/analyze] Internal Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute satellite change analysis." },
      { status: 500 }
    );
  }
}
