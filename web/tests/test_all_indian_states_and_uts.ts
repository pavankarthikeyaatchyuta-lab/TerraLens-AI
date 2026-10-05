import { parseUserQuery, isLocationInRegion } from "../lib/queryParser";

console.log("=================================================");
console.log("TESTING ALL 28 STATES & 8 UNION TERRITORIES OF INDIA");
console.log("=================================================");

const ALL_28_STATES = [
  { name: "Andhra Pradesh", query: "solar parks in Andhra Pradesh", expectedRegion: "Andhra Pradesh" },
  { name: "Arunachal Pradesh", query: "forest canopy in Arunachal Pradesh", expectedRegion: "Arunachal Pradesh" },
  { name: "Assam", query: "floodplains in Assam", expectedRegion: "Assam" },
  { name: "Bihar", query: "agriculture near river in Bihar", expectedRegion: "Bihar" },
  { name: "Chhattisgarh", query: "coal mining in Hasdeo Chhattisgarh", expectedRegion: "Chhattisgarh" },
  { name: "Goa", query: "coastal port development in Goa", expectedRegion: "Goa" },
  { name: "Gujarat", query: "salt flats in Kutch Gujarat", expectedRegion: "Gujarat" },
  { name: "Haryana", query: "wheat fields in Haryana", expectedRegion: "Haryana" },
  { name: "Himachal Pradesh", query: "snow valleys in Himachal Pradesh", expectedRegion: "Himachal Pradesh" },
  { name: "Jharkhand", query: "mining clearance in Jharkhand", expectedRegion: "Jharkhand" },
  { name: "Karnataka", query: "solar arrays in Pavagada Karnataka", expectedRegion: "Karnataka" },
  { name: "Kerala", query: "rainforest corridor in Kerala", expectedRegion: "Kerala" },
  { name: "Madhya Pradesh", query: "sal forests in Madhya Pradesh", expectedRegion: "Madhya Pradesh" },
  { name: "Maharashtra", query: "urban growth in Maharashtra", expectedRegion: "Maharashtra" },
  { name: "Manipur", query: "floating phumdis in Manipur", expectedRegion: "Manipur" },
  { name: "Meghalaya", query: "living root bridges in Meghalaya", expectedRegion: "Meghalaya" },
  { name: "Mizoram", query: "bamboo forests in Mizoram", expectedRegion: "Mizoram" },
  { name: "Nagaland", query: "mountain ridges in Nagaland", expectedRegion: "Nagaland" },
  { name: "Odisha", query: "lagoon conservation in Odisha", expectedRegion: "Odisha" },
  { name: "Punjab", query: "crop harvesting grid in Punjab", expectedRegion: "Punjab" },
  { name: "Rajasthan", query: "solar park development in Rajasthan", expectedRegion: "Rajasthan" },
  { name: "Sikkim", query: "glaciers in Sikkim", expectedRegion: "Sikkim" },
  { name: "Tamil Nadu", query: "harbor breakwaters in Tamil Nadu", expectedRegion: "Tamil Nadu" },
  { name: "Telangana", query: "tech corridors in Telangana", expectedRegion: "Telangana" },
  { name: "Tripura", query: "rubber plantations in Tripura", expectedRegion: "Tripura" },
  { name: "Uttar Pradesh", query: "riverfront development in Uttar Pradesh", expectedRegion: "Uttar Pradesh" },
  { name: "Uttarakhand", query: "national park in Uttarakhand", expectedRegion: "Uttarakhand" },
  { name: "West Bengal", query: "mangroves in West Bengal", expectedRegion: "West Bengal" },
];

const ALL_8_UNION_TERRITORIES = [
  { name: "Andaman and Nicobar Islands", query: "coral reefs in Andaman and Nicobar", expectedRegion: "Andaman Nicobar" },
  { name: "Chandigarh", query: "urban planning in Chandigarh", expectedRegion: "Chandigarh" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", query: "coastal industries in Daman and Diu", expectedRegion: "Dadra Nagar Haveli Daman Diu" },
  { name: "Delhi", query: "riverfront institutions in Delhi", expectedRegion: "Delhi" },
  { name: "Jammu and Kashmir", query: "valley orchards in Jammu and Kashmir", expectedRegion: "Jammu Kashmir" },
  { name: "Ladakh", query: "high altitude lake in Ladakh", expectedRegion: "Ladakh" },
  { name: "Lakshadweep", query: "atolls in Lakshadweep", expectedRegion: "Lakshadweep" },
  { name: "Puducherry", query: "coastal promenade in Puducherry", expectedRegion: "Puducherry" },
];

console.log("\nVerifying 28 States:");
for (const state of ALL_28_STATES) {
  const parsed = parseUserQuery(state.query);
  if (!parsed.regionConstraint) {
    throw new Error(`Failed to recognize state: ${state.name} for query "${state.query}"`);
  }
  if (!parsed.regionConstraint.bbox) {
    throw new Error(`Missing bounding box for state: ${state.name}`);
  }
  console.log(`  ✓ ${state.name}: Matched [${parsed.regionConstraint.regionName}] -> bbox: [${parsed.regionConstraint.bbox.minLat}, ${parsed.regionConstraint.bbox.minLon}, ${parsed.regionConstraint.bbox.maxLat}, ${parsed.regionConstraint.bbox.maxLon}]`);
}

console.log("\nVerifying 8 Union Territories:");
for (const ut of ALL_8_UNION_TERRITORIES) {
  const parsed = parseUserQuery(ut.query);
  if (!parsed.regionConstraint) {
    throw new Error(`Failed to recognize Union Territory: ${ut.name} for query "${ut.query}"`);
  }
  if (!parsed.regionConstraint.bbox) {
    throw new Error(`Missing bounding box for Union Territory: ${ut.name}`);
  }
  console.log(`  ✓ ${ut.name}: Matched [${parsed.regionConstraint.regionName}] -> bbox: [${parsed.regionConstraint.bbox.minLat}, ${parsed.regionConstraint.bbox.minLon}, ${parsed.regionConstraint.bbox.maxLat}, ${parsed.regionConstraint.bbox.maxLon}]`);
}

// Nationwide India Check
console.log("\nVerifying Nationwide India Scope:");
const indiaParsed = parseUserQuery("deforestation in last 2 years across India");
if (!indiaParsed.regionConstraint || !indiaParsed.regionConstraint.regionName.includes("India")) {
  throw new Error("Failed to recognize Nationwide India scope");
}
console.log(`  ✓ India Nationwide: Matched [${indiaParsed.regionConstraint.regionName}] -> bbox: [${indiaParsed.regionConstraint.bbox?.minLat}, ${indiaParsed.regionConstraint.bbox?.minLon}, ${indiaParsed.regionConstraint.bbox?.maxLat}, ${indiaParsed.regionConstraint.bbox?.maxLon}]`);

console.log("\n=================================================");
console.log("ALL 28 STATES & 8 UNION TERRITORIES VERIFIED! 🇮🇳");
console.log("=================================================\n");
