import { searchScenes } from "../lib/data";

console.log("=================================================");
console.log("RUNNING SEARCH QUERY RELEVANCE VERIFICATION SUITE");
console.log("=================================================");

// Test 1: Education + Agriculture query ("new colleges built in farming lands")
// MUST NOT rank solar parks or desert installations in top results.
const q1 = "new colleges built in farming lands";
const res1 = searchScenes(q1, 5, undefined, undefined, "real-eo");

console.log(`\nQuery 1: "${q1}"`);
res1.results.forEach((r) => {
  console.log(`  #${r.rank}: ${r.location.name} (${(r.similarity_score * 100).toFixed(1)}%) -> Tags: ${r.location.tags?.slice(0, 3).join(", ")}`);
});

const top1 = res1.results[0];
const topSolar = res1.results.some((r) => r.location.name.toLowerCase().includes("solar") || r.location.location_id.toLowerCase().includes("solar"));
if (topSolar) {
  throw new Error(`Test 1 Failed: Solar park leaked into results for education/agriculture query "${q1}"`);
}
console.log("✅ Test 1 Passed: Zero solar park leakage for education/agriculture query.");

// Test 2: Solar query in Rajasthan
const q2 = "solar park development in Rajasthan";
const res2 = searchScenes(q2, 3, undefined, undefined, "real-eo");
console.log(`\nQuery 2: "${q2}"`);
res2.results.forEach((r) => {
  console.log(`  #${r.rank}: ${r.location.name} (${(r.similarity_score * 100).toFixed(1)}%)`);
});

if (!res2.results[0].location.name.toLowerCase().includes("solar")) {
  throw new Error(`Test 2 Failed: Solar park not ranked #1 for query "${q2}"`);
}
console.log("✅ Test 2 Passed: Bhadla / Rajasthan solar parks correctly ranked #1.");

// Test 3: Farming lands to dry lands
const q3 = "farming lands to dry lands";
const res3 = searchScenes(q3, 3, undefined, undefined, "real-eo");
console.log(`\nQuery 3: "${q3}"`);
res3.results.forEach((r) => {
  console.log(`  #${r.rank}: ${r.location.name} (${(r.similarity_score * 100).toFixed(1)}%)`);
});

const hasAgri = res3.results.some((r) => r.location.tags?.some((t) => t.includes("agri") || t.includes("farm") || t.includes("crop")));
if (!hasAgri) {
  throw new Error(`Test 3 Failed: Farmland locations not found for query "${q3}"`);
}
console.log("✅ Test 3 Passed: Agricultural / farmland locations correctly prioritized.");

console.log("\n=================================================");
console.log("ALL SEARCH QUERY RELEVANCE TESTS PASSED! 🎉");
console.log("=================================================\n");
