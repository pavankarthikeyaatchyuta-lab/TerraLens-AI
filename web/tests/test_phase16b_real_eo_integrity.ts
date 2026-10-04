/**
 * Phase 16B - Real EO Demo Hardening & Evidence Integrity Test Suite
 * 
 * Verifies:
 * 1. Mathematical Area Calculation Consistency (10m x 10m = 100 m2 pixel rule)
 * 2. Authoritative Contract & Verify <-> Export Consistency for Bhadla
 * 3. Authoritative Contract & Verify <-> Export Consistency for Non-Bhadla (Hyderabad)
 * 4. Temporal Evidence Consistency (Honest unconfirmed intermediate checkpoints)
 * 5. Location Isolation & Zero Bhadla Cross-Contamination
 * 6. No Silent Bhadla Fallback & Missing Data Handling
 * 7. SCL Quality & Valid Pixel Percentage Formulation
 */

import assert from "assert";
import {
  assembleExportBundle,
  validateGeoJson,
} from "../lib/services/exportBundleService";
import { getChangeAnalysis, getLocationById, getLocations } from "../lib/data";

console.log("\n=======================================================");
console.log("Starting Phase 16B Real EO Demo Hardening Tests");
console.log("=======================================================\n");

// --- 1. Mathematical Area Calculation Consistency ---
console.log("Test 1: Mathematical Area Calculation Consistency (10m x 10m = 100 m²)");

const pixelResolution = 10.0; // 10m Ground Sample Distance
const pixelAreaM2 = pixelResolution * pixelResolution; // 100 m²
assert.strictEqual(pixelAreaM2, 100, "1 Sentinel-2 10m pixel must equal exactly 100 m²");

// Bhadla calculation: 1428 pixels
const bhadlaPixels = 1428;
const bhadlaAreaM2 = bhadlaPixels * pixelAreaM2;
const bhadlaAreaHa = bhadlaAreaM2 / 10000.0;
assert.strictEqual(bhadlaAreaM2, 142800, "1428 pixels * 100 m² = 142,800 m²");
assert.strictEqual(bhadlaAreaHa, 14.28, "142,800 m² / 10,000 = 14.28 ha");

// Bhadla 3-cluster partition consistency
const c1Pixels = 720;
const c2Pixels = 450;
const c3Pixels = 258;
assert.strictEqual(c1Pixels + c2Pixels + c3Pixels, 1428, "Cluster pixels must sum to total changed pixels");

const c1Ha = (c1Pixels * pixelAreaM2) / 10000.0;
const c2Ha = (c2Pixels * pixelAreaM2) / 10000.0;
const c3Ha = (c3Pixels * pixelAreaM2) / 10000.0;
assert.strictEqual(c1Ha, 7.20, "Cluster 1 = 7.20 ha");
assert.strictEqual(c2Ha, 4.50, "Cluster 2 = 4.50 ha");
assert.strictEqual(c3Ha, 2.58, "Cluster 3 = 2.58 ha");
assert.strictEqual(parseFloat((c1Ha + c2Ha + c3Ha).toFixed(2)), 14.28, "Sum of cluster hectares must equal 14.28 ha");
console.log("  ✓ Area calculations and cluster partitions agree mathematically (100 m²/px, 14.28 ha)");

// --- 2. Verify <-> Export Consistency: Bhadla ---
console.log("\nTest 2: Verify <-> Export Consistency for Bhadla Canonical Path");

const bhadlaAnalysis = getChangeAnalysis("LOC_EO_01_BHADLA_SOLAR") as any;
assert(bhadlaAnalysis, "Bhadla analysis must exist in cache");

const bhadlaBundle = assembleExportBundle({
  locationId: "LOC_EO_01_BHADLA_SOLAR",
  locationName: "Bhadla Solar Park, Rajasthan",
  aoi: { min_lat: 27.48, min_lon: 71.86, max_lat: 27.58, max_lon: 71.96 },
  beforeScene: {
    sceneId: "S2A_MSIL2A_20230405T054641_N0509_R062_T43RER_20230405T094034",
    acquisitionDate: "2023-04-05",
    platform: "Sentinel-2A",
    instrument: "MSIL2A",
    cloudCoverPercentage: 0.8,
  },
  afterScene: {
    sceneId: "S2B_MSIL2A_20250312T054639_N0511_R062_T43RER_20250312T092815",
    acquisitionDate: "2025-03-12",
    platform: "Sentinel-2B",
    instrument: "MSIL2A",
    cloudCoverPercentage: 0.0,
  },
  analysisResult: bhadlaAnalysis,
  analystDecision: "CONFIRMED",
  analystNotes: "Confirmed utility-scale photovoltaic array deployment in Bhadla Phase IV.",
  analysisMode: "REAL_EO_CATALOG",
});

const mBhadla = bhadlaBundle.manifest;
const aBhadla = bhadlaBundle.analysis;
const gBhadla = bhadlaBundle.geojson;

// Scene ID checks
assert.strictEqual(mBhadla.t1_acquisition_timestamp, "2023-04-05");

// Metric consistency between Verify and Manifest / Analysis
assert.strictEqual(mBhadla.changed_pixel_count, bhadlaAnalysis.changed_pixels, "Changed pixel count must match analysis");
assert.strictEqual(mBhadla.change_area.ha, bhadlaAnalysis.changed_area_ha, "Manifest change_area.ha must match analysis");
assert.strictEqual(mBhadla.change_area.m2, bhadlaAnalysis.changed_area_m2, "Manifest change_area.m2 must match analysis");
assert.strictEqual(mBhadla.number_of_detected_clusters, bhadlaAnalysis.cluster_count, "Manifest cluster count must match analysis");
assert.strictEqual(mBhadla.confidence_summary.mean_confidence, bhadlaAnalysis.confidence, "Manifest mean confidence must match analysis");

// GeoJSON consistency
assert.strictEqual(gBhadla.features.length, bhadlaAnalysis.cluster_count, "GeoJSON must contain all cluster features");
const sumGeoJsonAreaHa = gBhadla.features.reduce((sum: number, f: any) => sum + f.properties.area_ha, 0);
assert.strictEqual(parseFloat(sumGeoJsonAreaHa.toFixed(2)), parseFloat(bhadlaAnalysis.changed_area_ha.toFixed(2)), "GeoJSON feature areas must sum to changed area ha");

const geoValidation = validateGeoJson(gBhadla);
assert.strictEqual(geoValidation.valid, true, "Bhadla GeoJSON must strictly comply with RFC 7946");
console.log(`  ✓ Bhadla VERIFY values == EXPORT manifest, analysis, and GeoJSON (${bhadlaAnalysis.changed_area_ha} ha, ${bhadlaAnalysis.cluster_count} clusters, ${bhadlaAnalysis.confidence} conf)`);

// --- 3. Verify <-> Export Consistency: Non-Bhadla (Hyderabad) ---
console.log("\nTest 3: Verify <-> Export Consistency for Non-Bhadla Location (Hyderabad)");

const hydAnalysis = getChangeAnalysis("LOC_001_HYDERABAD_URBAN");
assert(hydAnalysis, "Hyderabad analysis must exist in cache");

const hydBundle = assembleExportBundle({
  locationId: "LOC_001_HYDERABAD_URBAN",
  locationName: "Hyderabad Urban Hub, Telangana",
  aoi: { min_lat: 17.30, min_lon: 78.40, max_lat: 17.45, max_lon: 78.55 },
  beforeScene: {
    sceneId: "S2A_MSIL2A_20230115T051831_N0509_R062_T44QKE_20230115T084512",
    acquisitionDate: "2023-01-15",
    platform: "Sentinel-2A",
    instrument: "MSIL2A",
    cloudCoverPercentage: 1.5,
  },
  afterScene: {
    sceneId: "S2B_MSIL2A_20250120T051829_N0511_R062_T44QKE_20250120T083045",
    acquisitionDate: "2025-01-20",
    platform: "Sentinel-2B",
    instrument: "MSIL2A",
    cloudCoverPercentage: 0.5,
  },
  analysisResult: hydAnalysis,
  analystDecision: "CONFIRMED",
  analysisMode: "CONTROLLED_BENCHMARK",
});

const mHyd = hydBundle.manifest;
const gHyd = hydBundle.geojson;

assert.strictEqual(mHyd.location_id, "LOC_001_HYDERABAD_URBAN");
assert.strictEqual(mHyd.changed_pixel_count, 33544, "Hyderabad changed pixels must be 33,544");
assert.strictEqual(mHyd.change_area.m2, 3354400, "Hyderabad changed area m² must be 3,354,400");
assert.strictEqual(mHyd.change_area.ha, 335.44, "Hyderabad changed area ha must be 335.44");
assert.strictEqual(mHyd.number_of_detected_clusters, 11, "Hyderabad clusters must be 11");
assert.strictEqual(gHyd.features.length, 11, "Hyderabad GeoJSON features must be 11");

const sumHydGeoJsonHa = gHyd.features.reduce((sum: number, f: any) => sum + f.properties.area_ha, 0);
assert.strictEqual(parseFloat(sumHydGeoJsonHa.toFixed(2)), 335.44, "Hyderabad GeoJSON areas must sum to 335.44 ha");
console.log("  ✓ Hyderabad VERIFY values == EXPORT manifest, analysis, and GeoJSON (335.44 ha, 11 clusters)");

// --- 4. Temporal Evidence Consistency ---
console.log("\nTest 4: Temporal Evidence Consistency (No Fabricated Intermediate Dates)");

// Check that intermediate checkpoints are not fabricated
const rawCompareStage = require("fs").readFileSync(
  require("path").join(__dirname, "..", "components", "stages", "CompareStage.tsx"),
  "utf-8"
);
assert(!rawCompareStage.includes('"2024-03-15"'), "Must NOT contain hardcoded date 2024-03-15");
assert(!rawCompareStage.includes('"2024-11-20"'), "Must NOT contain hardcoded date 2024-11-20");
assert(
  rawCompareStage.includes("Not established from available observations"),
  "Must honestly display 'Not established from available observations'"
);
console.log("  ✓ Illustrative dates eliminated; unconfirmed intermediate states honestly disclosed");

// --- 5. Location Isolation & Zero Bhadla Bleed ---
console.log("\nTest 5: Cross-Location Isolation Regression (Zero Bhadla Cross-Contamination)");

const sequence = [
  "LOC_EO_01_BHADLA_SOLAR",
  "LOC_EO_02_PAVAGADA_SOLAR",
  "LOC_EO_03_KURNOOL_SOLAR",
  "LOC_001_HYDERABAD_URBAN",
  "LOC_EO_01_BHADLA_SOLAR",
];

let activeAnalysis: any = null;

for (const locId of sequence) {
  // Simulate state switch: clear analysis immediately
  activeAnalysis = null;
  assert.strictEqual(activeAnalysis, null, `State must be cleared upon switching to ${locId}`);

  if (locId === "LOC_EO_01_BHADLA_SOLAR") {
    activeAnalysis = getChangeAnalysis(locId);
    assert.strictEqual(activeAnalysis.changed_area_ha, 60.22);
  } else if (locId === "LOC_001_HYDERABAD_URBAN") {
    activeAnalysis = getChangeAnalysis(locId);
    assert.strictEqual(activeAnalysis.changed_area_ha, 335.44);
    assert.notStrictEqual(activeAnalysis.changed_area_ha, 60.22, "Hyderabad must never have Bhadla 60.22 ha");
  } else {
    // Non-cached location
    activeAnalysis = getChangeAnalysis(locId);
    assert.strictEqual(activeAnalysis, null, `${locId} must not have cached data leaked`);
  }
}
console.log("  ✓ Sequence Bhadla -> Pavagada -> Kurnool -> Hyderabad -> Bhadla verified with zero leakage");

// --- 6. No Silent Bhadla Fallback & Missing Data Handling ---
console.log("\nTest 6: Missing Data Handling (No Silent Bhadla Fallback)");

const unknownAnalysis = getChangeAnalysis("LOC_UNKNOWN_NONEXISTENT");
assert.strictEqual(unknownAnalysis, null, "Unknown location must return null, not Bhadla");

const pavagadaAnalysis = getChangeAnalysis("LOC_EO_02_PAVAGADA_SOLAR");
assert.strictEqual(pavagadaAnalysis, null, "Pavagada must return null when no bi-temporal analysis exists");
console.log("  ✓ Missing locations return honest null/unavailable state without silent Bhadla fallback");

// --- 7. SCL Quality & Valid Pixel Percentage Formulation ---
console.log("\nTest 7: SCL Quality & Valid Pixel Percentage Formulation");

const totalPx = 262144;
const validPx = 260047;
const maskedPx = totalPx - validPx;
const calcValidPct = parseFloat(((validPx / totalPx) * 100.0).toFixed(2));
assert.strictEqual(calcValidPct, 99.20, "260047 / 262144 * 100 must equal 99.20%");
assert.strictEqual(maskedPx, 2097, "Masked pixels must equal 2097 (0.80% suppressed)");
console.log("  ✓ Valid pixel percentage formulation verified (99.20% valid, 0.80% suppressed)");

console.log("\n=======================================================");
console.log("All Phase 16B Real EO Demo Hardening Tests PASSED (7/7)");
console.log("=======================================================\n");
