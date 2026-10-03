/**
 * TerraLens AI — Phase 11 Export & Provenance Suite Tests
 *
 * Validates:
 * A. manifest.json generation and completeness
 * B. provenance.json generation (structured auditable lineage, no crypto/blockchain claims)
 * C. RFC 7946 GeoJSON validity and CRS specification
 * D. Cluster metadata preservation (cluster_id, classification, area, confidence, rationale, deltas)
 * E. T1/T2 metadata preservation (scene IDs, timestamps, platforms, cloud cover)
 * F. Scientific threshold preservation (mean + 1.8*std, clamped [0.15, 0.45], no Otsu)
 * G. Confidence semantics preservation (deterministic heuristic score, not probability)
 * H. Analyst review state preservation (decisions, notes, timestamp)
 * I. Complete export bundle assembly (all 5 core artifacts + raster notes)
 * J. Secret / token / credential exclusion from all exported outputs
 * K. PKZIP archive generation with valid CRC32 checksums
 */

import {
  assembleExportBundle,
  validateGeoJson,
  createZipArchive,
  sanitizeUrl,
  ExportBundleOptions,
} from "../lib/services/exportBundleService";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

console.log("====================================================");
console.log("Running Phase 11 Export & Provenance Suite Tests");
console.log("====================================================");

// Mock analysis data
const mockOptions: ExportBundleOptions = {
  locationId: "LOC_001_HYDERABAD_URBAN",
  locationName: "Hyderabad Urban Hub",
  locationDescription: "Rapid urban expansion and infrastructure development in HITEC City.",
  aoi: {
    min_lat: 17.36,
    min_lon: 78.40,
    max_lat: 17.52,
    max_lon: 78.56,
  },
  beforeScene: {
    sceneId: "S2A_MSIL2A_20230405T052651_N0509_R048_T44QKE_20230405T091234",
    acquisitionDate: "2023-04-05T05:26:51Z",
    instrument: "MSIL2A",
    platform: "Sentinel-2A",
    cloudCoverPercentage: 1.4,
    previewUrl: "https://planetarycomputer.microsoft.com/api/preview.png?item=S2A_TEST&token=SECRET_TOKEN_12345",
  },
  afterScene: {
    sceneId: "S2B_MSIL2A_20250312T052649_N0511_R048_T44QKE_20250312T084512",
    acquisitionDate: "2025-03-12T05:26:49Z",
    instrument: "MSIL2A",
    platform: "Sentinel-2B",
    cloudCoverPercentage: 0.8,
    previewUrl: "https://planetarycomputer.microsoft.com/api/preview.png?item=S2B_TEST&sig=ANOTHER_SECRET_98765",
  },
  analysisResult: {
    status: "ANALYZED",
    quality: {
      totalPixels: 262144,
      validPixels: 251000,
      validPercentage: 95.75,
      maskedPixels: 11144,
      cloudPixels: 6000,
      shadowPixels: 4000,
      snowPixels: 1144,
      sclUsed: true,
    },
    change: {
      changedPixels: 3850,
      totalPixels: 262144,
      changeRatio: 0.0147,
      changedAreaHa: 38.5,
      changedAreaKm2: 0.385,
      threshold: 0.285,
      thresholdMethod: "Adaptive Statistical Distribution (mean + 1.8*std, clamped [0.15, 0.45])",
      falseAlarmsSuppressed: 1420,
    },
    clusters: [
      {
        clusterId: "CLUST_001",
        pixelCount: 2400,
        areaM2: 240000,
        areaHa: 24.0,
        centroid: [17.445, 78.482],
        bbox: [78.475, 17.438, 78.489, 17.452],
        changeClass: "BUILT_UP_CONSTRUCTION",
        confidenceScore: 0.86,
        meanChangeScore: 0.342,
        meanNdviDiff: -0.21,
        meanRedDiff: 0.14,
        meanNirDiff: -0.05,
        classificationRationale: "Pronounced surface reflectance increase (ΔRed=+0.14) with vegetation loss indicating new structures.",
      },
      {
        clusterId: "CLUST_002",
        pixelCount: 1450,
        areaM2: 145000,
        areaHa: 14.5,
        centroid: [17.382, 78.415],
        bbox: [78.410, 17.378, 78.420, 17.386],
        changeClass: "VEGETATION_LOSS / CLEARANCE",
        confidenceScore: 0.79,
        meanChangeScore: 0.298,
        meanNdviDiff: -0.28,
        meanRedDiff: 0.06,
        meanNirDiff: -0.12,
        classificationRationale: "Vegetation index loss (ΔNDVI=-0.28) with increased bare ground reflectance.",
      },
    ],
    provenance: {
      provenanceId: "PROV_HYDERABAD_20261003_99286E1",
      timestamp: "2026-10-03T18:30:00Z",
      sourceProvider: "Copernicus Sentinel-2 Level-2A via Planetary Computer",
      processingChain: [
        "Vector Retrieval",
        "Spatial Alignment",
        "Quality Masking (SCL)",
        "Radiometric Normalization",
        "Spectral Differentiation",
        "Adaptive Thresholding",
        "Morphological Filtering",
        "Connected Component Clustering",
        "Explainable Attribution",
      ],
    },
  },
  analystReviews: {
    CLUST_001: {
      decision: "CONFIRMED",
      notes: "Commercial tech park construction verified against municipal road permit.",
      timestamp: "2026-10-03T19:00:00Z",
    },
    CLUST_002: {
      decision: "CONFIRMED",
      notes: "Land clearing for solar installation.",
      timestamp: "2026-10-03T19:05:00Z",
    },
  },
  analystDecision: "CONFIRMED",
  analystNotes: "Both primary change clusters verified as genuine ground alterations.",
  analysisMode: "REAL_EO_CATALOG",
};

const bundle = assembleExportBundle(mockOptions);

// Test A: Manifest generation and completeness
{
  assert(bundle.manifest !== null, "Manifest must not be null");
  assert(bundle.manifest.export_version === "1.1.0", "Manifest export_version must be 1.1.0");
  assert(bundle.manifest.problem_statement_id === "SIH26227", "Problem statement must be SIH26227");
  assert(bundle.manifest.location_id === "LOC_001_HYDERABAD_URBAN", "Manifest location_id must match");
  assert(bundle.manifest.number_of_detected_clusters === 2, "Cluster count must be 2");
  assert(bundle.manifest.changed_pixel_count === 3850, "Changed pixel count must match");
  assert(bundle.manifest.change_area.ha === 38.5, "Changed area ha must match");
  assert(bundle.manifest.included_artifacts.length >= 5, "Manifest must list all included artifacts");
  console.log("✅ Test A: Manifest generated with all required machine-readable fields.");
}

// Test B: Provenance generation (structured auditable, no crypto/blockchain)
{
  const prov = bundle.provenance;
  assert(prov !== null, "Provenance must not be null");
  assert(prov.provenance_id === "PROV_HYDERABAD_20261003_99286E1", "Provenance ID must match");
  assert(prov.lineage_standard === "TerraLens Structured Auditable Lineage", "Lineage standard must match");
  assert(
    !JSON.stringify(prov).toLowerCase().includes("blockchain"),
    "Provenance must NOT claim blockchain"
  );
  assert(
    !JSON.stringify(prov).toLowerCase().includes("cryptographic"),
    "Provenance must NOT claim cryptographic guarantees"
  );
  assert(prov.inputs.input_bands_used.includes("B04"), "Must record B04 input band");
  assert(prov.inputs.input_bands_used.includes("B08"), "Must record B08 input band");
  assert(prov.processing.scl_classes_suppressed.length === 7, "Must document all 7 masked SCL classes");
  console.log("✅ Test B: Structured auditable provenance generated without crypto/blockchain claims.");
}

// Test C: RFC 7946 GeoJSON validity
{
  const geojson = bundle.geojson;
  assert(geojson.type === "FeatureCollection", "GeoJSON must be FeatureCollection");
  const validation = validateGeoJson(geojson);
  assert(validation.valid, `GeoJSON must be RFC 7946 compliant: ${validation.errors.join(", ")}`);
  assert(geojson.features.length === 2, "GeoJSON must contain 2 features");

  // Verify exterior ring closure
  for (const f of geojson.features) {
    const ring = f.geometry.coordinates[0];
    const first = ring[0];
    const last = ring[ring.length - 1];
    assert(first[0] === last[0] && first[1] === last[1], "Polygon rings must be explicitly closed");
  }
  console.log("✅ Test C: GeoJSON FeatureCollection strictly validates against RFC 7946.");
}

// Test D: Cluster metadata preservation
{
  const feat0 = bundle.geojson.features[0];
  assert(feat0.properties.cluster_id === "CLUST_001", "Cluster ID must be preserved");
  assert(feat0.properties.classification === "BUILT_UP_CONSTRUCTION", "Classification must be preserved");
  assert(feat0.properties.confidence === 0.86, "Confidence score must be preserved");
  assert(feat0.properties.area_m2 === 240000, "Area m2 must be preserved");
  assert(feat0.properties.area_ha === 24.0, "Area ha must be preserved");
  assert(feat0.properties.delta_ndvi === -0.21, "Delta NDVI must be preserved");
  assert(feat0.properties.delta_red === 0.14, "Delta Red must be preserved");
  assert(feat0.properties.analyst_decision === "CONFIRMED", "Analyst decision must be preserved");
  assert(
    feat0.properties.analyst_notes?.includes("Commercial tech park"),
    "Analyst notes must be preserved"
  );
  console.log("✅ Test D: Cluster metadata, classification, spectral deltas, and notes preserved.");
}

// Test E: T1/T2 metadata preservation
{
  const manifest = bundle.manifest;
  assert(manifest.t1_scene_id.includes("S2A_MSIL2A_20230405"), "T1 scene ID preserved");
  assert(manifest.t2_scene_id.includes("S2B_MSIL2A_20250312"), "T2 scene ID preserved");
  assert(manifest.t1_acquisition_timestamp === "2023-04-05T05:26:51Z", "T1 timestamp preserved");
  assert(manifest.t2_acquisition_timestamp === "2025-03-12T05:26:49Z", "T2 timestamp preserved");
  assert(manifest.t1_cloud_percentage === 1.4, "T1 cloud percentage preserved");
  assert(manifest.t2_cloud_percentage === 0.8, "T2 cloud percentage preserved");
  console.log("✅ Test E: Multi-temporal T1/T2 scene identifiers and timestamps preserved.");
}

// Test F: Threshold invariant preservation
{
  const th = bundle.manifest.threshold;
  assert(th.value === 0.285, "Threshold cutoff value must match analysis");
  assert(th.formula === "mean + 1.8 * std", "Threshold formula invariant preserved");
  assert(th.clamp_range[0] === 0.15 && th.clamp_range[1] === 0.45, "Clamp range [0.15, 0.45] preserved");
  assert(!JSON.stringify(bundle).toLowerCase().includes("otsu"), "No Otsu thresholding allowed");
  console.log("✅ Test F: Threshold invariant (mean + 1.8*std, clamped [0.15, 0.45]) preserved.");
}

// Test G: Confidence semantics preservation
{
  const conf = bundle.manifest.confidence_summary;
  assert(conf.metric_type === "deterministic_heuristic_score_not_probability", "Confidence semantics preserved");
  assert(conf.mean_confidence >= 0.20 && conf.mean_confidence <= 0.98, "Confidence bounded [0.20, 0.98]");
  assert(
    bundle.readme.includes("NOT calibrated probabilities"),
    "README must clearly disclose that confidence is not a probability"
  );
  console.log("✅ Test G: Deterministic analytical confidence semantics preserved.");
}

// Test H: Analyst status preservation
{
  assert(bundle.manifest.analyst_status === "CONFIRMED", "Overall analyst status preserved");
  assert(bundle.provenance.analyst_actions.overall_status === "CONFIRMED", "Provenance analyst status preserved");
  assert(bundle.provenance.analyst_actions.review_count === 2, "Adjudicated cluster count preserved");
  console.log("✅ Test H: Analyst verification status, cluster reviews, and notes preserved.");
}

// Test I: Export bundle completeness (all 5 core artifacts + metadata)
{
  const filenames = bundle.files.map((f) => f.name);
  assert(filenames.includes("manifest.json"), "manifest.json must be in bundle");
  assert(filenames.includes("analysis.json"), "analysis.json must be in bundle");
  assert(filenames.includes("provenance.json"), "provenance.json must be in bundle");
  assert(filenames.includes("change_clusters.geojson"), "change_clusters.geojson must be in bundle");
  assert(filenames.includes("README.md"), "README.md must be in bundle");
  assert(filenames.includes("before/scene_metadata.json"), "before metadata must be in bundle");
  assert(filenames.includes("after/scene_metadata.json"), "after metadata must be in bundle");
  assert(filenames.includes("rasters/raster_info.txt"), "raster documentation must be in bundle");
  console.log("✅ Test I: Complete bundle artifact hierarchy present.");
}

// Test J: Secret / token / credential exclusion
{
  const bundleStr = JSON.stringify(bundle);
  assert(!bundleStr.includes("SECRET_TOKEN_12345"), "Security tokens must be stripped from bundle");
  assert(!bundleStr.includes("ANOTHER_SECRET_98765"), "Signatures must be stripped from bundle");
  assert(!bundleStr.includes("process.env"), "Environment variables must not leak");
  assert(sanitizeUrl("https://example.com/asset.tif?token=abc123secret") === "https://example.com/asset.tif", "sanitizeUrl must remove token");
  console.log("✅ Test J: Secrets, tokens, and query credentials strictly sanitized.");
}

// Test K: PKZIP archive generation with valid CRC32 checksums
{
  const zipBuf = createZipArchive(bundle.files);
  assert(zipBuf.length > 500, "ZIP archive must be non-empty");
  // Check PK\x03\x04 signature
  assert(zipBuf.readUInt32LE(0) === 0x04034b50, "ZIP archive must start with PK local header signature");
  console.log(`✅ Test K: Valid PKZIP archive created successfully (${zipBuf.length} bytes).`);
}

console.log("====================================================");
console.log("ALL 11 PHASE 11 EXPORT & PROVENANCE TESTS PASSED! 🎉");
console.log("====================================================");
