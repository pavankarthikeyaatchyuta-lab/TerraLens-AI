import { Location } from "@/types";

export interface DynamicResolved {
  locations: Location[];
  regionConstraint: {
    regionName: string;
    isStrict: boolean;
    bbox: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    };
    aliases: string[];
  } | null;
}

const cache = new Map<string, DynamicResolved>();

/**
 * Dynamically resolves real-world geospatial entities from natural language queries
 * via OpenStreetMap Nominatim API, discovering real coordinates and facilities on the fly.
 */
export async function resolveDynamicGeospatialEntities(query: string): Promise<DynamicResolved> {
  const norm = (query || "").toLowerCase().trim();
  if (!norm || norm.length < 3) {
    return { locations: [], regionConstraint: null };
  }

  if (cache.has(norm)) {
    return cache.get(norm)!;
  }

  // Strip temporal phrases first (e.g. "in last 2 years", "in 2024", "in recent months")
  const strippedNorm = norm
    .replace(/\b(?:in\s+)?(?:the\s+)?(?:last|past)\s+\d+\s*(?:years?|months?|days?|decade)\b/gi, "")
    .replace(/\b(?:in\s+)?recent\s*(?:years?|months?)\b/gi, "")
    .replace(/\b(?:in\s+)?20\d\d(?:\s*-\s*20\d\d)?\b/gi, "")
    .trim();

  // 1. Extract potential place candidate after prepositions
  const match = strippedNorm.match(/\b(?:in|near|around|at|of|across)\s+([a-zA-Z\s]{3,30})/i);
  let placeCandidate = match ? match[1].trim() : null;

  const genericNouns = [
    "farming lands", "farmland", "dry lands", "desert", "water body",
    "river", "forest", "urban areas", "open fields", "agricultural land"
  ];
  if (placeCandidate && genericNouns.some((g) => placeCandidate?.includes(g))) {
    placeCandidate = null;
  }

  let regionConstraint: DynamicResolved["regionConstraint"] = null;
  const dynamicLocations: Location[] = [];

  if (placeCandidate) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        placeCandidate
      )}&limit=1&addressdetails=1`;
      const res = await fetch(geoUrl, {
        headers: { "User-Agent": "TerraLens-AI-Geospatial-Workstation/1.0" },
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          const item = data[0];
          const bb = item.boundingbox ? item.boundingbox.map((x: string) => parseFloat(x)) : null;
          if (bb && bb.length === 4) {
            regionConstraint = {
              regionName: item.name || placeCandidate,
              isStrict: true,
              bbox: {
                minLat: Math.min(bb[0], bb[1]),
                maxLat: Math.max(bb[0], bb[1]),
                minLon: Math.min(bb[2], bb[3]),
                maxLon: Math.max(bb[2], bb[3]),
              },
              aliases: [
                placeCandidate.toLowerCase(),
                (item.name || "").toLowerCase(),
                (item.display_name?.split(",")[0] || "").toLowerCase(),
              ].filter(Boolean),
            };
          }
        }
      }
    } catch {
      // Graceful timeout or offline fallback
    }

    // 2. Discover specific facilities or amenities matching the feature inside this place
    const featurePart = norm
      .replace(new RegExp(`\\b(?:in|near|around|at|of|across)\\s+${placeCandidate}\\b`, "i"), "")
      .replace(/\b(?:development|expansion|built|new|construction|projects?)\b/g, "")
      .trim();

    if (featurePart && featurePart.length > 2) {
      try {
        const featQuery = `${featurePart} ${placeCandidate}`;
        const featUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          featQuery
        )}&limit=4&addressdetails=1`;
        const res = await fetch(featUrl, {
          headers: { "User-Agent": "TerraLens-AI-Geospatial-Workstation/1.0" },
          signal: AbortSignal.timeout(3000),
        });

        if (res.ok) {
          const data = await res.json();
          (data || []).forEach((item: any, idx: number) => {
            const lat = parseFloat(item.lat);
            const lon = parseFloat(item.lon);
            if (isNaN(lat) || isNaN(lon)) return;

            const rawName = item.name || item.display_name?.split(",")[0] || `${featurePart} ${placeCandidate}`;
            const cleanName = rawName.replace(/[^\w\s-]/g, "").trim();
            const slug = cleanName.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
            const locId = `LOC_DYN_${slug}_${idx + 1}`;

            dynamicLocations.push({
              location_id: locId,
              name: `${cleanName}, ${regionConstraint?.regionName || placeCandidate}`,
              description: item.display_name || `${cleanName} located in ${placeCandidate}. Monitored via Sentinel-2 MSI constellation.`,
              latitude: lat,
              longitude: lon,
              bounding_box: {
                min_lat: parseFloat((lat - 0.04).toFixed(5)),
                max_lat: parseFloat((lat + 0.04).toFixed(5)),
                min_lon: parseFloat((lon - 0.04).toFixed(5)),
                max_lon: parseFloat((lon + 0.04).toFixed(5)),
              },
              primary_sensor: "Sentinel-2 MSI L2A",
              available_dates: [
                "2018-04-12",
                "2020-03-20",
                "2022-04-15",
                "2023-04-05",
                "2024-03-10",
                "2025-03-15",
              ],
              before_scene_id: `SCENE_${locId}_2023`,
              after_scene_id: `SCENE_${locId}_2025`,
              tags: [
                ...featurePart.split(/\s+/).filter((t) => t.length > 2),
                placeCandidate.toLowerCase(),
                "sentinel2",
                "earth_observation",
                "dynamic_osm",
              ],
            });
          });
        }
      } catch {
        // Graceful timeout
      }
    }

    // If no specific sub-amenity was found by feature query, create regional AOI from regionConstraint
    if (dynamicLocations.length === 0 && regionConstraint) {
      const lat = (regionConstraint.bbox.minLat + regionConstraint.bbox.maxLat) / 2;
      const lon = (regionConstraint.bbox.minLon + regionConstraint.bbox.maxLon) / 2;
      const cleanName = `${regionConstraint.regionName}`;
      const slug = cleanName.replace(/[^a-zA-Z0-9]+/g, "_").toUpperCase();
      const locId = `LOC_DYN_${slug}_AOI`;

      dynamicLocations.push({
        location_id: locId,
        name: `${cleanName} Observation Area`,
        description: `Sentinel-2 Earth Observation Area of Interest for ${cleanName}. Monitored for multi-temporal surface transitions.`,
        latitude: parseFloat(lat.toFixed(5)),
        longitude: parseFloat(lon.toFixed(5)),
        bounding_box: {
          min_lat: regionConstraint.bbox.minLat,
          max_lat: regionConstraint.bbox.maxLat,
          min_lon: regionConstraint.bbox.minLon,
          max_lon: regionConstraint.bbox.maxLon,
        },
        primary_sensor: "Sentinel-2 MSI L2A",
        available_dates: [
          "2018-04-12",
          "2020-03-20",
          "2022-04-15",
          "2023-04-05",
          "2024-03-10",
          "2025-03-15",
        ],
        before_scene_id: `SCENE_${locId}_2023`,
        after_scene_id: `SCENE_${locId}_2025`,
        tags: [
          ...featurePart.split(/\s+/).filter((t) => t.length > 2),
          placeCandidate.toLowerCase(),
          "sentinel2",
          "earth_observation",
          "dynamic_osm",
        ],
      });
    }
  }

  const result: DynamicResolved = {
    locations: dynamicLocations,
    regionConstraint,
  };
  cache.set(norm, result);
  return result;
}
