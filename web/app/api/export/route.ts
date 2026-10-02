import { NextRequest, NextResponse } from "next/server";
import { getLocationById, getChangeAnalysis } from "@/lib/data";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const format = body.format || "markdown";
    const timestamp = new Date().toISOString();

    // Check if this is a Live Analysis Export
    const liveAnalysis = body.live_analysis || body.analysis_result;
    if (liveAnalysis) {
      const aoi = body.aoi || liveAnalysis.aoi;
      const beforeScene = body.before_scene || liveAnalysis.scenes?.before || { sceneId: body.beforeSceneId || "N/A", acquisitionDate: "N/A" };
      const afterScene = body.after_scene || liveAnalysis.scenes?.after || { sceneId: body.afterSceneId || "N/A", acquisitionDate: "N/A" };
      const analystReviews: Record<string, { decision: string; notes?: string; timestamp?: string }> = body.analyst_reviews || {};
      const clusters = liveAnalysis.clusters || [];
      const change = liveAnalysis.change || {};
      const quality = liveAnalysis.quality || {};
      const provenance = liveAnalysis.provenance || {};

      const formatAoi = (b: any) => {
        if (!b) return "N/A";
        const minLat = b.min_lat ?? b.minLat ?? 0;
        const minLon = b.min_lon ?? b.minLon ?? 0;
        const maxLat = b.max_lat ?? b.maxLat ?? 0;
        const maxLon = b.max_lon ?? b.maxLon ?? 0;
        return `[${minLat.toFixed(4)}°N, ${minLon.toFixed(4)}°E] to [${maxLat.toFixed(4)}°N, ${maxLon.toFixed(4)}°E]`;
      };

      const temporalBaseline = liveAnalysis.temporalSeparationDays ?? (
        beforeScene.acquisitionDate && afterScene.acquisitionDate
          ? Math.round(Math.abs(new Date(afterScene.acquisitionDate).getTime() - new Date(beforeScene.acquisitionDate).getTime()) / 86400000)
          : "N/A"
      );

      const scientificDisclosure =
        "Live change classifications are explainable spectral heuristics derived from Sentinel-2 multispectral observations. Confidence scores are heuristic confidence indicators and are not calibrated probabilities. Analyst decisions are separate from automated detection.";

      if (format === "markdown") {
        const clusterRows = clusters.map((c: any) => {
          const review = analystReviews[c.clusterId] || { decision: "UNREVIEWED", notes: "" };
          const centroidStr = Array.isArray(c.centroid) ? `${c.centroid[0].toFixed(4)}°N, ${c.centroid[1].toFixed(4)}°E` : "N/A";
          return `| \`${c.clusterId}\` | **${c.changeClass}** | ${c.areaHa} ha (${c.areaM2 ? c.areaM2.toLocaleString() : c.pixelCount * 100} m²) | ${typeof c.confidenceScore === "number" ? c.confidenceScore.toFixed(2) : c.confidenceScore} | ${centroidStr} | \`${review.decision}\` | ${review.notes || "—"} |`;
        }).join("\n");

        const mdReport = `# TERRALENS AI — SATELLITE CHANGE ANALYSIS EVIDENCE REPORT
**Problem Statement:** SIH26227 (Smart India Hackathon 2026)  
**Export Date:** ${timestamp}  
**Workflow Engine:** Copernicus Sentinel-2 L2A Bi-Temporal Engine (Phase 4B/5A)  
**Provenance ID:** \`${provenance.provenanceId || "PROV-LIVE-ANALYSIS"}\`

---

## 1. ANALYSIS OVERVIEW
- **Target AOI:** ${formatAoi(aoi)}
- **Sensor:** Sentinel-2 MultiSpectral Instrument (MSI) Level-2A (Bottom of Atmosphere)
- **Before Scene (T1):** \`${beforeScene.sceneId}\` (${beforeScene.acquisitionDate?.split("T")[0] || "N/A"})
- **After Scene (T2):** \`${afterScene.sceneId}\` (${afterScene.acquisitionDate?.split("T")[0] || "N/A"})
- **Temporal Baseline:** ${temporalBaseline} days
- **Spatial Resolution:** ${change.resolutionMeters || 10}m Ground Sample Distance (GSD)

## 2. CHANGE DETECTION SUMMARY
- **Analysis Status:** ${liveAnalysis.status || "ANALYZED"}
- **Total AOI Evaluated Pixels:** ${(quality.totalPixels || 0).toLocaleString()}
- **Valid Surface Pixels:** ${(quality.validPixels || 0).toLocaleString()} (${quality.validPercentage || 100}%)
- **Suppressed / Masked (Cloud/Shadow):** ${(quality.maskedPixels || 0).toLocaleString()} pixels
- **Detected Changed Pixels:** ${(change.changedPixels || 0).toLocaleString()} px
- **Total Changed Area:** ${change.changedAreaHa || 0} ha (${change.changedAreaKm2 || 0} km²)
- **Spatial Clusters Extracted:** ${clusters.length} sites
- **Thresholding Strategy:** ${change.thresholdMethod || "Adaptive Statistical Distribution (mean + 1.8*std, clamped [0.15, 0.45])"} (Calculated Cutoff: ${change.threshold || "N/A"})
- **False Alarms Suppressed:** ${(change.falseAlarmsSuppressed || 0).toLocaleString()} pixels (Morphological open + min area filter)

## 3. SPATIAL CLUSTER ADJUDICATION TABLE
| Cluster ID | Classification | Area | Confidence Score | Centroid | Analyst Decision | Analyst Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
${clusterRows || "| *None* | *No change clusters detected above spectral threshold* | — | — | — | `UNREVIEWED` | — |"}

## 4. MULTI-TEMPORAL EVIDENCE
- **Pre-Event Acquisition:** Scene \`${beforeScene.sceneId}\`, Cloud Cover: ${beforeScene.cloudCoverPercentage ? beforeScene.cloudCoverPercentage.toFixed(1) + "%" : "N/A"}
- **Post-Event Acquisition:** Scene \`${afterScene.sceneId}\`, Cloud Cover: ${afterScene.cloudCoverPercentage ? afterScene.cloudCoverPercentage.toFixed(1) + "%" : "N/A"}
- **Spectral Feature Bands:** B04 (Red 665nm, 10m) & B08 (NIR 842nm, 10m) + SCL Quality (Scene Classification Layer)
- **Vector Polygons:** ${clusters.length} discrete GeoJSON polygon boundaries generated from 8-way connected components.

## 5. PROCESSING PROVENANCE CHAIN
1. **Source Registry:** Microsoft Planetary Computer / Copernicus Sentinel-2 STAC API.
2. **Analysis Assets:** Native Cloud-Optimized GeoTIFFs (COGs) accessed via HTTP 206 Byte-Range Subwindowing.
3. **Quality Masking:** SCL pixel screening (filtering clouds, cirrus, cloud shadows, and defective pixels).
4. **Radiometric Reconciliation:** Target band reflectance scaling and cross-epoch histogram contrast equalization.
5. **Spectral Differentiation:** Normalized Difference Vegetation Index (NDVI) and absolute reflectance distance calculation.
6. **Adaptive Filtering:** Automated threshold computation with false-alarm noise reduction.
7. **Spatial Clustering:** 8-connectivity connected components labeling with boundary tracing.
8. **Explainable Classification:** Multi-band heuristic attribution (construction, clearance, greening, water dynamics).
- **Execution Timestamp:** ${provenance.timestamp || timestamp}
- **Processing Chain:** ${(provenance.processingChain || []).join(" → ")}

## 6. SCIENTIFIC DISCLOSURE
> [!IMPORTANT]
> ${scientificDisclosure}

---
*Generated by TerraLens AI Intelligence Engine — Smart India Hackathon 2026*
`;

        return NextResponse.json({
          filename: `terralens_live_evidence_${provenance.provenanceId || Date.now()}.md`,
          format: "markdown",
          content: mdReport,
        });
      }

      // JSON Format for Live Evidence
      const jsonReport = {
        project: "TerraLens AI",
        sih_problem: "SIH26227",
        report_type: "LIVE_SATELLITE_CHANGE_ANALYSIS",
        export_timestamp: timestamp,
        overview: {
          aoi,
          sensor: "Sentinel-2 MSI L2A",
          before_scene: beforeScene,
          after_scene: afterScene,
          temporal_baseline_days: temporalBaseline,
          resolution_meters: change.resolutionMeters || 10,
        },
        change_summary: {
          status: liveAnalysis.status,
          quality,
          change_metrics: change,
          cluster_count: clusters.length,
        },
        cluster_adjudications: clusters.map((c: any) => {
          const review = analystReviews[c.clusterId] || { decision: "UNREVIEWED", notes: "" };
          return {
            cluster_id: c.clusterId,
            change_class: c.changeClass,
            area_ha: c.areaHa,
            area_m2: c.areaM2,
            confidence_score: c.confidenceScore,
            centroid: c.centroid,
            classification_rationale: c.classificationRationale,
            analyst_decision: review.decision,
            analyst_notes: review.notes || null,
          };
        }),
        evidence: {
          before_scene_id: beforeScene.sceneId,
          after_scene_id: afterScene.sceneId,
          clusters_geojson: liveAnalysis.geojson || null,
        },
        provenance,
        scientific_disclosure: scientificDisclosure,
      };

      return NextResponse.json({
        filename: `terralens_live_evidence_${provenance.provenanceId || Date.now()}.json`,
        format: "json",
        content: jsonReport,
      });
    }

    // Default Benchmark Location Export
    const locationId = body.location_id;
    const analystDecision = body.analyst_decision || body.verdict || "UNREVIEWED";
    const analystNotes = body.analyst_notes || "";

    if (!locationId) {
      return NextResponse.json({ error: "Field 'location_id' or 'live_analysis' is required" }, { status: 400 });
    }

    const location = getLocationById(locationId);
    const analysis = getChangeAnalysis(locationId);

    if (!location || !analysis) {
      return NextResponse.json({ error: `Location or analysis not found for: ${locationId}` }, { status: 404 });
    }

    if (format === "markdown") {
      const mdContent = `# TERRALENS AI — ANALYTICAL EVIDENCE DOSSIER
**Problem Statement:** SIH26227 (Smart India Hackathon 2026)  
**Export Date:** ${timestamp}  
**Analyst Verdict:** ${analystDecision === "UNREVIEWED" ? "UNREVIEWED (Pending Analyst Review)" : analystDecision}  

---

## 1. TARGET INFORMATION
- **Location ID:** \`${location.location_id}\`
- **Location Name:** ${location.name}
- **Description:** ${location.description}
- **Coordinates:** ${location.latitude.toFixed(4)}°N, ${location.longitude.toFixed(4)}°E
- **Sensor:** ${location.primary_sensor}

## 2. CHANGE DETECTION METRICS
- **Detection Status:** ${analysis.status}
- **Classification:** ${analysis.change_type}
- **Algorithm:** ${analysis.detector_label} (\`${analysis.detector_name}\`)
- **Changed Pixels:** ${analysis.changed_pixels.toLocaleString()} / ${analysis.total_pixels.toLocaleString()}
- **Change Ratio:** ${(analysis.change_ratio * 100).toFixed(2)}%
- **Analytical Confidence Score:** ${((analysis.confidence_score ?? 0) * 100).toFixed(1)}%
- **Extracted Change Regions:** ${analysis.change_regions?.length || 0} clusters

## 3. CONFIDENCE BREAKDOWN
- **Signal Contrast:** ${analysis.confidence_breakdown?.signal_contrast?.toFixed(3) ?? "N/A"}
- **Spatial Coherence:** ${analysis.confidence_breakdown?.spatial_coherence?.toFixed(3) ?? "N/A"}
- **Alignment Penalty:** ${analysis.confidence_breakdown?.alignment_penalty?.toFixed(3) ?? "0.000"}
- **Quality Penalty:** ${analysis.confidence_breakdown?.quality_penalty?.toFixed(3) ?? "0.000"}

## 4. AUDIT & PROVENANCE CHAIN
1. **Semantic Discovery:** CLIP ViT-B/32 query projection -> FAISS L2 Normalized Cosine Search.
2. **Temporal Alignment:** Spatial dimension verification -> Image alignment & resolution reconciliation.
3. **Radiometric Correction:** Global histogram contrast & illumination normalization.
4. **Differentiation:** Absolute luminance subtraction ($|T_2 - T_1|$).
5. **False-Alarm Suppression:** Morphological opening + Minimum region thresholding (20 px).
6. **Region Extraction:** 8-way connected components labeling with centroid computation.

## 5. ANALYST REVIEW
- **Verdict:** ${analystDecision}
- **Review Notes:** ${analystNotes || (analystDecision === "UNREVIEWED" ? "Pending analyst verification notes." : "Multi-temporal change signature evaluated by analyst.")}

## 6. SCIENTIFIC DISCLOSURE
> [!IMPORTANT]
> Controlled Benchmark Evaluation Mode. Evaluation against annotated ground-truth change masks.

---
*Generated by TerraLens AI Intelligence Engine — Smart India Hackathon 2026*
`;

      return NextResponse.json({
        filename: `terralens_dossier_${location.location_id}.md`,
        format: "markdown",
        content: mdContent,
      });
    }

    // Default JSON structure for benchmark location
    const jsonDossier = {
      project: "TerraLens AI",
      sih_problem: "SIH26227",
      export_timestamp: timestamp,
      adjudication: {
        verdict: analystDecision,
        notes: analystNotes || null,
        adjudicated: analystDecision !== "UNREVIEWED",
      },
      target: {
        location_id: location.location_id,
        name: location.name,
        description: location.description,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude,
        },
        bounding_box: location.bounding_box,
        sensor: location.primary_sensor,
      },
      detection_results: analysis,
      provenance: [
        { stage: "vector_retrieval", engine: "CLIP ViT-B/32 + Normalized Cosine Search" },
        { stage: "alignment", method: "Spatial Homography & Scale Check" },
        { stage: "radiometric_normalization", method: "Mean & Variance Contrast Equalization" },
        { stage: "difference_operator", method: "Absolute Luminance Subtraction" },
        { stage: "false_alarm_reduction", method: "Morphological Open + Min Component Filter (20px)" },
        { stage: "region_clustering", method: "8-connectivity Connected Component Labeling" },
      ],
      scientific_disclosure: "Controlled Benchmark Evaluation Mode. Evaluated against annotated ground truth.",
    };

    return NextResponse.json({
      filename: `terralens_dossier_${location.location_id}.json`,
      format: "json",
      content: jsonDossier,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Export failed", details: String(err) }, { status: 500 });
  }
}
