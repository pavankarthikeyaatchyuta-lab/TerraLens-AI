export interface RegionConstraint {
  regionName: string;
  isStrict: boolean;
  bbox?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  };
  aliases: string[];
}

export interface ParsedQuery {
  rawQuery: string;
  normalizedQuery: string;
  semanticTokens: string[];
  category: "solar" | "water" | "urban" | "forest" | "coastal" | "agriculture" | "general";
  regionConstraint: RegionConstraint | null;
  wantsLiveOnly: boolean;
}

// Bounding boxes and aliases for Indian states and prominent global regions
const REGION_REGISTRY: Record<string, { bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number }; aliases: string[] }> = {
  mumbai: {
    bbox: { minLat: 18.8, maxLat: 19.35, minLon: 72.7, maxLon: 73.15 },
    aliases: ["mumbai", "nhava sheva", "jnpt", "navi mumbai", "thane", "bombay"],
  },
  pune: {
    bbox: { minLat: 18.35, maxLat: 18.7, minLon: 73.7, maxLon: 74.05 },
    aliases: ["pune", "poona", "pcmc"],
  },
  hyderabad: {
    bbox: { minLat: 17.2, maxLat: 17.6, minLon: 78.2, maxLon: 78.6 },
    aliases: ["hyderabad", "hitec city", "secunderabad", "cyberabad", "gachibowli"],
  },
  bengaluru: {
    bbox: { minLat: 12.75, maxLat: 13.2, minLon: 77.4, maxLon: 77.85 },
    aliases: ["bengaluru", "bangalore", "electronic city", "whitefield"],
  },
  rajasthan: {
    bbox: { minLat: 23.05, maxLat: 30.55, minLon: 69.45, maxLon: 78.45 },
    aliases: ["rajasthan", "rajisthan", "jodhpur", "jaisalmer", "bikaner", "phalodi", "pokhran", "thar"],
  },
  telangana: {
    bbox: { minLat: 15.8, maxLat: 19.9, minLon: 77.2, maxLon: 81.8 },
    aliases: ["telangana", "warangal", "nizamabad", "karimnagar"],
  },
  maharashtra: {
    bbox: { minLat: 15.6, maxLat: 22.1, minLon: 72.6, maxLon: 80.9 },
    aliases: ["maharashtra", "nagpur", "nashik", "aurangabad", "vidarbha"],
  },
  karnataka: {
    bbox: { minLat: 11.5, maxLat: 18.5, minLon: 74.0, maxLon: 78.6 },
    aliases: ["karnataka", "pavagada", "mysuru", "mangalore"],
  },
  tamil_nadu: {
    bbox: { minLat: 8.0, maxLat: 13.6, minLon: 76.2, maxLon: 80.4 },
    aliases: ["tamil nadu", "tamilnadu", "chennai", "coimbatore", "madurai"],
  },
  andhra_pradesh: {
    bbox: { minLat: 12.6, maxLat: 19.9, minLon: 76.7, maxLon: 84.8 },
    aliases: ["andhra", "andhra pradesh", "kurnool", "visakhapatnam", "vizag", "godavari"],
  },
  assam: {
    bbox: { minLat: 24.1, maxLat: 28.2, minLon: 89.7, maxLon: 96.1 },
    aliases: ["assam", "guwahati", "brahmaputra", "kaziranga"],
  },
  west_bengal: {
    bbox: { minLat: 21.5, maxLat: 27.3, minLon: 85.8, maxLon: 89.9 },
    aliases: ["bengal", "west bengal", "kolkata", "hooghly", "sundarbans"],
  },
  delhi: {
    bbox: { minLat: 28.4, maxLat: 28.9, minLon: 76.8, maxLon: 77.4 },
    aliases: ["delhi", "new delhi", "yamuna", "ncr"],
  },
  uttar_pradesh: {
    bbox: { minLat: 23.8, maxLat: 30.5, minLon: 77.0, maxLon: 84.7 },
    aliases: ["uttar pradesh", "up", "varanasi", "lucknow", "noida", "kanpur", "ayodhya"],
  },
  kerala: {
    bbox: { minLat: 8.2, maxLat: 12.8, minLon: 74.8, maxLon: 77.5 },
    aliases: ["kerala", "kochi", "cochin", "thiruvananthapuram", "trivandrum"],
  },
  odisha: {
    bbox: { minLat: 17.8, maxLat: 22.6, minLon: 81.4, maxLon: 87.5 },
    aliases: ["odisha", "orissa", "bhubaneswar", "puri", "cuttack", "paradeep"],
  },
  gujarat: {
    bbox: { minLat: 20.1, maxLat: 24.7, minLon: 68.1, maxLon: 74.5 },
    aliases: ["gujarat", "kutch", "mundra", "narmada", "ahmedabad", "surat"],
  },
  punjab: {
    bbox: { minLat: 29.5, maxLat: 32.5, minLon: 73.8, maxLon: 76.9 },
    aliases: ["punjab", "ludhiana", "amritsar", "sangrur"],
  },
  haryana: {
    bbox: { minLat: 27.6, maxLat: 30.9, minLon: 74.4, maxLon: 77.6 },
    aliases: ["haryana", "gurugram", "karnal"],
  },
  chhattisgarh: {
    bbox: { minLat: 17.75, maxLat: 24.1, minLon: 80.25, maxLon: 84.4 },
    aliases: ["chhattisgarh", "hasdeo", "raipur", "bilaspur", "korba"],
  },
  uttarakhand: {
    bbox: { minLat: 28.7, maxLat: 31.5, minLon: 77.5, maxLon: 81.1 },
    aliases: ["uttarakhand", "corbett", "dehradun", "haridwar", "nainital", "shivalik"],
  },
  madhya_pradesh: {
    bbox: { minLat: 21.3, maxLat: 26.9, minLon: 74.0, maxLon: 82.8 },
    aliases: ["madhya pradesh", "mp", "bhopal", "indore", "jabalpur"],
  },
  jharkhand: {
    bbox: { minLat: 21.9, maxLat: 25.3, minLon: 83.3, maxLon: 87.9 },
    aliases: ["jharkhand", "ranchi", "dhanbad", "jamshedpur"],
  },
  jammu_kashmir: {
    bbox: { minLat: 32.2, maxLat: 37.1, minLon: 73.4, maxLon: 80.5 },
    aliases: ["kashmir", "jammu", "srinagar", "ladakh", "siachen"],
  },
  egypt: {
    bbox: { minLat: 21.9, maxLat: 31.7, minLon: 24.7, maxLon: 36.9 },
    aliases: ["egypt", "aswan", "benban", "nile"],
  },
  brazil: {
    bbox: { minLat: -34.0, maxLat: 5.5, minLon: -74.0, maxLon: -34.5 },
    aliases: ["brazil", "brasil", "amazon", "amazonas", "rondonia", "south america"],
  },
  usa: {
    bbox: { minLat: 24.5, maxLat: 49.5, minLon: -125.0, maxLon: -66.5 },
    aliases: ["usa", "united states", "america", "colorado", "nevada", "arizona"],
  },
  uae: {
    bbox: { minLat: 22.5, maxLat: 26.5, minLon: 51.5, maxLon: 56.5 },
    aliases: ["uae", "emirates", "dubai", "abu dhabi"],
  },
  singapore: {
    bbox: { minLat: 1.15, maxLat: 1.48, minLon: 103.6, maxLon: 104.05 },
    aliases: ["singapore", "jurong"],
  },
  netherlands: {
    bbox: { minLat: 50.7, maxLat: 53.7, minLon: 3.3, maxLon: 7.3 },
    aliases: ["netherlands", "holland", "rotterdam"],
  },
  india: {
    bbox: { minLat: 6.5, maxLat: 37.5, minLon: 68.0, maxLon: 97.5 },
    aliases: ["india", "indian", "bharat", "hindustan"],
  },
};

/**
 * Parses user search query to dynamically detect:
 * 1. Intent topic/category (e.g. solar, river, forest, port)
 * 2. Explicit or strict geographic constraints (e.g. "in Rajasthan", "only in Rajasthan", "in India")
 * 3. Spatial bounding box for strict spatial isolation
 */
export function parseUserQuery(rawQuery: string): ParsedQuery {
  const normalized = (rawQuery || "").toLowerCase().trim();

  // Strip temporal expressions when doing spatial/regional matching
  const cleanedForSpatial = normalized
    .replace(/\b(?:in\s+)?(?:the\s+)?(?:last|past)\s+\d+\s*(?:years?|months?|days?|decade)\b/gi, "")
    .replace(/\b(?:in\s+)?recent\s*(?:years?|months?)\b/gi, "")
    .replace(/\b(?:in\s+)?20\d\d(?:\s*-\s*20\d\d)?\b/gi, "")
    .trim();

  const tokens = normalized.split(/[\s,;]+/).filter((t) => t.length > 1);

  // 1. Detect Category
  let category: ParsedQuery["category"] = "general";
  const solarWords = ["solar", "photovoltaic", "pv", "sun", "clean energy", "renewable", "megawatt", "gw"];
  const waterWords = ["river", "riverfront", "lake", "reservoir", "water", "dam", "canal", "estuary", "stream", "lagoon"];
  const urbanWords = ["college", "colleges", "university", "campus", "city", "urban", "expansion", "highway", "road"];
  const forestWords = ["forest", "trees", "woodland", "corridor", "jungles", "rainforest", "deforestation", "canopy", "clearing", "timber"];
  const coastalWords = ["port", "coastal", "harbor", "ocean", "pier", "marine", "dock"];

  if (solarWords.some((w) => normalized.includes(w))) {
    category = "solar";
  } else if (waterWords.some((w) => normalized.includes(w))) {
    category = "water";
  } else if (urbanWords.some((w) => normalized.includes(w))) {
    category = "urban";
  } else if (forestWords.some((w) => normalized.includes(w))) {
    category = "forest";
  } else if (coastalWords.some((w) => normalized.includes(w))) {
    category = "coastal";
  }

  // 2. Detect Strict Spatial / Regional Constraints
  let detectedRegionKey: string | null = null;
  let isStrict = false;

  for (const [key, reg] of Object.entries(REGION_REGISTRY)) {
    const hasAlias = reg.aliases.some((alias) => {
      const aliasPattern = new RegExp(`\\b${alias}\\b`, "i");
      return aliasPattern.test(cleanedForSpatial) || aliasPattern.test(normalized);
    });

    if (hasAlias) {
      detectedRegionKey = key;

      // Check for explicit "only in", "in only", "strictly in", "within", or preposition "in [region]"
      const strictPatterns = [
        new RegExp(`only\\s+(?:in\\s+)?(?:${reg.aliases.join("|")})`, "i"),
        new RegExp(`in\\s+only\\s+(?:${reg.aliases.join("|")})`, "i"),
        new RegExp(`(?:${reg.aliases.join("|")})\\s+only`, "i"),
        new RegExp(`(?:in|within|inside|of|across)\\s+(?:${reg.aliases.join("|")})`, "i"),
      ];

      if (
        strictPatterns.some((p) => p.test(cleanedForSpatial)) ||
        strictPatterns.some((p) => p.test(normalized))
      ) {
        isStrict = true;
      } else {
        // If the query mentions a specific region name, default to strict geographic scope
        isStrict = true;
      }
      break;
    }
  }

  let regionConstraint: RegionConstraint | null = null;
  if (detectedRegionKey) {
    const reg = REGION_REGISTRY[detectedRegionKey];
    regionConstraint = {
      regionName: detectedRegionKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      isStrict,
      bbox: reg.bbox,
      aliases: reg.aliases,
    };
  }

  return {
    rawQuery,
    normalizedQuery: normalized,
    semanticTokens: tokens,
    category,
    regionConstraint,
    wantsLiveOnly: normalized.includes("live") || normalized.includes("real time") || normalized.includes("realtime"),
  };
}

/**
 * Checks whether a given geographic coordinate or location belongs inside the target region constraint
 */
export function isLocationInRegion(
  lat: number,
  lon: number,
  locationName: string,
  regionName: string,
  constraint: RegionConstraint
): boolean {
  const normName = (locationName || "").toLowerCase();
  const normRegion = (regionName || "").toLowerCase();

  // 1. Direct name/region text match against aliases
  const textMatch = constraint.aliases.some(
    (alias) => normName.includes(alias) || normRegion.includes(alias)
  );

  // 2. Spatial bounding box containment
  let bboxMatch = false;
  if (constraint.bbox && typeof lat === "number" && typeof lon === "number") {
    bboxMatch =
      lat >= constraint.bbox.minLat &&
      lat <= constraint.bbox.maxLat &&
      lon >= constraint.bbox.minLon &&
      lon <= constraint.bbox.maxLon;
  }

  return textMatch || bboxMatch;
}
