import { Location } from "@/types";

// Real-World Verified Solar & Energy Facilities in Rajasthan
export const RAJASTHAN_SOLAR_CORRIDOR: Location[] = [
  {
    location_id: "LOC_EO_01_BHADLA_SOLAR",
    name: "Bhadla Solar Park, Rajasthan",
    description: "World's largest photovoltaic solar park spanning over 14,000 acres in Phalodi district, Rajasthan with 2,245 MW total capacity.",
    category: "SOLAR_ENERGY",
    latitude: 27.5400,
    longitude: 71.9500,
    bounding_box: {
      min_lat: 27.4800,
      min_lon: 71.8800,
      max_lat: 27.6000,
      max_lon: 72.0200,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2016-05-15",
      "2017-04-20",
      "2018-04-18",
      "2019-04-22",
      "2020-04-14",
      "2021-04-16",
      "2022-04-19",
      "2023-04-05",
      "2024-04-10",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_EO_01_01",
    after_scene_id: "SCENE_EO_01_02",
    tags: ["solar", "photovoltaic", "energy", "rajasthan", "desert", "bhadla", "clean energy"],
  },
  {
    location_id: "LOC_DYN_RAJ_FATEHGARH_SOLAR",
    name: "Fatehgarh Ultra Mega Solar Park, Jaisalmer, Rajasthan",
    description: "Major 1,500 MW grid-connected solar power development hub situated in the Thar desert basin of Jaisalmer, Rajasthan.",
    category: "SOLAR_ENERGY",
    latitude: 26.4800,
    longitude: 71.2100,
    bounding_box: {
      min_lat: 26.4200,
      min_lon: 71.1500,
      max_lat: 26.5400,
      max_lon: 71.2700,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2016-05-15",
      "2018-04-18",
      "2020-04-14",
      "2023-04-05",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_DYN_FATEHGARH_01",
    after_scene_id: "SCENE_DYN_FATEHGARH_02",
    tags: ["solar", "photovoltaic", "energy", "rajasthan", "jaisalmer", "fatehgarh", "desert"],
  },
  {
    location_id: "LOC_DYN_RAJ_NOKH_SOLAR",
    name: "Nokh Solar Park, Jaisalmer, Rajasthan",
    description: "925 MW utility-scale solar photovoltaic park developed by NTPC and Rajasthan Solar Park Development Company in Pokhran tehsil, Jaisalmer.",
    category: "SOLAR_ENERGY",
    latitude: 27.5700,
    longitude: 72.2400,
    bounding_box: {
      min_lat: 27.5100,
      min_lon: 72.1800,
      max_lat: 27.6300,
      max_lon: 72.3000,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2017-04-20",
      "2019-04-22",
      "2021-04-16",
      "2023-04-05",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_DYN_NOKH_01",
    after_scene_id: "SCENE_DYN_NOKH_02",
    tags: ["solar", "photovoltaic", "energy", "rajasthan", "nokh", "pokhran", "ntpc"],
  },
  {
    location_id: "LOC_DYN_RAJ_BIKANER_SOLAR",
    name: "Bikaner Ultra Mega Solar Energy Hub, Rajasthan",
    description: "High-capacity 2,000 MW renewable solar generation zone connecting massive photovoltaic arrays across Bikaner's arid plains.",
    category: "SOLAR_ENERGY",
    latitude: 28.0200,
    longitude: 73.3100,
    bounding_box: {
      min_lat: 27.9600,
      min_lon: 73.2500,
      max_lat: 28.0800,
      max_lon: 73.3700,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2018-04-18",
      "2020-04-14",
      "2022-04-19",
      "2023-04-05",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_DYN_BIKANER_01",
    after_scene_id: "SCENE_DYN_BIKANER_02",
    tags: ["solar", "photovoltaic", "energy", "rajasthan", "bikaner", "renewable", "grid"],
  },
  {
    location_id: "LOC_EO_29_THAR_DUNES",
    name: "Thar Desert Renewable Energy & Dune Corridor, Jaisalmer, Rajasthan",
    description: "Vast desert energy corridor in Western Rajasthan supporting hybrid solar and wind turbine development amidst longitudinal dunes.",
    category: "ENERGY_CORRIDOR",
    latitude: 26.9157,
    longitude: 70.9083,
    bounding_box: {
      min_lat: 26.8500,
      min_lon: 70.8400,
      max_lat: 26.9800,
      max_lon: 70.9700,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2016-05-15",
      "2018-04-18",
      "2020-04-14",
      "2023-04-05",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_EO_29_01",
    after_scene_id: "SCENE_EO_29_02",
    tags: ["solar", "renewable", "wind", "rajasthan", "thar", "jaisalmer", "desert"],
  },
];

// Real-World Verified Forest & Deforestation Monitoring Corridors in India
export const INDIA_FOREST_CORRIDORS: Location[] = [
  {
    location_id: "LOC_EO_36_HASDEO_ARAND",
    name: "Hasdeo Arand Forest Canopy Clearance & Mining, Chhattisgarh",
    description: "Dense central Indian sal forest canopy, monitored for multi-temporal tree felling, road clearing, and coal mining expansion in the last 2 years.",
    category: "FOREST_CORRIDOR",
    latitude: 22.8000,
    longitude: 82.6000,
    bounding_box: {
      min_lat: 22.7000,
      min_lon: 82.5000,
      max_lat: 22.9000,
      max_lon: 82.7000,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2016-05-15",
      "2018-04-18",
      "2020-04-14",
      "2023-04-05",
      "2024-04-10",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_HASDEO_01",
    after_scene_id: "SCENE_HASDEO_02",
    tags: ["forest", "deforestation", "canopy_loss", "clearing", "mining", "chhattisgarh", "trees", "india"],
  },
  {
    location_id: "LOC_EO_22_WESTERN_GHATS",
    name: "Silent Valley & Western Ghats Rainforest Corridor, Kerala-Karnataka",
    description: "UNESCO World Heritage tropical evergreen canopy monitoring multi-temporal road clearing, encroachment, and canopy loss.",
    category: "FOREST_CORRIDOR",
    latitude: 11.1500,
    longitude: 76.5500,
    bounding_box: {
      min_lat: 11.0500,
      min_lon: 76.4500,
      max_lat: 11.2500,
      max_lon: 76.6500,
    },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: [
      "2016-05-15",
      "2018-04-18",
      "2020-04-14",
      "2023-04-05",
      "2024-04-10",
      "2025-03-15",
      "2026-10-01",
    ],
    before_scene_id: "SCENE_GHATS_01",
    after_scene_id: "SCENE_GHATS_02",
    tags: ["forest", "deforestation", "rainforest", "canopy_loss", "clearing", "trees", "western_ghats", "india"],
  },
];

/**
 * Dynamically resolves real locations matching the query and region
 */
export function getDynamicRegionLocations(regionName: string, category: string = "solar"): Location[] {
  const normRegion = regionName.toLowerCase();
  if (normRegion.includes("rajasthan") || normRegion.includes("rajisthan")) {
    return RAJASTHAN_SOLAR_CORRIDOR;
  }
  if (
    normRegion.includes("india") ||
    normRegion.includes("chhattisgarh") ||
    normRegion.includes("hasdeo") ||
    normRegion.includes("western ghats")
  ) {
    if (category === "forest") {
      return INDIA_FOREST_CORRIDORS;
    }
  }
  return [];
}
