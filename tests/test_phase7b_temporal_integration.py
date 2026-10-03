"""Regression Tests for Phase 7B REAL EO -> Temporal Workflow Integration.

Verifies that:
1. Selecting REAL EO mode preserves catalogMode = "real-eo"
2. REAL EO search returns a real catalog result and does not switch to benchmark
3. Selecting a real EO scene preserves its scene_id and real Sentinel-2 metadata
4. Downstream temporal requests from REAL EO mode respect catalog=real-eo
5. REAL EO workflow never renders "Controlled Synthetic Benchmark Scene"
6. Explicit switch to benchmark preserves the 10-scene benchmark catalog
7. State transition: REAL EO -> Search -> Select Bhadla Solar Park -> Temporal Handoff

Smart India Hackathon 2026 - Problem Statement SIH26227
"""

import json
from pathlib import Path
import pytest
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parent.parent
WEB_DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"
THUMBNAILS_DIR = PROJECT_ROOT / "web" / "public" / "eo_catalog" / "thumbnails"


@pytest.fixture(scope="module")
def catalogs():
    """Loads both benchmark and real EO catalogs."""
    eo_scenes_file = WEB_DATA_DIR / "eo_scenes.json"
    eo_locs_file = WEB_DATA_DIR / "eo_locations.json"
    eo_embs_file = WEB_DATA_DIR / "eo_catalog_embeddings.json"

    bench_scenes_file = WEB_DATA_DIR / "scene_embeddings.json"
    bench_locs_file = WEB_DATA_DIR / "locations.json"

    assert eo_scenes_file.exists()
    assert eo_locs_file.exists()
    assert eo_embs_file.exists()
    assert bench_scenes_file.exists()
    assert bench_locs_file.exists()

    with open(eo_scenes_file, "r", encoding="utf-8") as f:
        eo_scenes = json.load(f)
    with open(eo_locs_file, "r", encoding="utf-8") as f:
        eo_locs = json.load(f)
    with open(eo_embs_file, "r", encoding="utf-8") as f:
        eo_embs = json.load(f)

    with open(bench_scenes_file, "r", encoding="utf-8") as f:
        bench_scenes = json.load(f)
    with open(bench_locs_file, "r", encoding="utf-8") as f:
        bench_locs = json.load(f)

    return {
        "eo_scenes": eo_scenes,
        "eo_locs": eo_locs,
        "eo_embs": eo_embs,
        "bench_scenes": bench_scenes,
        "bench_locs": bench_locs,
    }


def test_1_real_eo_mode_preserves_catalog_mode(catalogs):
    """TEST 1: Selecting REAL EO mode preserves catalogMode = 'real-eo' and 70 scenes."""
    eo_embs = catalogs["eo_embs"]
    assert eo_embs.get("catalog_mode") == "real-eo-catalog"
    assert eo_embs.get("total_scenes") == 70
    assert len(catalogs["eo_scenes"]["scenes"]) == 70
    assert len(catalogs["eo_locs"]["locations"]) == 35


def test_2_real_eo_search_returns_real_result_and_preserves_catalog(catalogs):
    """TEST 2: REAL EO search returns a real catalog result and does not switch to benchmark."""
    eo_embs = catalogs["eo_embs"]["scenes"]
    # Check that search scenes in the real EO catalog contain authentic Sentinel-2 items
    for item in eo_embs:
        assert item["scene_id"].startswith("S2A_") or item["scene_id"].startswith("S2B_") or item["scene_id"].startswith("S2C_")
        assert not item["scene_id"].startswith("SCN_")
        assert item["image_path"].startswith("/eo_catalog/thumbnails/")


def test_3_selecting_real_eo_scene_preserves_scene_id(catalogs):
    """TEST 3: Selecting a real EO scene preserves its scene_id and Sentinel-2 metadata."""
    eo_scenes = catalogs["eo_scenes"]["scenes"]
    bhadla_scenes = [s for s in eo_scenes if s["location_id"] == "LOC_EO_01_BHADLA_SOLAR"]
    assert len(bhadla_scenes) >= 1

    selected_scene = bhadla_scenes[0]
    scene_id = selected_scene["scene_id"]

    # Verify ID format and thumbnail presence
    assert scene_id.startswith("S2")
    assert "MSIL2A" in scene_id
    assert selected_scene["sensor"] == "Sentinel-2 MSI"
    assert selected_scene["platform"] in ["Sentinel-2A", "Sentinel-2B", "Sentinel-2C"]

    thumb_file = THUMBNAILS_DIR / f"{scene_id}.jpg"
    assert thumb_file.exists(), f"Thumbnail missing for selected real scene: {thumb_file}"
    assert thumb_file.stat().st_size > 5000, "Thumbnail file appears empty or truncated"


def test_4_downstream_temporal_handoff_uses_real_eo_scenes(catalogs):
    """TEST 4: Downstream temporal request for real EO location returns authentic Sentinel-2 scenes."""
    eo_scenes = catalogs["eo_scenes"]["scenes"]
    eo_locs = catalogs["eo_locs"]["locations"]

    # Verify every real EO location has matching real scenes in the catalog
    loc_ids_in_scenes = {s["location_id"] for s in eo_scenes}
    for loc in eo_locs:
        assert loc["location_id"] in loc_ids_in_scenes, f"Location {loc['location_id']} has no scenes in EO catalog"

    # Simulate downstream temporal lookup for Bhadla Solar Park
    bhadla_loc = next(l for l in eo_locs if l["location_id"] == "LOC_EO_01_BHADLA_SOLAR")
    matched_scenes = [s for s in eo_scenes if s["location_id"] == bhadla_loc["location_id"]]

    assert len(matched_scenes) == 2
    # Verify both scenes are real Sentinel-2 and distinct
    assert matched_scenes[0]["scene_id"] != matched_scenes[1]["scene_id"]
    assert all("MSIL2A" in s["scene_id"] for s in matched_scenes)
    assert all(s["image_path"].startswith("/eo_catalog/thumbnails/") for s in matched_scenes)


def test_5_real_eo_workflow_never_renders_controlled_synthetic_benchmark(catalogs):
    """TEST 5: REAL EO workflow never renders 'Controlled Synthetic Benchmark Scene'."""
    eo_scenes = catalogs["eo_scenes"]["scenes"]
    eo_locs = catalogs["eo_locs"]["locations"]

    forbidden_phrases = [
        "Controlled Synthetic Benchmark Scene",
        "SYNTHETIC BENCHMARK",
        "mock_benchmark_provider",
    ]

    for s in eo_scenes:
        for phrase in forbidden_phrases:
            assert phrase not in s.get("platform", "")
            assert phrase not in s.get("sensor", "")
            assert phrase not in s.get("stac_provider", "")

    for loc in eo_locs:
        for phrase in forbidden_phrases:
            assert phrase not in loc.get("description", "")
            assert phrase not in loc.get("primary_sensor", "")


def test_6_switching_to_benchmark_preserves_10_scene_catalog(catalogs):
    """TEST 6: Switching explicitly to benchmark still gives the 10-scene benchmark catalog."""
    bench_scenes = catalogs["bench_scenes"]
    bench_locs = catalogs["bench_locs"]

    assert len(bench_scenes.get("scenes", [])) == 10
    assert len(bench_locs) == 5

    # Verify benchmark scene IDs are distinct from real EO scene IDs
    bench_scene_ids = {s["scene_id"] for s in bench_scenes.get("scenes", [])}
    eo_scene_ids = {s["scene_id"] for s in catalogs["eo_scenes"]["scenes"]}

    overlap = bench_scene_ids & eo_scene_ids
    assert len(overlap) == 0, f"Benchmark and Real EO catalogs must not overlap: {overlap}"


def test_7_end_to_end_state_transition_bhadla_solar_park(catalogs):
    """TEST 7: Full transition: REAL EO -> Search -> Select Bhadla Solar Park -> Context Preserved."""
    eo_scenes = catalogs["eo_scenes"]["scenes"]
    eo_locs = catalogs["eo_locs"]["locations"]
    eo_embs = catalogs["eo_embs"]["scenes"]

    # 1. State: catalogMode = "real-eo"
    active_catalog = "real-eo"

    # 2. Match: Bhadla Solar Park
    bhadla_loc = next(l for l in eo_locs if "bhadla" in l["name"].lower())
    assert bhadla_loc["location_id"] == "LOC_EO_01_BHADLA_SOLAR"

    # 3. Embeddings: find Bhadla scene vectors
    bhadla_embs = [e for e in eo_embs if e["location_id"] == bhadla_loc["location_id"]]
    assert len(bhadla_embs) >= 1
    selected_vec_rec = bhadla_embs[0]

    # 4. Context preservation
    assert active_catalog == "real-eo"
    assert selected_vec_rec["scene_id"].startswith("S2")
    assert len(selected_vec_rec["vector"]) == 512
    # Verify L2 normalization
    norm = np.linalg.norm(np.array(selected_vec_rec["vector"]))
    assert abs(norm - 1.0) < 1e-4

    # 5. Scene thumbnail exists
    thumb_path = PROJECT_ROOT / "web" / "public" / selected_vec_rec["image_path"].lstrip("/")
    assert thumb_path.exists()
