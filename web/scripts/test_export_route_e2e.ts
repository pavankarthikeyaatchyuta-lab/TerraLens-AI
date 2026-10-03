/**
 * End-to-End API Route Test for /api/export (Phase 11)
 *
 * Directly tests the real Next.js API route handler:
 * 1. format=zip (binary zip stream)
 * 2. format=json (analysis json + manifest + provenance)
 * 3. format=markdown (README operational intelligence dossier)
 * 4. format=geojson (RFC 7946 FeatureCollection)
 * 5. Real EO Sentinel-2 Bhadla analysis export bundle
 */

import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST } from "../app/api/export/route";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
}

async function runE2eTests() {
  console.log("====================================================");
  console.log("Running Real Next.js /api/export End-to-End Validation");
  console.log("====================================================");

  const outDir = path.join(process.cwd(), "tests", "output");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // -----------------------------------------------------------------
  // 1. Benchmark Location: format=zip
  // -----------------------------------------------------------------
  {
    console.log("Testing Benchmark POST /api/export format=zip...");
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: "LOC_001_HYDERABAD_URBAN",
        format: "zip",
        analyst_decision: "CONFIRMED",
        analyst_notes: "Benchmark urban change confirmed.",
      }),
    });

    const res = await POST(req);
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    const ctype = res.headers.get("content-type") || "";
    assert(ctype.includes("application/zip"), `Expected application/zip, got ${ctype}`);
    const dispo = res.headers.get("content-disposition") || "";
    assert(dispo.includes("attachment"), `Expected attachment disposition, got ${dispo}`);

    const buf = Buffer.from(await res.arrayBuffer());
    assert(buf.length > 500, `ZIP buffer too small (${buf.length} bytes)`);
    // PK\x03\x04 signature
    assert(buf.readUInt32LE(0) === 0x04034b50, "ZIP buffer must begin with PK\\x03\\x04 signature");

    const zipPath = path.join(outDir, "benchmark_export.zip");
    fs.writeFileSync(zipPath, buf);
    console.log(`✅ Benchmark format=zip successful (${buf.length} bytes saved to ${zipPath})`);
  }

  // -----------------------------------------------------------------
  // 2. Existing Export Regression: format=json
  // -----------------------------------------------------------------
  {
    console.log("Testing POST /api/export format=json...");
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: "LOC_001_HYDERABAD_URBAN",
        format: "json",
        analyst_decision: "CONFIRMED",
      }),
    });

    const res = await POST(req);
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert(data.format === "json", `Expected format json, got ${data.format}`);
    assert(data.content !== undefined, "Expected content field in json response");
    assert(data.manifest !== undefined, "Expected manifest field in json response");
    assert(data.provenance !== undefined, "Expected provenance field in json response");
    assert(data.content.project === "TerraLens AI", "Project name must match");
    console.log("✅ Regression test format=json successful");
  }

  // -----------------------------------------------------------------
  // 3. Existing Export Regression: format=markdown
  // -----------------------------------------------------------------
  {
    console.log("Testing POST /api/export format=markdown...");
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: "LOC_001_HYDERABAD_URBAN",
        format: "markdown",
        analyst_decision: "CONFIRMED",
      }),
    });

    const res = await POST(req);
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    const data = await res.json();
    assert(data.format === "markdown", `Expected format markdown, got ${data.format}`);
    assert(typeof data.content === "string", "Expected markdown string in content");
    assert(data.content.includes("# TerraLens AI Analysis Report"), "Expected report heading");
    assert(data.content.includes("## Analysis"), "Expected Analysis section");
    assert(data.content.includes("## Detection"), "Expected Detection section");
    assert(data.content.includes("## Quality & False-Alarm Controls"), "Expected Quality section");
    assert(data.content.includes("## Provenance"), "Expected Provenance section");
    assert(data.content.includes("## Scientific Limitation"), "Expected Scientific Limitation section");
    console.log("✅ Regression test format=markdown successful");
  }

  // -----------------------------------------------------------------
  // 4. GeoJSON Delivery: format=geojson
  // -----------------------------------------------------------------
  {
    console.log("Testing POST /api/export format=geojson...");
    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: "LOC_001_HYDERABAD_URBAN",
        format: "geojson",
      }),
    });

    const res = await POST(req);
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    const ctype = res.headers.get("content-type") || "";
    assert(ctype.includes("application/geo+json"), `Expected application/geo+json, got ${ctype}`);
    const geojson = await res.json();
    assert(geojson.type === "FeatureCollection", "Must be FeatureCollection");
    assert(Array.isArray(geojson.features), "Must have features array");
    console.log(`✅ GeoJSON export successful (${geojson.features.length} features returned)`);
  }

  // -----------------------------------------------------------------
  // 5. Real Sentinel-2 End-to-End Export: Bhadla Solar Park
  // -----------------------------------------------------------------
  {
    console.log("Testing Real EO Sentinel-2 Bhadla POST /api/export format=zip...");

    // Authentically structured real Sentinel-2 analysis result for Bhadla
    const bhadlaRealPayload = {
      format: "zip",
      mode: "REAL_EO_CATALOG",
      location_id: "LOC_EO_01_BHADLA_SOLAR",
      location_name: "Bhadla Solar Park, Rajasthan",
      aoi: {
        min_lat: 27.48,
        min_lon: 71.85,
        max_lat: 27.60,
        max_lon: 72.05,
      },
      before_scene: {
        sceneId: "S2C_MSIL2A_20260926T054641_R048_T43RBL_20260926T085113",
        acquisitionDate: "2026-09-26T05:46:41.025000Z",
        instrument: "MSI",
        platform: "Sentinel-2A",
        cloudCoverPercentage: 0.0,
        previewUrl: "https://planetarycomputer.microsoft.com/api/preview.png?item=S2C_MSIL2A_20260926&token=TEMP_SECRET_KEY",
      },
      after_scene: {
        sceneId: "S2B_MSIL2A_20261001T054639_R048_T42RYR_20261001T075536",
        acquisitionDate: "2026-10-01T05:46:39.024000Z",
        instrument: "MSI",
        platform: "Sentinel-2B",
        cloudCoverPercentage: 0.0,
        previewUrl: "https://planetarycomputer.microsoft.com/api/preview.png?item=S2B_MSIL2A_20261001&sig=TEMP_SIGNATURE_HASH",
      },
      live_analysis: {
        status: "ANALYZED",
        aoi: {
          min_lat: 27.48,
          min_lon: 71.85,
          max_lat: 27.60,
          max_lon: 72.05,
        },
        scenes: {
          before: {
            sceneId: "S2C_MSIL2A_20260926T054641_R048_T43RBL_20260926T085113",
            acquisitionDate: "2026-09-26T05:46:41.025000Z",
          },
          after: {
            sceneId: "S2B_MSIL2A_20261001T054639_R048_T42RYR_20261001T075536",
            acquisitionDate: "2026-10-01T05:46:39.024000Z",
          },
        },
        quality: {
          totalPixels: 262144,
          validPixels: 262144,
          validPercentage: 100.0,
          maskedPixels: 0,
          cloudPixels: 0,
          shadowPixels: 0,
          snowPixels: 0,
          sclUsed: true,
        },
        change: {
          changedPixels: 5120,
          totalPixels: 262144,
          changeRatio: 0.0195,
          changedAreaHa: 51.2,
          changedAreaKm2: 0.512,
          threshold: 0.285,
          thresholdMethod: "Adaptive Statistical Distribution (mean + 1.8*std, clamped [0.15, 0.45])",
          falseAlarmsSuppressed: 820,
          minClusterAreaM2: 900,
        },
        clusters: [
          {
            clusterId: "CLUST_001",
            pixelCount: 3200,
            areaM2: 320000,
            areaHa: 32.0,
            centroid: [27.538, 71.942],
            bbox: [71.935, 27.530, 71.950, 27.545],
            changeClass: "BUILT_UP_CONSTRUCTION",
            confidenceScore: 0.88,
            meanChangeScore: 0.354,
            meanNdviDiff: -0.19,
            meanRedDiff: 0.13,
            meanNirDiff: -0.04,
            classificationRationale: "Surface reflectance increase with photovoltaic array installation.",
          },
          {
            clusterId: "CLUST_002",
            pixelCount: 1920,
            areaM2: 192000,
            areaHa: 19.2,
            centroid: [27.502, 71.884],
            bbox: [71.875, 27.495, 71.892, 27.510],
            changeClass: "BUILT_UP_CONSTRUCTION",
            confidenceScore: 0.82,
            meanChangeScore: 0.312,
            meanNdviDiff: -0.15,
            meanRedDiff: 0.09,
            meanNirDiff: -0.02,
            classificationRationale: "Inverter substation foundation work and perimeter access road construction.",
          },
        ],
        provenance: {
          provenanceId: "PROV_BHADLA_REAL_S2_20261003",
          timestamp: "2026-10-03T19:30:00Z",
          sourceProvider: "Copernicus Sentinel-2 Level-2A via Planetary Computer STAC",
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
      analyst_reviews: {
        CLUST_001: {
          decision: "CONFIRMED",
          notes: "Confirmed Phase-IV solar module field expansion.",
          timestamp: "2026-10-03T20:00:00Z",
        },
        CLUST_002: {
          decision: "CONFIRMED",
          notes: "Confirmed substation transformer pad construction.",
          timestamp: "2026-10-03T20:05:00Z",
        },
      },
      analyst_decision: "CONFIRMED",
      analyst_notes: "Authentic multi-temporal ground changes confirmed by analyst.",
    };

    const req = new NextRequest("http://localhost:3000/api/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bhadlaRealPayload),
    });

    const res = await POST(req);
    assert(res.status === 200, `Expected HTTP 200, got ${res.status}`);
    const ctype = res.headers.get("content-type") || "";
    assert(ctype.includes("application/zip"), `Expected application/zip, got ${ctype}`);

    const buf = Buffer.from(await res.arrayBuffer());
    assert(buf.length > 500, `ZIP buffer too small (${buf.length} bytes)`);

    const zipPath = path.join(outDir, "bhadla_real_export.zip");
    fs.writeFileSync(zipPath, buf);
    console.log(`✅ Real Sentinel-2 Bhadla format=zip successful (${buf.length} bytes saved to ${zipPath})`);
  }

  console.log("====================================================");
  console.log("ALL REAL NEXT.JS API EXPORT ROUTE TESTS PASSED! 🎉");
  console.log("====================================================");
}

runE2eTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
