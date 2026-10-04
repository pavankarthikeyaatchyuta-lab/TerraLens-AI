import { NextRequest, NextResponse } from "next/server";
import { getLocationById, getScenes, getChangeAnalysis } from "@/lib/data";
import {
  assembleExportBundle,
  createZipArchive,
  validateGeoJson,
  ExportBundleOptions,
} from "@/lib/services/exportBundleService";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const format = (body.format || "markdown").toLowerCase();

    let bundleOptions: ExportBundleOptions;

    // Check if this is a Live / Real EO Analysis Export
    const liveAnalysis = body.live_analysis || body.analysis_result;
    if (liveAnalysis && (liveAnalysis.clusters || liveAnalysis.change || liveAnalysis.quality)) {
      const aoi = body.aoi || liveAnalysis.aoi;
      const rawBefore = body.before_scene || liveAnalysis.scenes?.before || {};
      const rawAfter = body.after_scene || liveAnalysis.scenes?.after || {};

      const beforeScene = {
        sceneId: rawBefore.sceneId || rawBefore.scene_id || body.beforeSceneId || liveAnalysis.before_scene_id || "N/A",
        acquisitionDate: rawBefore.acquisitionDate || rawBefore.acquisition_date || liveAnalysis.before_acquisition_date || "N/A",
        platform: rawBefore.platform || liveAnalysis.before?.platform || "Sentinel-2A",
        instrument: rawBefore.instrument || rawBefore.sensor || "MSIL2A",
        cloudCoverPercentage: rawBefore.cloudCoverPercentage ?? rawBefore.cloud_percentage ?? 0.8,
      };

      const afterScene = {
        sceneId: rawAfter.sceneId || rawAfter.scene_id || body.afterSceneId || liveAnalysis.after_scene_id || "N/A",
        acquisitionDate: rawAfter.acquisitionDate || rawAfter.acquisition_date || liveAnalysis.after_acquisition_date || "N/A",
        platform: rawAfter.platform || liveAnalysis.after?.platform || "Sentinel-2B",
        instrument: rawAfter.instrument || rawAfter.sensor || "MSIL2A",
        cloudCoverPercentage: rawAfter.cloudCoverPercentage ?? rawAfter.cloud_percentage ?? 0.0,
      };
      const analystReviews = body.analyst_reviews || {};
      const locationId = body.location_id || body.locationId || "LIVE_ANALYSIS_AOI";
      const locationName = body.location_name || body.locationName || locationId;

      bundleOptions = {
        locationId,
        locationName,
        aoi,
        beforeScene,
        afterScene,
        analysisResult: liveAnalysis,
        analystReviews,
        analystDecision: body.analyst_decision || body.verdict || "UNREVIEWED",
        analystNotes: body.analyst_notes || "",
        analysisMode: body.mode || "REAL_EO_CATALOG",
      };
    } else {
      // Benchmark Location Export
      const locationId = body.location_id || body.locationId;
      const analystDecision = body.analyst_decision || body.verdict || "UNREVIEWED";
      const analystNotes = body.analyst_notes || "";

      if (!locationId) {
        return NextResponse.json(
          { error: "Field 'location_id' or 'live_analysis' is required for export." },
          { status: 400 }
        );
      }

      const location = getLocationById(locationId);
      const analysis = getChangeAnalysis(locationId);

      if (!location || !analysis) {
        return NextResponse.json(
          { error: `Location or analysis not found for ID: ${locationId}` },
          { status: 404 }
        );
      }

      const allScenes = getScenes().filter((s) => s.location_id === location.location_id);
      const bScene = allScenes.find((s) => s.scene_id === location.before_scene_id) || allScenes[0];
      const aScene = allScenes.find((s) => s.scene_id === location.after_scene_id) || allScenes[1];

      bundleOptions = {
        locationId: location.location_id,
        locationName: location.name,
        locationDescription: location.description,
        aoi: location.bounding_box,
        beforeScene: {
          sceneId: bScene?.scene_id || location.before_scene_id || "T1_SCENE",
          acquisitionDate: bScene?.acquisition_date || "2023-04-05",
          instrument: bScene?.sensor || "Sentinel-2 MSI",
          platform: bScene?.platform || location.primary_sensor,
          cloudCoverPercentage: bScene?.cloud_percentage ?? 0,
        },
        afterScene: {
          sceneId: aScene?.scene_id || location.after_scene_id || "T2_SCENE",
          acquisitionDate: aScene?.acquisition_date || "2025-03-15",
          instrument: aScene?.sensor || "Sentinel-2 MSI",
          platform: aScene?.platform || location.primary_sensor,
          cloudCoverPercentage: aScene?.cloud_percentage ?? 0,
        },
        analysisResult: analysis,
        analystDecision,
        analystNotes,
        analysisMode: "CONTROLLED_BENCHMARK",
      };
    }

    // Assemble the complete standardized bundle
    const bundle = assembleExportBundle(bundleOptions);

    // Validate GeoJSON artifact
    const geoValidation = validateGeoJson(bundle.geojson);
    if (!geoValidation.valid) {
      console.warn("GeoJSON validation warning:", geoValidation.errors);
    }

    // Return format according to user request
    if (format === "zip" || format === "bundle_zip") {
      const zipBuffer = createZipArchive(bundle.files);
      const filename = `terralens_bundle_${bundle.analysisId}.zip`;
      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": String(zipBuffer.length),
        },
      });
    }

    if (format === "bundle") {
      const zipBuffer = createZipArchive(bundle.files);
      return NextResponse.json({
        analysis_id: bundle.analysisId,
        export_version: bundle.exportVersion,
        generated_at: bundle.generatedAt,
        manifest: bundle.manifest,
        analysis: bundle.analysis,
        provenance: bundle.provenance,
        geojson: bundle.geojson,
        readme: bundle.readme,
        files: bundle.files.map((f) => ({
          name: f.name,
          contentType: f.contentType,
          sizeBytes: typeof f.data === "string" ? Buffer.byteLength(f.data) : f.data.length,
        })),
        zip_base64: zipBuffer.toString("base64"),
        zip_filename: `terralens_bundle_${bundle.analysisId}.zip`,
      });
    }

    if (format === "geojson") {
      return NextResponse.json(bundle.geojson, {
        headers: {
          "Content-Type": "application/geo+json",
          "Content-Disposition": `attachment; filename="change_clusters_${bundle.analysisId}.geojson"`,
        },
      });
    }

    if (format === "json") {
      return NextResponse.json({
        filename: `terralens_analysis_${bundle.analysisId}.json`,
        format: "json",
        content: bundle.analysis,
        manifest: bundle.manifest,
        provenance: bundle.provenance,
      });
    }

    // Default: markdown operational report
    return NextResponse.json({
      filename: `terralens_report_${bundle.analysisId}.md`,
      format: "markdown",
      content: bundle.readme,
    });
  } catch (err: any) {
    console.error("[/api/export] Processing failed:", err);
    return NextResponse.json(
      { error: "Export failed", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}
