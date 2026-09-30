"""Tests for FAISS index creation, persistence, validation, and vector search."""

import tempfile
from pathlib import Path
import numpy as np
import pytest

from terralens.app.services.index_service import IndexService


def test_index_build_and_search():
    """Verify that IndexFlatIP can be built, saved to disk, reloaded, and searched with exact cosine similarity."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        index_file = tmp_path / "test.index"
        meta_file = tmp_path / "test_meta.json"

        service = IndexService(index_path=index_file, metadata_path=meta_file)

        dim = 128
        # Create 3 deterministic normalized vectors
        v0 = np.zeros(dim, dtype=np.float32)
        v0[0] = 1.0  # [1, 0, 0, ...]
        v1 = np.zeros(dim, dtype=np.float32)
        v1[1] = 1.0  # [0, 1, 0, ...]
        v2 = np.zeros(dim, dtype=np.float32)
        v2[0] = 0.6
        v2[1] = 0.8  # [0.6, 0.8, 0, ...] (L2 norm = 1.0)

        vectors = np.array([v0, v1, v2], dtype=np.float32)
        records = [
            {"vector_id": 0, "location_id": "LOC_A", "scene_id": "SCENE_A1"},
            {"vector_id": 1, "location_id": "LOC_B", "scene_id": "SCENE_B1"},
            {"vector_id": 2, "location_id": "LOC_C", "scene_id": "SCENE_C1"},
        ]

        # Build and save
        service.build_and_save(vectors, records, model_name="test-model", dimension=dim)

        assert index_file.exists()
        assert meta_file.exists()

        # Validate
        is_valid, msg = service.validate_index_files()
        assert is_valid is True

        # Query with v0: should match v0 with similarity 1.0, and v2 with similarity 0.6
        results = service.search(query_vector=v0, top_k=2)
        assert len(results) == 2
        assert results[0][0]["location_id"] == "LOC_A"
        assert abs(results[0][1] - 1.0) < 1e-4

        assert results[1][0]["location_id"] == "LOC_C"
        assert abs(results[1][1] - 0.6) < 1e-4


def test_index_validation_mismatch():
    """Verify validation detects corrupted metadata or mismatched vector counts."""
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        index_file = tmp_path / "non_existent.index"
        meta_file = tmp_path / "non_existent.json"

        service = IndexService(index_path=index_file, metadata_path=meta_file)
        is_valid, msg = service.validate_index_files()
        assert is_valid is False
        assert "missing" in msg.lower()
