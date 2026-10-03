/**
 * Targeted tests for TypeScript ChangeAnalysisEngine production path.
 *
 * Verifies SIH26227 requirements:
 * 1. SCL classes 0, 1, 3, 8, 9, 10, 11 are masked.
 * 2. Valid SCL classes 2, 4, 5, 6, 7 are retained.
 * 3. True 3x3 morphological closing closes internal region holes.
 * 4. 3x3 morphological opening eliminates isolated single-pixel sensor noise.
 * 5. Atmospheric qualityPenalty dampens confidence when scene is heavily masked.
 * 6. Seasonal phenology classification distinguishes dry dormancy from structural clearance.
 */

import { ChangeAnalysisEngine } from "../lib/services/changeAnalysisEngine";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
}

console.log("====================================================");
console.log("Running TypeScript ChangeAnalysisEngine Unit Tests");
console.log("====================================================");

// Test 1: SCL Masked Classes (0, 1, 3, 8, 9, 10, 11)
{
  const side = 10;
  const total = side * side;
  const raw1000 = new Uint16Array(total).fill(1000); // 0.10 reflectance

  // SCL masked classes across pixels
  const maskedClasses = [0, 1, 3, 8, 9, 10, 11];
  for (const sclClass of maskedClasses) {
    const sclArr = new Uint16Array(total).fill(sclClass);
    const result = ChangeAnalysisEngine.applyQualityMask({
      b_b04_raw: raw1000,
      b_b08_raw: raw1000,
      a_b04_raw: raw1000,
      a_b08_raw: raw1000,
      b_scl_raw: sclArr,
      a_scl_raw: sclArr,
      side,
    });

    assert(result.validCount === 0, `SCL class ${sclClass} must be completely masked (got validCount=${result.validCount})`);
    assert(result.qualityReport.validPercentage === 0.0, `SCL class ${sclClass} valid percentage must be 0%`);
  }
  console.log("✅ Test 1: SCL masked classes (0, 1, 3, 8, 9, 10, 11) correctly suppressed.");
}

// Test 2: Valid SCL Classes (2, 4, 5, 6, 7) Retained
{
  const side = 10;
  const total = side * side;
  const raw1000 = new Uint16Array(total).fill(1000); // 0.10 reflectance

  const validClasses = [2, 4, 5, 6, 7];
  for (const sclClass of validClasses) {
    const sclArr = new Uint16Array(total).fill(sclClass);
    const result = ChangeAnalysisEngine.applyQualityMask({
      b_b04_raw: raw1000,
      b_b08_raw: raw1000,
      a_b04_raw: raw1000,
      a_b08_raw: raw1000,
      b_scl_raw: sclArr,
      a_scl_raw: sclArr,
      side,
    });

    assert(result.validCount === total, `Valid SCL class ${sclClass} must be 100% retained (got validCount=${result.validCount})`);
    assert(result.qualityReport.validPercentage === 100.0, `Valid SCL class ${sclClass} valid percentage must be 100%`);
  }
  console.log("✅ Test 2: SCL valid classes (2, 4, 5, 6, 7) 100% retained.");
}

// Test 3: True 3x3 Morphological Closing (Internal Hole Filling)
{
  const side = 11;
  const mask = new Uint8Array(side * side).fill(1);
  // Introduce 1-pixel hole in center (5, 5)
  mask[5 * side + 5] = 0;

  const closed = ChangeAnalysisEngine.applyMorphology(mask, side, side);
  assert(closed[5 * side + 5] === 1, "True 3x3 morphological closing must fill 1-pixel internal void");
  console.log("✅ Test 3: True 3x3 closing fills internal void (verified closing bug fix).");
}

// Test 4: 3x3 Morphological Opening (Isolated Pixel Noise Rejection)
{
  const side = 15;
  const mask = new Uint8Array(side * side).fill(0);
  // Isolated 1-pixel noise spike at (7, 7)
  mask[7 * side + 7] = 1;

  const cleaned = ChangeAnalysisEngine.applyMorphology(mask, side, side);
  assert(cleaned[7 * side + 7] === 0, "Morphological opening must eliminate isolated 1-pixel noise spike");
  console.log("✅ Test 4: Morphological opening eliminates isolated 1-pixel sensor noise.");
}

// Test 5: Atmospheric Quality Penalty on Confidence
{
  const side = 20;
  const cleanedMask = new Uint8Array(side * side).fill(0);
  // 4x4 cluster = 16 pixels
  for (let r = 5; r < 9; r++) {
    for (let c = 5; c < 9; c++) {
      cleanedMask[r * side + c] = 1;
    }
  }

  const changeScore = new Float32Array(side * side).fill(0.40);
  const ndviDiff = new Float32Array(side * side).fill(-0.25);
  const redDiff = new Float32Array(side * side).fill(0.10);
  const nirDiff = new Float32Array(side * side).fill(-0.15);

  const aoi = { min_lon: 78.4, min_lat: 17.3, max_lon: 78.5, max_lat: 17.4 };

  // Scenario A: Pristine scene (validPercentage = 95%) -> penalty = 0.0
  const clustersClean = ChangeAnalysisEngine.extractClusters({
    cleanedMask,
    changeScore,
    ndviDiff,
    redDiff,
    nirDiff,
    side,
    aoi,
    resolutionMeters: 10,
    minClusterPixels: 9,
    validPercentage: 95.0,
  });

  // Scenario B: Degraded atmospheric scene (validPercentage = 40%) -> penalty = 0.15
  const clustersDegraded = ChangeAnalysisEngine.extractClusters({
    cleanedMask,
    changeScore,
    ndviDiff,
    redDiff,
    nirDiff,
    side,
    aoi,
    resolutionMeters: 10,
    minClusterPixels: 9,
    validPercentage: 40.0,
  });

  assert(clustersClean.length === 1, "Must extract 1 cluster in clean scene");
  assert(clustersDegraded.length === 1, "Must extract 1 cluster in degraded scene");
  assert(
    clustersClean[0].confidenceScore > clustersDegraded[0].confidenceScore,
    `Degraded scene confidence (${clustersDegraded[0].confidenceScore}) must be strictly lower than clean scene (${clustersClean[0].confidenceScore})`
  );
  console.log(`✅ Test 5: Atmospheric quality penalty verified (clean=${clustersClean[0].confidenceScore}, degraded=${clustersDegraded[0].confidenceScore}).`);
}

// Test 6: Seasonal Phenology Classification
{
  const side = 10;
  const cleanedMask = new Uint8Array(side * side).fill(0);
  for (let r = 2; r < 6; r++) {
    for (let c = 2; c < 6; c++) {
      cleanedMask[r * side + c] = 1;
    }
  }

  const changeScore = new Float32Array(side * side).fill(0.35);
  // Seasonal dormancy: NDVI drops -0.18, but Red and NIR surface reflectance do not indicate bare soil exposure
  const ndviDiff = new Float32Array(side * side).fill(-0.18);
  const redDiff = new Float32Array(side * side).fill(0.01);
  const nirDiff = new Float32Array(side * side).fill(-0.03);

  const aoi = { min_lon: 78.4, min_lat: 17.3, max_lon: 78.5, max_lat: 17.4 };

  const clusters = ChangeAnalysisEngine.extractClusters({
    cleanedMask,
    changeScore,
    ndviDiff,
    redDiff,
    nirDiff,
    side,
    aoi,
    resolutionMeters: 10,
    minClusterPixels: 9,
    validPercentage: 90.0,
  });

  assert(clusters.length === 1, "Must extract 1 cluster");
  assert(
    clusters[0].changeClass === "SEASONAL_PHENOLOGY / BROWNING",
    `Expected SEASONAL_PHENOLOGY / BROWNING, got ${clusters[0].changeClass}`
  );
  console.log(`✅ Test 6: Seasonal phenology correctly classified: ${clusters[0].changeClass}.`);
}

console.log("====================================================");
console.log("ALL 6 TYPESCRIPT PRODUCTION-PATH TESTS PASSED! 🎉");
console.log("====================================================");
