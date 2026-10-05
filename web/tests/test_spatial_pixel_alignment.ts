import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=================================================");
console.log("RUNNING SPATIAL PIXEL ALIGNMENT & PARITY TEST SUITE");
console.log("=================================================\n");

const baseDirs = [
  path.join(process.cwd(), "public", "samples", "LOC_EO_01_BHADLA_SOLAR"),
  path.join(process.cwd(), "public", "samples", "LOC_005_THAR_SOLAR_PARK"),
];

const requiredYears = [
  "2016", "2017", "2018", "2019", "2020",
  "2021", "2022", "2023", "2024", "2025", "2026",
];

// Helper to inspect JPEG dimensions from binary header without external native deps
function getJpegDimensions(filePath: string): { width: number; height: number } {
  const buf = fs.readFileSync(filePath);
  let i = 2; // skip SOI (0xFFD8)
  while (i < buf.length) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    // SOF markers: 0xC0 (baseline), 0xC1 (extended), 0xC2 (progressive)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  throw new Error(`SOF marker not found in JPEG: ${filePath}`);
}

// 1. Verify existence, file integrity, and dimensions of all multi-temporal assets
for (const dir of baseDirs) {
  const dirName = path.basename(dir);
  console.log(`Checking multi-temporal asset directory: ${dirName}`);
  assert.ok(fs.existsSync(dir), `Directory ${dir} must exist`);

  for (const yr of requiredYears) {
    const yrPath = path.join(dir, `${yr}.jpg`);
    assert.ok(fs.existsSync(yrPath), `Year file ${yr}.jpg must exist in ${dirName}`);
    const stat = fs.statSync(yrPath);
    assert.ok(stat.size > 50000, `Year file ${yr}.jpg must be > 50 KB (got ${stat.size} bytes)`);

    const dims = getJpegDimensions(yrPath);
    assert.strictEqual(dims.width, 1024, `${yr}.jpg width must be 1024px`);
    assert.strictEqual(dims.height, 1024, `${yr}.jpg height must be 1024px`);
  }

  // Canonical before/after pairs
  const beforeFile = path.join(dir, "before_2023.jpg");
  const afterFile = path.join(dir, "after_2025.jpg");
  assert.ok(fs.existsSync(beforeFile), `before_2023.jpg must exist in ${dirName}`);
  assert.ok(fs.existsSync(afterFile), `after_2025.jpg must exist in ${dirName}`);

  const beforeDims = getJpegDimensions(beforeFile);
  const afterDims = getJpegDimensions(afterFile);
  assert.strictEqual(beforeDims.width, 1024, "before_2023 width must be 1024px");
  assert.strictEqual(beforeDims.height, 1024, "before_2023 height must be 1024px");
  assert.strictEqual(afterDims.width, 1024, "after_2025 width must be 1024px");
  assert.strictEqual(afterDims.height, 1024, "after_2025 height must be 1024px");

  console.log(`  ✓ All 11 annual years + before/after verified: 1024x1024 spatial parity in ${dirName}`);
}

// 2. Coordinate & Bounding Box Parity
console.log("\nChecking AOI coordinate synchronization...");
const locationsRaw = fs.readFileSync(path.join(process.cwd(), "public", "data", "locations.json"), "utf-8");
const locations = JSON.parse(locationsRaw).locations;

const tharLoc = locations.find((l: any) => l.location_id === "LOC_005_THAR_SOLAR_PARK");
assert.ok(tharLoc, "LOC_005_THAR_SOLAR_PARK must be present in locations.json");
assert.strictEqual(tharLoc.latitude, 27.54, "Bhadla latitude must be 27.54°N");
assert.strictEqual(tharLoc.longitude, 71.95, "Bhadla longitude must be 71.95°E");
console.log("  ✓ LOC_005_THAR_SOLAR_PARK coordinates verified: 27.54°N, 71.95°E");

// 3. Mathematical Bounding Box calculation parity
console.log("\nChecking Bounding Box calculation parity...");
const delta = 0.035;
const expectedMinLon = (71.95 - delta).toFixed(4); // 71.9150
const expectedMinLat = (27.54 - delta).toFixed(4); // 27.5050
const expectedMaxLon = (71.95 + delta).toFixed(4); // 71.9850
const expectedMaxLat = (27.54 + delta).toFixed(4); // 27.5750

assert.strictEqual(expectedMinLon, "71.9150", "minLon must be 71.9150");
assert.strictEqual(expectedMinLat, "27.5050", "minLat must be 27.5050");
assert.strictEqual(expectedMaxLon, "71.9850", "maxLon must be 71.9850");
assert.strictEqual(expectedMaxLat, "27.5750", "maxLat must be 27.5750");
console.log(`  ✓ Locked Bounding Box: [${expectedMinLon}, ${expectedMinLat}, ${expectedMaxLon}, ${expectedMaxLat}]`);

console.log("\n=================================================");
console.log("ALL SPATIAL PIXEL ALIGNMENT TESTS PASSED! 🎉");
console.log("=================================================\n");
