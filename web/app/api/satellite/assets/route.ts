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

    const { sceneId, aoi, mode = "LIVE_PUBLIC_DATA" } = body;

    // 1. Scene ID validation
    if (!sceneId || typeof sceneId !== "string" || !SAFE_SCENE_ID_REGEX.test(sceneId.trim())) {
      return NextResponse.json(
        { error: "Invalid or malformed sceneId provided." },
        { status: 400 }
      );
    }

    const sanitizedSceneId = sceneId.trim();

    // 2. Validate Operating Mode
    const validModes: OperatingMode[] = [
      "LIVE_PUBLIC_DATA",
      "CONTROLLED_BENCHMARK",
      "OFFLINE_RESEARCH",
    ];
    const targetMode: OperatingMode = validModes.includes(mode) ? mode : "LIVE_PUBLIC_DATA";

    // 3. Normalize optional AOI
    const normalizedAoi = aoi ? normalizeBoundingBox(aoi) : null;

    // 4. Resolve satellite provider
    const provider = getSatelliteProvider(targetMode);

    // 5. Retrieve scene metadata
    const scene = await provider.getScene(sanitizedSceneId);
    if (!scene) {
      return NextResponse.json(
        { error: `Scene "${sanitizedSceneId}" not found in provider archives.` },
        { status: 404 }
      );
    }

    // 6. Discover all available assets and analysis-capable rasters
    const rawAssets = await provider.getSceneAssets(sanitizedSceneId);
    const analysisAssets = await provider.getAnalysisAssets(
      sanitizedSceneId,
      normalizedAoi || undefined
    );

    // 7. Segregate preview assets (UI thumbnails/overviews)
    const previewAssets: Array<{
      key: string;
      href: string;
      title?: string;
      type?: string;
      roles?: string[];
      isAnalysisCapable: false;
    }> = [];

    for (const [key, asset] of Object.entries(rawAssets)) {
      const isOverview =
        key === "rendered_preview" ||
        key === "thumbnail" ||
        key === "preview" ||
        asset.roles?.includes("overview") ||
        asset.roles?.includes("thumbnail") ||
        asset.type === "image/png" ||
        asset.type === "image/jpeg";

      if (isOverview) {
        previewAssets.push({
          key,
          href: asset.href,
          title: asset.title || key,
          type: asset.type,
          roles: asset.roles,
          isAnalysisCapable: false,
        });
      }
    }

    // 8. Compute AOI compatibility and subwindow if AOI provided
    let aoiCompatibility: any = null;
    if (normalizedAoi) {
      const subwindow = RasterAlignmentService.computeAoiSubwindow({
        sceneBbox: scene.bbox,
        aoi: normalizedAoi,
        resolutionMeters: analysisAssets[0]?.resolution || 10,
        rasterShape: analysisAssets[0]?.shape || [10980, 10980],
        affineTransform: analysisAssets[0]?.transform,
      });

      aoiCompatibility = {
        intersects: subwindow.width > 0 && subwindow.height > 0,
        aoi: normalizedAoi,
        intersectionBbox: subwindow.aoiBbox,
        subwindowPixels: {
          colOff: subwindow.colOff,
          rowOff: subwindow.rowOff,
          width: subwindow.width,
          height: subwindow.height,
        },
        estimatedSizeBytes: subwindow.estimatedSizeBytes,
        rangeAccessSupported: subwindow.rangeHeaderSupported,
      };
    }

    return NextResponse.json({
      sceneId: sanitizedSceneId,
      provider: provider.providerName,
      collection: scene.collection,
      acquisitionDate: scene.acquisitionDate,
      totalAssetsDiscovered: Object.keys(rawAssets).length,
      analysisAssetsCount: analysisAssets.length,
      previewAssetsCount: previewAssets.length,
      primaryAnalysisAsset: analysisAssets[0] || null,
      analysisAssets,
      previewAssets,
      rasterMetadata: {
        crs: analysisAssets[0]?.crs || "EPSG:32644",
        shape: analysisAssets[0]?.shape || [10980, 10980],
        primaryResolutionMeters: analysisAssets[0]?.resolution || 10,
        cogFormat: analysisAssets.some((a) => a.isCog),
      },
      aoiCompatibility,
    });
  } catch (error: any) {
    console.error("[/api/satellite/assets] Internal Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to discover satellite assets." },
      { status: 500 }
    );
  }
}
