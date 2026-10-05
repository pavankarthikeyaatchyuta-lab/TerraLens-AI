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
  rajasthan: {
    bbox: { minLat: 23.05, maxLat: 30.55, minLon: 69.45, maxLon: 78.45 },
    aliases: ["rajasthan", "rajisthan", "jodhpur", "jaisalmer", "bikaner", "phalodi", "pokhran", "thar"],
  },
  assam: {
    bbox: { minLat: 24.1, maxLat: 28.2, minLon: 89.7, maxLon: 96.1 },
    aliases: ["assam", "guwahati", "brahmaputra", "kaziranga"],
  },
  karnataka: {
    bbox: { minLat: 11.5, maxLat: 18.5, minLon: 74.0, maxLon: 78.6 },
    aliases: ["karnataka", "bengaluru", "bangalore", "pavagada"],
  },
  andhra_pradesh: {
    bbox: { minLat: 12.6, maxLat: 19.9, minLon: 76.7, maxLon: 84.8 },
    aliases: ["andhra", "andhra pradesh", "kurnool", "visakhapatnam", "vizag"],
  },
  west_bengal: {
    bbox: { minLat: 21.5, maxLat: 27.3, minLon: 85.8, maxLon: 89.9 },
    aliases: ["bengal", "west bengal", "kolkata", "hooghly", "sundarbans"],
  },
  delhi: {
    bbox: { minLat: 28.4, maxLat: 28.9, minLon: 76.8, maxLon: 77.4 },
    aliases: ["delhi", "new delhi", "yamuna"],
  },
  gujarat: {
    bbox: { minLat: 20.1, maxLat: 24.7, minLon: 68.1, maxLon: 74.5 },
    aliases: ["gujarat", "kutch", "mundra", "narmada"],
  },
  punjab: {
    bbox: { minLat: 29.5, maxLat: 32.5, minLon: 73.8, maxLon: 76.9 },
    aliases: ["punjab", "ludhiana", "amritsar"],
  },
  haryana: {
    bbox: { minLat: 27.6, maxLat: 30.9, minLon: 74.4, maxLon: 77.6 },
    aliases: ["haryana", "gurugram", "karnal"],
  },
  egypt: {
    bbox: { minLat: 21.9, maxLat: 31.7, minLon: 24.7, maxLon: 36.9 },
    aliases: ["egypt", "aswan", "benban", "nile"],
  },
};

/**
 * Parses user search query to dynamically detect:
 * 1. Intent topic/category (e.g. solar, river, forest, port)
 * 2. Explicit or strict geographic constraints (e.g. "in Rajasthan", "only in Rajasthan")
 * 3. Spatial bounding box for strict spatial isolation
 */
export function parseUserQuery(rawQuery: string): ParsedQuery {
  const normalized = (rawQuery || "").toLowerCase().trim();
  const tokens = normalized.split(/[\s,;]+/).filter((t) => t.length > 1);

  // 1. Detect Category
  let category: ParsedQuery["category"] = "general";
  const solarWords = ["solar", "photovoltaic", "pv", "sun", "clean energy", "renewable", "megawatt", "gw"];
  const waterWords = ["river", "riverfront", "lake", "reservoir", "water", "dam", "canal", "estuary", "stream"];
  const urbanWords = ["college", "colleges", "university", "campus", "city", "urban", "expansion", "highway", "road"];
  const forestWords = ["forest", "trees", "woodland", "corridor", "jungles", "rainforest", "deforestation"];
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
  // Phrases indicating strict filtering: "in only rajisthan", "only in rajasthan", "in rajasthan", "rajasthan only"
  let detectedRegionKey: string | null = null;
  let isStrict = false;

  for (const [key, reg] of Object.entries(REGION_REGISTRY)) {
    const hasAlias = reg.aliases.some((alias) => {
      const aliasPattern = new RegExp(`\\b${alias}\\b`, "i");
      return aliasPattern.test(normalized);
    });

    if (hasAlias) {
      detectedRegionKey = key;

      // Check for explicit "only in", "in only", "strictly in", "within", or preposition "in [region]"
      const strictPatterns = [
        new RegExp(`only\\s+(?:in\\s+)?(?:${reg.aliases.join("|")})`, "i"),
        new RegExp(`in\\s+only\\s+(?:${reg.aliases.join("|")})`, "i"),
        new RegExp(`(?:${reg.aliases.join("|")})\\s+only`, "i"),
        new RegExp(`(?:in|within|inside|of)\\s+(?:${reg.aliases.join("|")})`, "i"),
      ];

      if (strictPatterns.some((p) => p.test(normalized))) {
        isStrict = true;
      } else {
        // If the query mentions a specific state name, default to strict geographic scope
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
