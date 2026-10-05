import { searchScenes } from "../lib/data";

console.log("=================================================");
console.log("RUNNING STRICT REGIONAL SEARCH VERIFICATION SUITE");
console.log("=================================================");

// Test 1: Query for solar parks in Rajasthan
const q1 = "solar park development in Rajasthan";
const res1 = searchScenes(q1, 5, null, undefined, "real-eo", undefined, "location");
console.log(`\nQuery 1: "${q1}"`);
console.log(`Total Results: ${res1.results.length}`);

let q1Pass = true;
res1.results.forEach((r, idx) => {
  const name = r.location?.name || "";
  const isRajasthan = name.toLowerCase().includes("rajasthan") || (r.location as any)?.region?.toLowerCase().includes("rajasthan");
  console.log(`  #${idx + 1}: ${name} (${(r.similarity_score * 100).toFixed(1)}%) -> ${isRajasthan ? "✅ IN RAJASTHAN" : "❌ OUT OF REGION"}`);
  if (!isRajasthan) q1Pass = false;
});

if (!q1Pass || res1.results.length === 0) {
  throw new Error("Test 1 Failed: Non-Rajasthan location returned for Rajasthan-only query!");
}
console.log("✅ Test 1 Passed: 100% of results are strictly within Rajasthan.");

// Test 2: Query with explicit "in only rajisthan"
const q2 = "solar park development in only rajisthan";
const res2 = searchScenes(q2, 5, null, undefined, "real-eo", undefined, "location");
console.log(`\nQuery 2: "${q2}"`);

let q2Pass = true;
res2.results.forEach((r, idx) => {
  const name = r.location?.name || "";
  const isRajasthan = name.toLowerCase().includes("rajasthan") || (r.location as any)?.region?.toLowerCase().includes("rajasthan");
  console.log(`  #${idx + 1}: ${name} (${(r.similarity_score * 100).toFixed(1)}%) -> ${isRajasthan ? "✅ IN RAJASTHAN" : "❌ OUT OF REGION"}`);
  if (!isRajasthan) q2Pass = false;
});

if (!q2Pass || res2.results.length === 0) {
  throw new Error("Test 2 Failed: Non-Rajasthan location returned for strict 'only rajisthan' query!");
}
console.log("✅ Test 2 Passed: Strict regional isolation strictly enforced.");

// Test 3: Absence of out-of-state solar parks
const disallowedIds = ["LOC_EO_02_PAVAGADA_SOLAR", "LOC_EO_03_KURNOOL_SOLAR", "LOC_EO_04_BENBAN_SOLAR", "LOC_001_HYDERABAD_URBAN"];
for (const r of [...res1.results, ...res2.results]) {
  if (disallowedIds.includes(r.location?.location_id || "")) {
    throw new Error(`Test 3 Failed: Disallowed location ${r.location?.location_id} leaked into results!`);
  }
}
console.log("\n✅ Test 3 Passed: Zero leakage of out-of-state facilities (Pavagada, Kurnool, Benban).");

console.log("\n=================================================");
console.log("ALL STRICT REGIONAL SEARCH TESTS PASSED! 🎉");
console.log("=================================================");
