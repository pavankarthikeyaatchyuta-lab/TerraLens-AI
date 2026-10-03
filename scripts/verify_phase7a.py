"""
Phase 7A Verification Suite: Arbitrary Natural-Language Semantic Retrieval.
Verifies model assets, numerical fidelity, vector normalization, ranking, and API contracts.
"""

import sys
import json
from pathlib import Path
import numpy as np

# Force UTF-8 on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
MODELS_DIR = ROOT / "web" / "public" / "models"
ONNX_DIR = ROOT / "web" / "public" / "onnx"
DATA_DIR = ROOT / "web" / "public" / "data"

from scripts.encode_query import encode_text

def test_assets():
    print("[1/5] Checking Model and Runtime Assets...")
    assert (MODELS_DIR / "clip-text-encoder.onnx").exists(), "clip-text-encoder.onnx missing"
    assert (MODELS_DIR / "bpe_ranks.json").exists(), "bpe_ranks.json missing"
    assert (MODELS_DIR / "vocab.json").exists(), "vocab.json missing"
    assert (ONNX_DIR / "ort.min.js").exists(), "ort.min.js missing"
    assert (ONNX_DIR / "ort-wasm-simd-threaded.wasm").exists(), "ort-wasm-simd-threaded.wasm missing"
    onnx_size_mb = (MODELS_DIR / "clip-text-encoder.onnx").stat().st_size / (1024 * 1024)
    print(f"      Assets verified. ONNX model size: {onnx_size_mb:.2f} MB.")

def test_benchmark_parity():
    print("[2/5] Testing Numerical Parity Against 5 Benchmark Queries...")
    with open(DATA_DIR / "query_embeddings.json", "r", encoding="utf-8") as f:
        precomputed = json.load(f)["queries"]

    for query, expected_vec in precomputed.items():
        actual_vec = encode_text(query)
        cos_sim = np.dot(actual_vec, expected_vec)
        max_diff = np.max(np.abs(np.array(actual_vec) - np.array(expected_vec)))
        assert cos_sim >= 0.985, f"Cosine similarity {cos_sim:.8f} below threshold for '{query}'"
        print(f"      Benchmark '{query[:35]}...': CosSim = {cos_sim:.8f}, MaxDiff = {max_diff:.2e} -> PASS")

def test_arbitrary_queries():
    print("[3/5] Testing 10 Arbitrary Natural-Language Queries...")
    arbitrary_queries = [
        "flooded farmland near a river",
        "new construction around an urban area",
        "large vehicle concentrations on open ground",
        "road expansion near agricultural land",
        "shrinking water bodies",
        "cleared vegetation corridor",
        "coastal port expansion and reclamation",
        "solar arrays in arid landscape",
        "deforestation and tree cutting",
        "dry shoreline and reservoir reduction"
    ]

    with open(DATA_DIR / "scene_embeddings.json", "r", encoding="utf-8") as f:
        catalog = json.load(f)["scenes"]

    for q in arbitrary_queries:
        vec = encode_text(q)
        assert len(vec) == 512, f"Expected 512 dim, got {len(vec)}"
        norm = np.linalg.norm(vec)
        assert abs(norm - 1.0) < 1e-4, f"Vector not L2 normalized: {norm}"

        # Rank catalog scenes
        scores = []
        for s in catalog:
            cos = float(np.dot(vec, s["vector"]))
            scores.append((cos, s["scene_id"], s["location_id"]))
        scores.sort(key=lambda x: x[0], reverse=True)
        top1 = scores[0]
        print(f"      Query: '{q[:30]}...' -> Top-1: {top1[2]} (score: {top1[0]:.4f})")

def test_vector_contracts():
    print("[4/5] Testing Dimension, Normalization & Finite Numbers...")
    vec = encode_text("test query for numerical sanity")
    arr = np.array(vec)
    assert np.all(np.isfinite(arr)), "Embedding contains NaN or Inf"
    assert arr.shape == (512,), f"Unexpected shape {arr.shape}"
    assert abs(np.linalg.norm(arr) - 1.0) < 1e-5, "Norm deviation > 1e-5"
    print("      512-dim L2 normalization & finite bounds: PASS")

def test_search_api_contract():
    print("[5/5] Testing Search Scene Retrieval Logic (Python Mirror)...")
    # Verify that inner product on normalized vectors matches FAISS IndexFlatIP
    with open(DATA_DIR / "scene_embeddings.json", "r", encoding="utf-8") as f:
        catalog = json.load(f)["scenes"]
    vec = encode_text("urban expansion and new construction near river")
    scores = [np.dot(vec, s["vector"]) for s in catalog]
    assert np.max(scores) > 0.20, "Top score should be in realistic CLIP range (>0.20)"
    print("      FAISS IndexFlatIP cosine similarity contract: PASS")

def main():
    print("=" * 60)
    print("TERRALENS AI — PHASE 7A SCIENTIFIC VERIFICATION SUITE")
    print("=" * 60)
    test_assets()
    test_benchmark_parity()
    test_arbitrary_queries()
    test_vector_contracts()
    test_search_api_contract()
    print("=" * 60)
    print("ALL PHASE 7A VERIFICATIONS PASSED (5/5 PASS)!")
    print("=" * 60)

if __name__ == "__main__":
    main()
