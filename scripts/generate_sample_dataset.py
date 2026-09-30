"""Generates a multi-temporal prototype satellite dataset and metadata catalog for TerraLens AI.

All generated imagery is clearly marked as synthetic prototype data.
"""

import json
import os
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SAMPLES_DIR = DATA_DIR / "samples"
METADATA_DIR = DATA_DIR / "metadata"


def add_satellite_overlay(
    img: Image.Image,
    loc_id: str,
    date_str: str,
    sensor: str,
    is_after: bool = False
) -> Image.Image:
    """Overlays an authentic geospatial HUD and clear PROTOTYPE banner on the image."""
    draw = ImageDraw.Draw(img)
    w, h = img.size

    # Top banner background (semi-transparent dark bar)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ov_draw = ImageDraw.Draw(overlay)
    ov_draw.rectangle([(0, 0), (w, 36)], fill=(15, 23, 42, 220))
    ov_draw.rectangle([(0, h - 28), (w, h)], fill=(15, 23, 42, 220))

    # Composite banner
    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    phase_label = "MONITORING (AFTER)" if is_after else "BASELINE (BEFORE)"
    color = (255, 107, 107) if is_after else (77, 171, 247)

    # Header text
    draw.text((12, 10), f"TERRALENS PROTOTYPE | {loc_id} | {phase_label}", fill=color)
    draw.text((w - 220, 10), f"DATE: {date_str} | {sensor}", fill=(203, 213, 225))

    # Bottom status bar
    draw.text((12, h - 20), "SYNTHETIC BENCHMARK SCENE - SIH 2026 DEMONSTRATION", fill=(148, 163, 184))
    draw.text((w - 180, h - 20), "GSD: 10m/px | WGS84", fill=(148, 163, 184))

    # Crosshair in center
    cx, cy = w // 2, h // 2
    draw.line([(cx - 12, cy), (cx + 12, cy)], fill=(255, 255, 255, 120), width=1)
    draw.line([(cx, cy - 12), (cx, cy + 12)], fill=(255, 255, 255, 120), width=1)

    return img


def generate_urban_scene(is_after: bool) -> Image.Image:
    """Generates synthetic Hyderabad peri-urban scene (Before: farmland/channel, After: buildings/roads)."""
    w, h = 512, 512
    np.random.seed(42)

    # Base soil/vegetation
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :] = [135, 150, 105]  # Olive scrubland

    # Add Perlin-like noise
    noise = (np.random.rand(h, w, 3) * 35).astype(np.uint8)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    draw = ImageDraw.Draw(img)

    # Meandering stream/canal (dark turquoise-blue)
    points = [(50, 0), (90, 120), (160, 220), (220, 310), (330, 420), (380, 512)]
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=(32, 75, 110), width=16)

    # Farmland patches
    draw.rectangle([(280, 40), (460, 190)], fill=(120, 140, 85), outline=(95, 115, 65), width=2)
    draw.rectangle([(40, 340), (200, 480)], fill=(145, 160, 100), outline=(100, 120, 75), width=2)

    if is_after:
        # After 2025: Concrete road network and new building construction
        # Main asphalt highway
        draw.line([(0, 250), (512, 270)], fill=(75, 80, 85), width=14)
        draw.line([(260, 0), (275, 512)], fill=(80, 85, 90), width=12)

        # Secondary access roads
        draw.line([(270, 130), (480, 130)], fill=(100, 105, 110), width=6)
        draw.line([(270, 380), (500, 390)], fill=(100, 105, 110), width=6)

        # Cluster of commercial/residential buildings (bright concrete/rooftop colors)
        bldg_coords = [
            (300, 50, 350, 100),
            (370, 55, 430, 105),
            (310, 150, 360, 210),
            (380, 145, 450, 215),
            (310, 290, 370, 350),
            (390, 295, 460, 355),
            (320, 410, 400, 470),
            (420, 415, 480, 480),
        ]
        for b in bldg_coords:
            draw.rectangle(b, fill=(210, 215, 220), outline=(160, 165, 170), width=2)
            # Roof detail
            draw.rectangle((b[0]+6, b[1]+6, b[2]-6, b[3]-6), fill=(185, 95, 85))

    return img


def generate_reservoir_scene(is_after: bool) -> Image.Image:
    """Generates synthetic Sriram Sagar reservoir scene (Before: full, After: drought/retreat)."""
    w, h = 512, 512
    np.random.seed(101)

    # Base terrain: Semi-arid rocky plateau
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :] = [180, 150, 120]  # Dry terrain
    noise = (np.random.rand(h, w, 3) * 25).astype(np.uint8)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    draw = ImageDraw.Draw(img)

    if not is_after:
        # Full reservoir (2023): Deep water covering left and center
        water_polygon = [(0, 0), (380, 0), (340, 180), (410, 340), (320, 512), (0, 512)]
        draw.polygon(water_polygon, fill=(24, 60, 115))
        # Shoreline transition
        draw.line([(380, 0), (340, 180), (410, 340), (320, 512)], fill=(140, 120, 90), width=6)
    else:
        # Receded reservoir (2025): Exposed silt/lakebed, smaller water body
        silt_polygon = [(0, 0), (380, 0), (340, 180), (410, 340), (320, 512), (0, 512)]
        draw.polygon(silt_polygon, fill=(160, 138, 105))  # Exposed mudflat

        shrunken_water = [(0, 40), (210, 50), (180, 200), (230, 360), (170, 512), (0, 512)]
        draw.polygon(shrunken_water, fill=(28, 70, 125))
        draw.line([(210, 50), (180, 200), (230, 360), (170, 512)], fill=(120, 105, 80), width=4)

    return img


def generate_forest_scene(is_after: bool) -> Image.Image:
    """Generates synthetic Western Ghats forest scene (Before: dense canopy, After: linear corridor)."""
    w, h = 512, 512
    np.random.seed(303)

    # Dense forest canopy
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :] = [35, 95, 45]  # Deep forest green
    noise = (np.random.rand(h, w, 3) * 40).astype(np.uint8)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    draw = ImageDraw.Draw(img)

    if is_after:
        # After 2025: Infrastructure corridor cleared through canopy
        corridor = [(0, 380), (220, 260), (380, 140), (512, 60)]
        for i in range(len(corridor) - 1):
            draw.line([corridor[i], corridor[i+1]], fill=(145, 120, 85), width=28)
            draw.line([corridor[i], corridor[i+1]], fill=(80, 75, 70), width=8)  # Road strip

        # Clearance buffer
        draw.rectangle([(200, 240), (260, 300)], fill=(160, 135, 95))
        # Pylons / staging structures
        draw.rectangle([(220, 260), (240, 280)], fill=(200, 205, 215))

    return img


def generate_coastal_scene(is_after: bool) -> Image.Image:
    """Generates synthetic Ennore coastal scene (Before: mudflats, After: port reclamation)."""
    w, h = 512, 512
    np.random.seed(404)

    # Base: Sea water (right half) and coastal land (left half)
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :220] = [170, 160, 140]  # Coastal sand/sediment
    arr[:, 220:] = [25, 80, 120]    # Ocean coastal water

    noise = (np.random.rand(h, w, 3) * 20).astype(np.uint8)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    draw = ImageDraw.Draw(img)

    if is_after:
        # After 2025: Industrial reclamation breakwater and container yard
        # Breakwater jetty protruding into the sea
        draw.polygon([(200, 180), (420, 190), (440, 240), (200, 250)], fill=(120, 125, 130))
        draw.polygon([(420, 190), (470, 210), (470, 230), (440, 240)], fill=(90, 95, 100))

        # Reclaimed industrial platform
        draw.rectangle([(160, 260), (320, 460)], fill=(190, 180, 165), outline=(130, 130, 130), width=3)
        # Tanks / containers
        draw.ellipse([(190, 280), (240, 330)], fill=(230, 235, 240))
        draw.ellipse([(260, 280), (310, 330)], fill=(230, 235, 240))

    return img


def generate_solar_scene(is_after: bool) -> Image.Image:
    """Generates synthetic Thar desert solar park (Before: sand dunes, After: solar PV grids)."""
    w, h = 512, 512
    np.random.seed(505)

    # Desert sand
    arr = np.zeros((h, w, 3), dtype=np.uint8)
    arr[:, :] = [215, 180, 115]  # Sand
    noise = (np.random.rand(h, w, 3) * 20).astype(np.uint8)
    arr = np.clip(arr + noise, 0, 255).astype(np.uint8)

    img = Image.fromarray(arr)
    draw = ImageDraw.Draw(img)

    # Gentle dune ripples
    for y in range(40, 480, 60):
        draw.arc([(0, y), (512, y + 50)], 180, 360, fill=(195, 160, 100), width=2)

    if is_after:
        # After 2025: Extensive rectangular grids of PV panels (dark blue/indigo)
        grid_color = (20, 35, 75)
        for row in range(50, 450, 45):
            for col in range(50, 460, 75):
                draw.rectangle([(col, row), (col + 60, row + 30)], fill=grid_color, outline=(90, 100, 120), width=1)

        # Service roads
        draw.line([(0, 245), (512, 245)], fill=(160, 140, 90), width=5)
        draw.line([(240, 0), (240, 512)], fill=(160, 140, 90), width=5)

    return img


def create_sample_dataset() -> None:
    """Generates full sample dataset images and matching metadata catalog."""
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_DIR.mkdir(parents=True, exist_ok=True)

    locations_data = [
        {
            "id": "LOC_001_HYDERABAD_URBAN",
            "name": "Hyderabad Peri-Urban Growth Zone",
            "description": "Rapid peri-urban infrastructure development and construction near seasonal water channel.",
            "latitude": 17.4483,
            "longitude": 78.3742,
            "sensor": "Sentinel-2 MSI",
            "dates": ["2023-03-15", "2025-02-20"],
            "tags": ["urban", "construction", "buildings", "infrastructure", "river"],
            "generator": generate_urban_scene,
        },
        {
            "id": "LOC_002_GODAVARI_RESERVOIR",
            "name": "Sriram Sagar Reservoir Catchment",
            "description": "Surface water reservoir fluctuation and drying shoreline in Godavari basin.",
            "latitude": 18.9647,
            "longitude": 78.3283,
            "sensor": "Sentinel-2 MSI",
            "dates": ["2023-01-10", "2025-01-25"],
            "tags": ["water", "reservoir", "lake", "drought", "wetland"],
            "generator": generate_reservoir_scene,
        },
        {
            "id": "LOC_003_WESTERN_GHATS_FOREST",
            "name": "Western Ghats Clearance Corridor",
            "description": "Linear infrastructure clearance and road construction corridor cut through dense forest canopy.",
            "latitude": 14.8512,
            "longitude": 74.5238,
            "sensor": "Sentinel-2 MSI",
            "dates": ["2023-04-05", "2025-03-12"],
            "tags": ["forest", "deforestation", "trees", "corridor", "road"],
            "generator": generate_forest_scene,
        },
        {
            "id": "LOC_004_CHENNAI_COASTAL",
            "name": "Ennore Coastal & Port Reclamation",
            "description": "Coastal land reclamation and industrial pier expansion over coastal mudflats.",
            "latitude": 13.2541,
            "longitude": 80.3312,
            "sensor": "Sentinel-2 MSI",
            "dates": ["2023-02-18", "2025-02-14"],
            "tags": ["coastal", "port", "reclamation", "ocean", "industrial"],
            "generator": generate_coastal_scene,
        },
        {
            "id": "LOC_005_THAR_SOLAR_PARK",
            "name": "Bhadla Solar Intelligence Sector",
            "description": "Arid desert terrain converted into high-density photovoltaic solar array installation.",
            "latitude": 27.5380,
            "longitude": 71.9170,
            "sensor": "Sentinel-2 MSI",
            "dates": ["2023-05-12", "2025-04-18"],
            "tags": ["solar", "energy", "desert", "panels", "infrastructure"],
            "generator": generate_solar_scene,
        },
    ]

    catalog_locations = []
    catalog_scenes = []

    for loc in locations_data:
        loc_dir = SAMPLES_DIR / loc["id"]
        loc_dir.mkdir(parents=True, exist_ok=True)

        # Before 2023 image
        before_raw = loc["generator"](is_after=False)
        before_img = add_satellite_overlay(
            before_raw,
            loc_id=loc["id"],
            date_str=loc["dates"][0],
            sensor=loc["sensor"],
            is_after=False
        )
        before_filename = f"before_{loc['dates'][0][:4]}.jpg"
        before_path = loc_dir / before_filename
        before_img.save(before_path, "JPEG", quality=92)

        # After 2025 image
        after_raw = loc["generator"](is_after=True)
        after_img = add_satellite_overlay(
            after_raw,
            loc_id=loc["id"],
            date_str=loc["dates"][1],
            sensor=loc["sensor"],
            is_after=True
        )
        after_filename = f"after_{loc['dates'][1][:4]}.jpg"
        after_path = loc_dir / after_filename
        after_img.save(after_path, "JPEG", quality=92)

        # Scene IDs
        before_scene_id = f"SCENE_{loc['id']}_{loc['dates'][0][:4]}"
        after_scene_id = f"SCENE_{loc['id']}_{loc['dates'][1][:4]}"

        # Relative paths for portable catalog
        rel_before = f"data/samples/{loc['id']}/{before_filename}"
        rel_after = f"data/samples/{loc['id']}/{after_filename}"

        # Register Scenes
        catalog_scenes.append({
            "scene_id": before_scene_id,
            "location_id": loc["id"],
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "sensor": loc["sensor"],
            "platform": "Sentinel-2A",
            "acquisition_date": loc["dates"][0],
            "resolution_meters": 10.0,
            "image_path": rel_before,
            "thumbnail_path": rel_before,
            "cloud_percentage": 1.2,
            "source": "prototype_dataset",
            "tags": loc["tags"],
            "processing_status": "available",
            "extra_metadata": {"orbit": "Descending", "tile_id": f"T44_{loc['id'][:4]}"}
        })

        catalog_scenes.append({
            "scene_id": after_scene_id,
            "location_id": loc["id"],
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "sensor": loc["sensor"],
            "platform": "Sentinel-2B",
            "acquisition_date": loc["dates"][1],
            "resolution_meters": 10.0,
            "image_path": rel_after,
            "thumbnail_path": rel_after,
            "cloud_percentage": 2.5,
            "source": "prototype_dataset",
            "tags": loc["tags"],
            "processing_status": "available",
            "extra_metadata": {"orbit": "Descending", "tile_id": f"T44_{loc['id'][:4]}"}
        })

        # Register Location
        delta_deg = 0.05
        catalog_locations.append({
            "location_id": loc["id"],
            "name": loc["name"],
            "description": loc["description"],
            "latitude": loc["latitude"],
            "longitude": loc["longitude"],
            "bounding_box": {
                "min_lat": loc["latitude"] - delta_deg,
                "min_lon": loc["longitude"] - delta_deg,
                "max_lat": loc["latitude"] + delta_deg,
                "max_lon": loc["longitude"] + delta_deg,
            },
            "primary_sensor": loc["sensor"],
            "before_scene_id": before_scene_id,
            "after_scene_id": after_scene_id,
            "available_dates": loc["dates"],
            "tags": loc["tags"],
            "source": "prototype_dataset",
            "extra_metadata": {"region": "India", "sih_category": "Smart India Hackathon 2026"}
        })

    # Save to locations.json
    metadata_payload = {
        "dataset_name": "TerraLens AI Prototype Dataset (SIH-2026 Sandbox)",
        "version": "1.0.0",
        "description": "Multi-temporal satellite imagery sandbox demonstrating peri-urban, reservoir, forest corridor, coastal, and solar infrastructure change.",
        "locations": catalog_locations,
        "scenes": catalog_scenes,
    }

    metadata_file = METADATA_DIR / "locations.json"
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata_payload, f, indent=2)

    print(f"Dataset generated successfully:")
    print(f" - Locations: {len(catalog_locations)}")
    print(f" - Scenes: {len(catalog_scenes)}")
    print(f" - Metadata Catalog: {metadata_file}")


if __name__ == "__main__":
    create_sample_dataset()
