"""Tests for Phase 7B Real Sentinel-2 Catalog Expansion.

Smart India Hackathon 2026 - Problem Statement SIH26227
"""

import json
from pathlib import Path
import pytest
import numpy as np
import faiss

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"
WEB_DATA_DIR = PROJECT_ROOT / "web" / "public" / "data"


@pytest.fixture(scope="module")
def eo_catalog_data():
    """Loads the real EO catalog web embeddings and scenes."""
    emb_file = WEB_DATA_DIR / "eo_catalog_embeddings.json"
    scenes_file = WEB_DATA_DIR / "eo_scenes.json"
    locs_file = WEB_DATA_DIR / "eo_locations.json"
    index_file = DATA_DIR / "eo_catalog.index"

    assert emb_file.exists(), f"Missing {emb_file}"
    assert scenes_file.exists(), f"Missing {scenes_file}"
    assert locs_file.exists(), f"Missing {locs_file}"
    assert index_file.exists(), f"Missing {index_file}"

    with open(emb_file, "r", encoding="utf-8") as f:
        embeddings = json.load(f)
    with open(scenes_file, "r", encoding="utf-8") as f:
        scenes = json.load(f)
    with open(locs_file, "r", encoding="utf-8") as f:
        locations = json.load(f)

    index = faiss.read_index(str(index_file))

    return {
        "embeddings": embeddings,
        "scenes": scenes,
        "locations": locations,
        "index": index,
    }


def test_eo_catalog_scene_count(eo_catalog_data):
    """Verifies that the Real Sentinel-2 catalog contains at least 50 authentic scenes."""
    total_scenes = eo_catalog_data["scenes"].get("total_scenes", 0)
    scenes_list = eo_catalog_data["scenes"].get("scenes", [])
    total_vectors = eo_catalog_data["embeddings"].get("total_scenes", 0)
    vectors_list = eo_catalog_data["embeddings"].get("scenes", [])
    ntotal_faiss = eo_catalog_data["index"].ntotal

    assert total_scenes >= 50, f"Expected >= 50 scenes, got {total_scenes}"
    assert len(scenes_list) >= 50
    assert total_vectors == total_scenes
    assert len(vectors_list) == total_scenes
    assert ntotal_faiss == total_scenes


def test_stac_metadata_completeness(eo_catalog_data):
    """Verifies that all ingested Sentinel-2 scenes have complete STAC metadata fields."""
    scenes_list = eo_catalog_data["scenes"].get("scenes", [])
    required_fields = [
        "scene_id",
        "location_id",
        "acquisition_date",
        "sensor",
        "platform",
        "cloud_percentage",
        "bbox",
        "centroid",
        "tags",
        "image_path",
        "stac_provider",
    ]

    for scene in scenes_list:
        for field in required_fields:
            assert field in scene, f"Missing field '{field}' in scene {scene.get('scene_id')}"
            assert scene[field] is not None, f"Field '{field}' is None in scene {scene.get('scene_id')}"

        # Sensor and platform checks
        assert "Sentinel-2" in scene["sensor"]
        assert scene["platform"] in ["Sentinel-2A", "Sentinel-2B"]
        assert 0.0 <= scene["cloud_percentage"] <= 100.0

        # Geo checks
        bbox = scene["bbox"]
        assert len(bbox) == 4, f"Invalid bbox: {bbox}"
        centroid = scene["centroid"]
        assert "latitude" in centroid and "longitude" in centroid


def test_vector_dimension_and_normalization(eo_catalog_data):
    """Verifies that all embeddings are 512-dimensional and strictly L2-normalized.

    Embeddings are CLIP image features (openai/clip-vit-base-patch32) computed from
    Planetary Computer rendered natural-color visual preview PNGs. They are NOT derived
    from raw B04/B03/B02 COG bands.
    """
    emb_data = eo_catalog_data["embeddings"]
    assert emb_data.get("dimension") == 512

    scenes_emb = emb_data.get("scenes", [])
    for rec in scenes_emb:
        vec = np.array(rec["vector"], dtype=np.float32)
        assert vec.shape == (512,), f"Vector has shape {vec.shape}, expected (512,)"
        norm = np.linalg.norm(vec)
        assert abs(norm - 1.0) < 1e-3, f"Vector norm {norm:.6f} differs from 1.0 in scene {rec.get('scene_id')}"


def test_faiss_inner_product_parity(eo_catalog_data):
    """Verifies mathematical parity between FAISS IndexFlatIP and exact cosine dot products."""
    scenes_emb = eo_catalog_data["embeddings"]["scenes"]
    vectors = np.array([s["vector"] for s in scenes_emb], dtype=np.float32)
    index = eo_catalog_data["index"]

    # Pick 5 random query test vectors
    rng = np.random.RandomState(42)
    for _ in range(5):
        q = rng.randn(512).astype(np.float32)
        q = q / np.linalg.norm(q)

        # 1. FAISS search
        q_arr = np.expand_dims(q, axis=0)
        faiss_scores, faiss_indices = index.search(q_arr, 5)

        # 2. Exact NumPy dot product
        manual_scores = np.dot(vectors, q)
        manual_top_idx = np.argsort(manual_scores)[::-1][:5]

        # Parity check
        for k in range(5):
            assert faiss_indices[0][k] == manual_top_idx[k]
            assert abs(faiss_scores[0][k] - manual_scores[manual_top_idx[k]]) < 1e-4


def test_real_eo_semantic_retrieval(eo_catalog_data):
    """Verifies semantic category retrieval over the real Sentinel-2 EO catalog."""
    from terralens.app.services.embedding_service import get_embedding_model

    scenes_emb = eo_catalog_data["embeddings"]["scenes"]
    vectors = np.array([s["vector"] for s in scenes_emb], dtype=np.float32)
    index = eo_catalog_data["index"]

    embed_model = get_embedding_model()

    test_queries = [
        ("solar panel farm photovoltaic arrays in desert", ["LOC_EO_01_BHADLA_SOLAR", "LOC_EO_04_BENBAN_SOLAR", "LOC_EO_02_PAVAGADA_SOLAR", "LOC_EO_03_KURNOOL_SOLAR"]),
        ("water reservoir dam and lake shoreline", ["LOC_EO_10_SRIRAM_SAGAR", "LOC_EO_11_NAGARJUNA_SAGAR", "LOC_EO_15_LAKE_MEAD", "LOC_EO_14_PANGONG_TSO"]),
        ("coastal container shipping port and harbor", ["LOC_EO_16_JNPT_MUMBAI", "LOC_EO_19_MUNDRA_PORT", "LOC_EO_20_SINGAPORE_PORT", "LOC_EO_34_ROTTERDAM_PORT", "LOC_EO_18_PARADIP_PORT"]),
        ("dense forest canopy and nature reserve", ["LOC_EO_22_WESTERN_GHATS", "LOC_EO_23_JIM_CORBETT", "LOC_EO_21_SUNDARBANS_DELTA", "LOC_EO_25_AMAZON_RONDONIA"]),
        ("agricultural farming cropland and irrigation grid", ["LOC_EO_26_PUNJAB_AGRI", "LOC_EO_27_HARYANA_AGRI", "LOC_EO_28_GODAVARI_DELTA_AGRI"]),
    ]

    for query, expected_locs in test_queries:
        q_vec = embed_model.embed_text(query)
        q_arr = np.expand_dims(q_vec, axis=0)
        scores, indices = index.search(q_arr, 10)

        top_retrieved_locs = [scenes_emb[idx]["location_id"] for idx in indices[0]]
        # At least one expected category location must appear in top-10
        overlap = set(top_retrieved_locs).intersection(set(expected_locs))
        assert len(overlap) > 0, f"Query '{query}' failed to retrieve any expected location in top 10: {top_retrieved_locs}"


def test_benchmark_preservation_fidelity():
    """Confirms 100% preservation of the 5 canonical Phase 7A-Lite benchmark queries."""
    with open(WEB_DATA_DIR / "query_embeddings.json", "r", encoding="utf-8") as f:
        precomputed = json.load(f)["queries"]
    with open(WEB_DATA_DIR / "scene_embeddings.json", "r", encoding="utf-8") as f:
        scenes = json.load(f)["scenes"]

    benchmarks = [
        ("urban expansion and new construction near river", "LOC_001_HYDERABAD_URBAN", 1),
        ("water reservoir shoreline drying and lake shrinkage", "LOC_002_GODAVARI_RESERVOIR", 2),
        ("forest road clearing corridor and tree removal", "LOC_003_WESTERN_GHATS_FOREST", 2),
        ("coastal port reclamation and ocean harbor pier", "LOC_004_CHENNAI_COASTAL", 3),
        ("solar panel farm photovoltaic arrays in desert terrain", "LOC_005_THAR_SOLAR_PARK", 1),
    ]

    for q, expected_loc, expected_rank in benchmarks:
        assert q in precomputed, f"Query '{q}' missing from query_embeddings.json"
        q_vec = np.array(precomputed[q], dtype=np.float32)

        # Score benchmark scenes
        scores = [(s["location_id"], float(np.dot(q_vec, np.array(s["vector"], dtype=np.float32)))) for s in scenes]
        scores.sort(key=lambda x: x[1], reverse=True)
        seen = set()
        unique_ranked = [s[0] for s in scores if not (s[0] in seen or seen.add(s[0]))]

        rank = unique_ranked.index(expected_loc) + 1 if expected_loc in unique_ranked else 999
        assert rank == expected_rank, f"Query '{q}': expected rank {expected_rank} for {expected_loc}, got rank {rank}"
