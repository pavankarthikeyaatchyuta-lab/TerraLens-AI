"""Builds the expanded Real Sentinel-2 Earth Observation (EO) Catalog for TerraLens AI.

Phase 7B: Ingests >= 50 real Sentinel-2 L2A satellite scenes across diverse geographic,
thematic, and temporal categories with complete STAC metadata and 512-D CLIP image
embeddings.

IMAGE EMBEDDING PIPELINE (accurate description):
  - SOURCE: Authentic Sentinel-2 L2A imagery from Microsoft Planetary Computer STAC.
  - EMBEDDING INPUT: Planetary Computer rendered natural-color visual preview PNGs
    (rendered_preview asset, or constructed visual tile-server URL). These are
    server-side rendered composites from Sentinel-2 imagery and may include
    provider-side brightness/gamma rendering.
  - The current Phase 7B pipeline does NOT directly read raw B04/B03/B02 COG bands
    for RGB construction. The visual preview is the input to the CLIP image encoder.
  - PREPROCESSING: PNG -> RGB conversion -> 512x512 BICUBIC resize -> JPEG save.
  - MODEL: openai/clip-vit-base-patch32 image encoder.
  - OUTPUT: 512-D L2-normalized CLIP image embedding (unit sphere).

Smart India Hackathon 2026 - Problem Statement SIH26227
"""

import sys
import os
import json
import logging
import urllib.request
import urllib.error
import io
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from terralens.app.services.embedding_service import get_embedding_model
import faiss

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("terralens.build_eo_catalog")

TARGET_LOCATIONS: List[Dict[str, Any]] = [
    # 1. Solar Parks / Renewable Energy
    {
        "location_id": "LOC_EO_01_BHADLA_SOLAR",
        "name": "Bhadla Solar Park, Rajasthan",
        "description": "World's largest photovoltaic solar park spanning over 14,000 acres in the Thar desert.",
        "bbox": [71.85, 27.48, 72.05, 27.60],
        "tags": ["solar_farm", "photovoltaic", "energy", "renewable", "desert", "arid", "infrastructure"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_02_PAVAGADA_SOLAR",
        "name": "Pavagada Solar Park, Karnataka",
        "description": "Shakti Sthala mega solar power project situated on semi-arid drought-prone terrain.",
        "bbox": [77.20, 14.05, 77.40, 14.25],
        "tags": ["solar_farm", "photovoltaic", "energy", "renewable", "rural"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_03_KURNOOL_SOLAR",
        "name": "Kurnool Ultra Mega Solar Park, AP",
        "description": "1,000 MW grid-connected photovoltaic installation in Andhra Pradesh.",
        "bbox": [78.20, 15.65, 78.40, 15.85],
        "tags": ["solar_farm", "photovoltaic", "energy", "infrastructure"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_04_BENBAN_SOLAR",
        "name": "Benban Solar Complex, Aswan, Egypt",
        "description": "Gigawatt-scale photovoltaic complex in the Western Desert of Egypt.",
        "bbox": [32.70, 24.40, 32.85, 24.55],
        "tags": ["solar_farm", "photovoltaic", "energy", "desert", "international"],
        "max_scenes": 2,
    },

    # 2. Urban & Construction
    {
        "location_id": "LOC_EO_05_HYDERABAD_HITEC",
        "name": "Hyderabad HITEC City & Gachibowli, Telangana",
        "description": "Rapid urban expansion, high-rise commercial corridors, and transit infrastructure in Cyberabad.",
        "bbox": [78.33, 17.40, 78.43, 17.50],
        "tags": ["urban", "construction", "buildings", "commercial", "infrastructure", "city"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_06_NEW_DELHI_CENTRAL",
        "name": "Central New Delhi & Yamuna Corridor",
        "description": "High-density urban fabric, riverfront developments, and urban green belts along the Yamuna river.",
        "bbox": [77.18, 28.58, 77.28, 28.68],
        "tags": ["urban", "capital", "river", "city", "dense_buildings", "infrastructure"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_07_BENGALURU_TECH",
        "name": "Bengaluru Electronic City & Peripheral Ring Road",
        "description": "Technology business parks, residential clusters, and major arterial ring road expansion.",
        "bbox": [77.63, 12.82, 77.73, 12.92],
        "tags": ["urban", "tech_park", "development", "industrial", "roads"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_08_KOLKATA_HOOGHLY",
        "name": "Kolkata Hooghly Riverfront & Howrah",
        "description": "Dense historic metropolis along the tidal Hooghly river with major bridge and dock infrastructure.",
        "bbox": [88.30, 22.50, 88.40, 22.60],
        "tags": ["urban", "river", "delta", "bridges", "city", "transport"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_09_DUBAI_COASTAL",
        "name": "Dubai Marina & Palm Jumeirah, UAE",
        "description": "Iconic coastal land reclamation, luxury high-rises, and artificial archipelago developments.",
        "bbox": [55.10, 25.05, 55.25, 25.20],
        "tags": ["coastal_reclamation", "urban", "ocean", "artificial_islands", "maritime"],
        "max_scenes": 2,
    },

    # 3. Water Reservoirs, Lakes & Drying Shorelines
    {
        "location_id": "LOC_EO_10_SRIRAM_SAGAR",
        "name": "Sriram Sagar Reservoir, Godavari Basin",
        "description": "Major multipurpose water reservoir on the Godavari river exhibiting seasonal water level fluctuations.",
        "bbox": [78.25, 18.90, 78.40, 19.05],
        "tags": ["reservoir", "water", "dam", "lake", "inland_water", "godavari"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_11_NAGARJUNA_SAGAR",
        "name": "Nagarjuna Sagar Dam & Reservoir, Krishna Basin",
        "description": "One of India's largest masonry dams and water storage reservoirs with prominent shoreline changes.",
        "bbox": [79.25, 16.50, 79.40, 16.65],
        "tags": ["reservoir", "water", "dam", "river_valley", "lake"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_12_CHILIKA_LAKE",
        "name": "Chilika Lagoon & Sea Mouth, Odisha",
        "description": "Asia's largest brackish water lagoon with dynamic tidal openings, mudflats, and fishery wetlands.",
        "bbox": [85.20, 19.60, 85.50, 19.90],
        "tags": ["lagoon", "water", "wetland", "coastal", "lake", "fisheries"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_13_LOKTAK_LAKE",
        "name": "Loktak Lake & Phumdis, Manipur",
        "description": "Unique freshwater wetland characterized by circular floating vegetation islands (phumdis).",
        "bbox": [93.75, 24.50, 93.90, 24.65],
        "tags": ["lake", "wetland", "floating_islands", "water", "inland"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_14_PANGONG_TSO",
        "name": "Pangong Tso Lake, Ladakh Himalayas",
        "description": "Endorheic high-altitude Himalayan saltwater lake with vivid turquoise and deep blue waters.",
        "bbox": [78.50, 33.65, 78.80, 33.85],
        "tags": ["lake", "high_altitude", "mountain", "glacial", "water", "himalayas"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_15_LAKE_MEAD",
        "name": "Lake Mead Reservoir, Colorado River, USA",
        "description": "Historic water shrinkage and white bathtub ring along the reservoir cliffs of Nevada and Arizona.",
        "bbox": [-114.50, 36.05, -114.25, 36.25],
        "tags": ["reservoir", "water_shrinkage", "lake", "arid_canyon", "drought"],
        "max_scenes": 2,
    },

    # 4. Coastal Ports & Maritime Logistics
    {
        "location_id": "LOC_EO_16_JNPT_MUMBAI",
        "name": "JNPT Port & Nhava Sheva Container Terminal, Mumbai",
        "description": "Premier container gateway of India with extensive cargo yards, container berths, and tidal creeks.",
        "bbox": [72.92, 18.92, 73.02, 19.00],
        "tags": ["port", "coastal", "harbor", "shipping", "ocean", "maritime", "container_terminal"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_17_VISAKHAPATNAM_PORT",
        "name": "Visakhapatnam Outer Harbor & Port, AP",
        "description": "Deepwater maritime harbor sheltered by the Dolphin's Nose headland on the Bay of Bengal.",
        "bbox": [83.25, 17.65, 83.35, 17.75],
        "tags": ["port", "harbor", "coastal", "shipping", "rocky_coast", "bay_of_bengal"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_18_PARADIP_PORT",
        "name": "Paradip Deepwater Port, Odisha",
        "description": "Artificial deep-sea port handling bulk minerals, coal, and crude tankers along the Mahanadi delta.",
        "bbox": [86.65, 20.25, 86.75, 20.35],
        "tags": ["port", "coastal", "harbor", "ocean", "shipping", "bulk_cargo"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_19_MUNDRA_PORT",
        "name": "Mundra Port & Industrial SEZ, Gulf of Kutch",
        "description": "Largest private commercial port in India featuring deepwater berths and massive coastal SEZ zones.",
        "bbox": [69.65, 22.70, 69.80, 22.85],
        "tags": ["port", "industrial", "shipping", "coastal", "docks", "sez"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_20_SINGAPORE_PORT",
        "name": "Port of Singapore & Jurong Island Terminals",
        "description": "One of the busiest maritime transshipment hubs globally, featuring reclaimed container terminals.",
        "bbox": [103.70, 1.22, 103.85, 1.32],
        "tags": ["port", "urban", "coastal", "shipping", "reclamation", "international"],
        "max_scenes": 2,
    },

    # 5. Forests, Deforestation & Nature Reserves
    {
        "location_id": "LOC_EO_21_SUNDARBANS_DELTA",
        "name": "Sundarbans Mangrove Biosphere, West Bengal",
        "description": "World's largest halophytic mangrove forest and tidal delta ecosystem intersected by waterways.",
        "bbox": [88.70, 21.75, 88.95, 22.00],
        "tags": ["forest", "mangrove", "delta", "wetland", "tidal", "conservation"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_22_WESTERN_GHATS",
        "name": "Silent Valley & Wayanad Rainforest, Western Ghats",
        "description": "UNESCO World Heritage biodiversity hotspot featuring continuous evergreen canopy.",
        "bbox": [76.45, 11.05, 76.65, 11.25],
        "tags": ["forest", "dense_vegetation", "mountain_ridge", "rainforest", "biodiversity"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_23_JIM_CORBETT",
        "name": "Jim Corbett National Park, Shivalik Foothills",
        "description": "Sub-Himalayan belt featuring dense sal forests, riverine grasslands, and Ramganga reservoir.",
        "bbox": [78.90, 29.50, 79.10, 29.70],
        "tags": ["forest", "national_park", "vegetation", "river_valley", "wildlife"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_24_KAZIRANGA",
        "name": "Kaziranga Floodplains & Forest, Assam",
        "description": "Tall elephant grass, dense tropical moist broadleaf forest, and braided floodplains.",
        "bbox": [93.15, 26.55, 93.45, 26.75],
        "tags": ["wetland", "grassland", "river", "floodplain", "forest", "nature"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_25_AMAZON_RONDONIA",
        "name": "Rondonia Deforestation Corridor, Amazon Basin",
        "description": "Classic fishbone pattern of road clearing and tropical rainforest conversion to pastureland.",
        "bbox": [-63.20, -10.20, -62.90, -9.95],
        "tags": ["forest", "deforestation", "roads", "clearing", "agriculture", "amazon"],
        "max_scenes": 2,
    },

    # 6. Agriculture & Croplands
    {
        "location_id": "LOC_EO_26_PUNJAB_AGRI",
        "name": "Ludhiana & Sangrur Intensive Agriculture Grid, Punjab",
        "description": "High-intensity wheat and rice cropland with geometric field grids and canal irrigation networks.",
        "bbox": [75.75, 30.70, 75.95, 30.90],
        "tags": ["agriculture", "cropland", "fields", "farming", "rural", "irrigation"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_27_HARYANA_AGRI",
        "name": "Karnal Green Revolution Crop Belt, Haryana",
        "description": "Extensive double-cropped agricultural landscape showing stark vegetative seasonality.",
        "bbox": [76.90, 29.60, 77.10, 29.80],
        "tags": ["agriculture", "farming", "paddy_wheat", "rural", "green_belt"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_28_GODAVARI_DELTA_AGRI",
        "name": "Godavari Delta Paddy & Aquaculture, AP",
        "description": "Lush alluvial rice paddies, coconut plantations, and aquaculture ponds in coastal Andhra.",
        "bbox": [81.80, 16.80, 82.00, 17.00],
        "tags": ["agriculture", "delta", "irrigation", "green_canals", "aquaculture"],
        "max_scenes": 2,
    },

    # 7. Deserts, Salt Flats & Arid Geomorphology
    {
        "location_id": "LOC_EO_29_THAR_DUNES",
        "name": "Thar Desert Longitudinal Dunes, Jaisalmer",
        "description": "Active longitudinal sand dunes and shifting arid bedforms in western Rajasthan.",
        "bbox": [70.80, 26.85, 71.05, 27.05],
        "tags": ["desert", "sand_dunes", "arid", "barren", "wind_patterns"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_30_RANN_OF_KUTCH",
        "name": "Great Rann of Kutch Salt Crust Flat, Gujarat",
        "description": "Vast expanse of seasonal salt marsh transforming into a blinding white salt crust.",
        "bbox": [69.75, 23.95, 70.05, 24.20],
        "tags": ["salt_desert", "white_crust", "arid", "saline_flat", "evaporite"],
        "max_scenes": 2,
    },

    # 8. Rivers, Deltas & Geomorphology
    {
        "location_id": "LOC_EO_31_BRAHMAPUTRA_BRAIDED",
        "name": "Brahmaputra River Braided Sandbars & Channels, Assam",
        "description": "Highly dynamic braided river channels, transient sandbars (chars), and monsoon silt bars.",
        "bbox": [92.75, 26.45, 93.00, 26.65],
        "tags": ["river", "sandbars", "braided_channels", "waterway", "sediment"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_32_NARMADA_ESTUARY",
        "name": "Narmada River Estuary & Gulf of Khambhat",
        "description": "Wide macro-tidal river mouth with extensive tidal mudflats and industrial petrochemical zones.",
        "bbox": [72.85, 21.65, 73.05, 21.80],
        "tags": ["estuary", "river_mouth", "tidal_flats", "industrial", "coastline"],
        "max_scenes": 2,
    },

    # 9. Cryosphere & Glaciers
    {
        "location_id": "LOC_EO_33_SIACHEN_GLACIER",
        "name": "Siachen Glacial Valley & Moraines, Karakoram",
        "description": "Second-longest non-polar glacier in the world with medial moraines, crevasses, and ice seracs.",
        "bbox": [77.10, 35.30, 77.30, 35.50],
        "tags": ["glacier", "ice", "snow", "mountain_peaks", "high_altitude", "moraine"],
        "max_scenes": 2,
    },

    # 10. Major Global Harbors & Industrial Corridors
    {
        "location_id": "LOC_EO_34_ROTTERDAM_PORT",
        "name": "Port of Rotterdam Maasvlakte, Netherlands",
        "description": "Deepwater maritime reclamation and automated container terminals on the North Sea.",
        "bbox": [4.10, 51.90, 4.30, 52.00],
        "tags": ["port", "container_terminal", "shipping", "canals", "industrial", "international"],
        "max_scenes": 2,
    },
    {
        "location_id": "LOC_EO_35_CHENNAI_PORT",
        "name": "Chennai Port & Coastal Breakwaters, Tamil Nadu",
        "description": "Historic artificial harbor on the Coromandel coast with breakwater protection and cargo wharves.",
        "bbox": [80.28, 13.07, 80.35, 13.15],
        "tags": ["coastal", "port", "ocean", "shipping", "harbor", "breakwater"],
        "max_scenes": 2,
    },
]


def query_stac_for_target(
    target: Dict[str, Any],
    limit: int = 4,
    max_cloud: float = 15.0
) -> List[Dict[str, Any]]:
    """Queries Planetary Computer STAC for low-cloud Sentinel-2 scenes for target bbox."""
    bbox = target["bbox"]
    url = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
    payload = {
        "collections": ["sentinel-2-l2a"],
        "bbox": bbox,
        "datetime": "2023-01-01T00:00:00Z/2026-10-01T23:59:59Z",
        "query": {
            "eo:cloud_cover": {"lt": max_cloud}
        },
        "limit": limit
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "TerraLens-AI-Phase7B/1.0"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            features = data.get("features", [])
            # Sort by lowest cloud cover
            features.sort(key=lambda f: f.get("properties", {}).get("eo:cloud_cover", 100))
            return features
    except Exception as e:
        logger.warning(f"Planetary STAC query failed for {target['location_id']}: {e}")
        return []


def download_preview_image(preview_url: str) -> Optional[Image.Image]:
    """Downloads a Planetary Computer rendered natural-color visual preview PNG.

    The source URL is a Planetary Computer tile-server endpoint that renders a
    natural-color (visual) composite from Sentinel-2 imagery. This is NOT a direct
    read of raw B04/B03/B02 COG bands — it is a server-side rendered PNG that may
    include provider-side brightness/gamma adjustments.

    Preprocessing applied before CLIP encoding:
      - RGBA/Palette -> RGB conversion
      - Deterministic 512x512 BICUBIC resize

    Returns:
        PIL.Image in RGB mode at 512x512, ready for CLIP image encoding.
        None if the download fails.
    """
    req = urllib.request.Request(preview_url, headers={"User-Agent": "TerraLens-AI-Phase7B/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw_bytes = resp.read()
            img = Image.open(io.BytesIO(raw_bytes))
            # Convert RGBA/Palette to RGB
            if img.mode != "RGB":
                img = img.convert("RGB")
            # Resize deterministically to 512x512
            if img.size != (512, 512):
                img = img.resize((512, 512), Image.Resampling.BICUBIC)
            return img
    except Exception as e:
        logger.warning(f"Failed to download preview image from {preview_url[:80]}...: {e}")
        return None


def build_eo_catalog(rebuild: bool = False, min_scenes_required: int = 50) -> Dict[str, Any]:
    """Builds the expanded Real Sentinel-2 catalog with >= 50 scenes."""
    print("=" * 70)
    print("TerraLens AI — Real Sentinel-2 Catalog Expansion (Phase 7B)")
    print(f"Targeting >= {min_scenes_required} authentic Sentinel-2 scenes with STAC metadata")
    print("=" * 70)

    # Directories
    web_data_dir = PROJECT_ROOT / "web" / "public" / "data"
    web_thumb_dir = PROJECT_ROOT / "web" / "public" / "eo_catalog" / "thumbnails"
    data_dir = PROJECT_ROOT / "data"

    web_data_dir.mkdir(parents=True, exist_ok=True)
    web_thumb_dir.mkdir(parents=True, exist_ok=True)

    # Existing metadata & embedding files if incremental
    eo_metadata_file = data_dir / "eo_catalog_metadata.json"
    eo_embeddings_file = web_data_dir / "eo_catalog_embeddings.json"
    eo_scenes_file = web_data_dir / "eo_scenes.json"
    eo_locations_file = web_data_dir / "eo_locations.json"
    eo_index_file = data_dir / "eo_catalog.index"

    existing_scenes: Dict[str, Dict[str, Any]] = {}
    existing_vectors: Dict[str, List[float]] = {}

    if not rebuild and eo_embeddings_file.exists() and eo_scenes_file.exists():
        try:
            with open(eo_scenes_file, "r", encoding="utf-8") as f:
                sc_data = json.load(f)
                for s in sc_data.get("scenes", []):
                    existing_scenes[s["scene_id"]] = s
            with open(eo_embeddings_file, "r", encoding="utf-8") as f:
                emb_data = json.load(f)
                for s in emb_data.get("scenes", []):
                    existing_vectors[s["scene_id"]] = s["vector"]
            logger.info(f"Loaded {len(existing_scenes)} existing cached scenes for incremental build.")
        except Exception as e:
            logger.warning(f"Could not load existing catalog, rebuilding from scratch: {e}")
            existing_scenes.clear()
            existing_vectors.clear()

    # Load embedding model
    print("\n1. Initializing CLIP Vision Encoder (openai/clip-vit-base-patch32)...")
    embed_model = get_embedding_model()
    dim = embed_model.get_dimension()
    print(f"   Model Label: {embed_model.model_label}")
    print(f"   Dimension:   {dim}")

    catalog_scenes: List[Dict[str, Any]] = []
    catalog_vectors: List[np.ndarray] = []
    catalog_locations: List[Dict[str, Any]] = []

    seen_scene_ids = set()

    print("\n2. Discovering & Ingesting Real Sentinel-2 L2A Scenes from STAC...")
    for target_idx, target in enumerate(TARGET_LOCATIONS):
        loc_id = target["location_id"]
        loc_name = target["name"]
        bbox = target["bbox"]
        max_scenes = target.get("max_scenes", 2)

        loc_record = {
            "location_id": loc_id,
            "name": loc_name,
            "description": target["description"],
            "latitude": round((bbox[1] + bbox[3]) / 2.0, 4),
            "longitude": round((bbox[0] + bbox[2]) / 2.0, 4),
            "bounding_box": {
                "min_lat": bbox[1],
                "min_lon": bbox[0],
                "max_lat": bbox[3],
                "max_lon": bbox[2],
            },
            "primary_sensor": "Sentinel-2 MSI",
            "tags": target["tags"],
            "available_dates": [],
            "source": "copernicus_sentinel2_stac",
        }

        # Check how many cached scenes we have for this location
        loc_cached = [s for s in existing_scenes.values() if s.get("location_id") == loc_id]
        features: List[Dict[str, Any]] = []

        if len(loc_cached) >= max_scenes and not rebuild:
            # We already have sufficient scenes cached
            pass
        else:
            # Fetch fresh STAC items
            features = query_stac_for_target(target, limit=max_scenes * 2)

        added_for_loc = 0

        # Process cached first if present
        for s in loc_cached:
            sid = s["scene_id"]
            if sid not in seen_scene_ids and sid in existing_vectors:
                seen_scene_ids.add(sid)
                catalog_scenes.append(s)
                catalog_vectors.append(np.array(existing_vectors[sid], dtype=np.float32))
                loc_record["available_dates"].append(s["acquisition_date"])
                added_for_loc += 1
                if added_for_loc >= max_scenes:
                    break

        # Ingest new features if needed
        for feat in features:
            if added_for_loc >= max_scenes:
                break

            sid = feat.get("id")
            if not sid or sid in seen_scene_ids:
                continue

            props = feat.get("properties", {})
            assets = feat.get("assets", {})

            # Determine preview URL — sources a Planetary Computer rendered natural-color
            # visual preview PNG (server-side rendered composite from Sentinel-2 imagery).
            # NOTE: This is NOT a direct read of raw B04/B03/B02 COG band data.
            preview_url = None
            if "rendered_preview" in assets and assets["rendered_preview"].get("href"):
                preview_url = assets["rendered_preview"]["href"]
            elif "thumbnail" in assets and assets["thumbnail"].get("href"):
                preview_url = assets["thumbnail"]["href"]
            else:
                preview_url = f"https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item={sid}&assets=visual&asset_bidx=visual%7C1,2,3&nodata=0&format=png&width=512&height=512"

            # Check if thumbnail image already exists on disk
            web_thumb_path = web_thumb_dir / f"{sid}.jpg"

            img = None
            if web_thumb_path.exists():
                try:
                    img = Image.open(web_thumb_path).convert("RGB")
                except Exception:
                    img = None

            if img is None:
                img = download_preview_image(preview_url)
                if img is None:
                    continue
                # Save locally
                img.save(web_thumb_path, "JPEG", quality=88)

            # Compute 512-D L2-normalized CLIP image embedding.
            # INPUT: Planetary Computer rendered natural-color preview PNG (512x512 RGB).
            # The embedding captures visual scene characteristics as rendered by the
            # Planetary Computer tile server, not raw spectral reflectance values.
            vec = embed_model.embed_image(img)
            # Verify unit norm
            vec_norm = float(np.linalg.norm(vec))
            if abs(vec_norm - 1.0) > 1e-3:
                vec = vec / (vec_norm + 1e-12)


            cloud_pct = props.get("eo:cloud_cover", props.get("cloud_cover", 0.0))
            if cloud_pct <= 1.0 and cloud_pct > 0.0:
                cloud_pct = cloud_pct * 100.0

            platform_raw = props.get("platform", "Sentinel-2")
            platform = "Sentinel-2B" if "sentinel-2b" in platform_raw.lower() else "Sentinel-2A"

            acq_date = props.get("datetime", "")[:10]
            mgrs_tile = props.get("s2:mgrs_tile", "")

            feat_bbox = feat.get("bbox", bbox)
            centroid_lat = round((feat_bbox[1] + feat_bbox[3]) / 2.0, 4) if len(feat_bbox) >= 4 else loc_record["latitude"]
            centroid_lon = round((feat_bbox[0] + feat_bbox[2]) / 2.0, 4) if len(feat_bbox) >= 4 else loc_record["longitude"]

            scene_record = {
                "scene_id": sid,
                "location_id": loc_id,
                "location_name": loc_name,
                "acquisition_date": acq_date,
                "datetime_iso": props.get("datetime", ""),
                "sensor": "Sentinel-2 MSI",
                "platform": platform,
                "cloud_percentage": round(float(cloud_pct), 2),
                "resolution_meters": 10.0,
                "mgrs_tile": mgrs_tile,
                "bbox": feat_bbox,
                "centroid": {"latitude": centroid_lat, "longitude": centroid_lon},
                "tags": target["tags"],
                "image_path": f"/eo_catalog/thumbnails/{sid}.jpg",
                "thumbnail_path": f"/eo_catalog/thumbnails/{sid}.jpg",
                "stac_provider": "Microsoft Planetary Computer",
                "stac_item_id": sid,
                "stac_collection": feat.get("collection", "sentinel-2-l2a"),
                "source": "copernicus_sentinel2_stac",
                "vector_id": len(catalog_scenes),
            }

            catalog_scenes.append(scene_record)
            catalog_vectors.append(vec)
            seen_scene_ids.add(sid)
            loc_record["available_dates"].append(acq_date)
            added_for_loc += 1
            print(f"   [{len(catalog_scenes)}] Ingested {loc_id} | {sid[:35]}... ({acq_date}, cloud: {scene_record['cloud_percentage']}%)")

        catalog_locations.append(loc_record)

    total_scenes = len(catalog_scenes)
    print(f"\n3. Total Scenes Ingested: {total_scenes} (Required >= {min_scenes_required})")

    if total_scenes < min_scenes_required:
        raise RuntimeError(f"Ingested only {total_scenes} scenes, which is less than the required {min_scenes_required}.")

    # 4. Construct FAISS IndexFlatIP
    print("\n4. Constructing FAISS IndexFlatIP (Cosine Similarity)...")
    vectors_arr = np.array(catalog_vectors, dtype=np.float32)
    # Ensure contiguous float32
    vectors_arr = np.ascontiguousarray(vectors_arr)

    index = faiss.IndexFlatIP(dim)
    index.add(vectors_arr)
    faiss.write_index(index, str(eo_index_file))
    print(f"   Saved FAISS index to {eo_index_file} ({index.ntotal} vectors)")

    # 5. Build Web Embeddings JSON
    print("\n5. Packaging Web Catalog Assets...")
    embedding_records = []
    for idx, sc in enumerate(catalog_scenes):
        embedding_records.append({
            "vector_id": idx,
            "scene_id": sc["scene_id"],
            "location_id": sc["location_id"],
            "acquisition_date": sc["acquisition_date"],
            "cloud_percentage": sc["cloud_percentage"],
            "sensor": sc["sensor"],
            "platform": sc["platform"],
            "tags": sc["tags"],
            "image_path": sc["image_path"],
            "vector": catalog_vectors[idx].tolist(),
        })

    web_embeddings_obj = {
        "dimension": dim,
        "metric": "cosine_similarity (IndexFlatIP)",
        "catalog_mode": "real-eo-catalog",
        "total_scenes": total_scenes,
        "scenes": embedding_records,
    }

    with open(eo_embeddings_file, "w", encoding="utf-8") as f:
        json.dump(web_embeddings_obj, f, indent=2)
    print(f"   Saved web embeddings to {eo_embeddings_file}")

    web_scenes_obj = {
        "total_scenes": total_scenes,
        "scenes": catalog_scenes,
    }
    with open(eo_scenes_file, "w", encoding="utf-8") as f:
        json.dump(web_scenes_obj, f, indent=2)
    print(f"   Saved web scenes to {eo_scenes_file}")

    web_locs_obj = {
        "total_locations": len(catalog_locations),
        "locations": catalog_locations,
    }
    with open(eo_locations_file, "w", encoding="utf-8") as f:
        json.dump(web_locs_obj, f, indent=2)
    print(f"   Saved web locations to {eo_locations_file}")

    # Also save metadata for backend services
    with open(eo_metadata_file, "w", encoding="utf-8") as f:
        json.dump({
            "catalog_name": "TerraLens Sentinel-2 Real EO Catalog",
            "version": "1.0.0",
            "total_scenes": total_scenes,
            "total_vectors": total_scenes,
            "dimension": dim,
            "metric": "cosine_similarity (IndexFlatIP)",
            "scenes": catalog_scenes,
            "records": catalog_scenes,
            "locations": catalog_locations,
        }, f, indent=2)
    print(f"   Saved backend metadata to {eo_metadata_file}")

    print("\n" + "=" * 70)
    print("PHASE 7B REAL SENTINEL-2 CATALOG BUILD COMPLETE!")
    print(f" - Total Locations: {len(catalog_locations)}")
    print(f" - Total Scenes:    {total_scenes}")
    print(f" - Embedding Dim:   {dim}")
    print(f" - FAISS Index:     {eo_index_file}")
    print("=" * 70)

    return {
        "total_scenes": total_scenes,
        "total_locations": len(catalog_locations),
        "dimension": dim,
        "index_path": str(eo_index_file),
    }


if __name__ == "__main__":
    rebuild_flag = "--rebuild" in sys.argv
    build_eo_catalog(rebuild=rebuild_flag, min_scenes_required=50)
