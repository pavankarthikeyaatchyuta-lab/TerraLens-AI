import { searchScenes } from "../lib/data";
import { resolveDynamicGeospatialEntities } from "../lib/liveLocationResolver";

async function testQuery(q: string) {
  console.log("==================================================");
  console.log("QUERY:", q);

  let dynamicLocations: any[] = [];
  try {
    const dyn = await resolveDynamicGeospatialEntities(q);
    dynamicLocations = dyn.locations;
    console.log(`Live OSM Entities Discovered: ${dynamicLocations.length}`);
    dynamicLocations.forEach((l) =>
      console.log(`  -> [OSM LIVE] ${l.name} (${l.latitude}, ${l.longitude})`)
    );
  } catch (e) {
    console.error("OSM error:", e);
  }

  const outcome = searchScenes(
    q,
    5,
    undefined,
    undefined,
    "real-eo",
    undefined,
    "location",
    undefined,
    dynamicLocations
  );

  console.log(`Ranked Results (${outcome.results.length} total):`);
  outcome.results.slice(0, 5).forEach((r) => {
    console.log(
      `  #${r.rank}: ${r.location.name} | Score: ${(r.similarity_score * 100).toFixed(1)}% | Coord: (${r.location.latitude.toFixed(2)}, ${r.location.longitude.toFixed(2)}) | Tags: ${r.location.tags?.slice(0, 3).join(", ")}`
    );
  });
}

async function runAll() {
  await testQuery("water park development in hyderabad");
  await testQuery("solar park development in Rajasthan");
  await testQuery("airports in mumbai");
  await testQuery("colleges in pune");
  await testQuery("new colleges built in farming lands");
}

runAll();
