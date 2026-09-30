"""Tests for semantic embedding models and SemanticEmbeddingRetrievalService."""

from pathlib import Path
import numpy as np
from PIL import Image
import pytest

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.embedding_service import MockEmbeddingModel, BaseEmbeddingModel
from terralens.app.services.index_service import IndexService
from terralens.app.services.retrieval_service import (
    SemanticEmbeddingRetrievalService,
    PrototypeMetadataRetrievalService,
)


def test_mock_embedding_model_shapes_and_normalization():
    """Verify mock embedding model produces unit-normalized vectors of expected dimension."""
    model = MockEmbeddingModel(dimension=512)

    # 1. Text embedding single and batch
    text_vec = model.embed_text("new buildings near a river")
    assert isinstance(text_vec, np.ndarray)
    assert text_vec.shape == (512,)
    # Check L2 norm
    norm = np.linalg.norm(text_vec)
    assert abs(norm - 1.0) < 1e-5

    batch_text = model.embed_text(["query 1", "query 2"])
    assert batch_text.shape == (2, 512)
    assert abs(np.linalg.norm(batch_text[0]) - 1.0) < 1e-5

    # 2. Image embedding single and batch
    img = Image.new("RGB", (256, 256), color=(30, 80, 120))
    img_vec = model.embed_image(img)
    assert img_vec.shape == (512,)
    assert abs(np.linalg.norm(img_vec) - 1.0) < 1e-5


def test_semantic_retrieval_with_mock_index():
    """Verify SemanticEmbeddingRetrievalService text search and ranking using mock model."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    mock_model = MockEmbeddingModel(dimension=512)

    # Use the real generated index
    index_service = IndexService()
    if not index_service.validate_index_files()[0]:
        pytest.skip("Global index not yet built on disk.")

    retrieval_service = SemanticEmbeddingRetrievalService(
        metadata_service=meta_service,
        dataset_service=dataset_service,
        index_service=index_service,
        embedding_model=mock_model,
    )

    results = retrieval_service.search(query="urban infrastructure buildings", top_k=3)
    assert len(results) > 0
    top = results[0]
    # Check similarity is a real float
    assert top.similarity_score is not None
    assert isinstance(top.similarity_score, float)
    assert "Semantic" in top.similarity_label


def test_similar_location_discovery():
    """Verify finding visually similar locations given a target location ID."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    mock_model = MockEmbeddingModel(dimension=512)
    index_service = IndexService()

    if not index_service.validate_index_files()[0]:
        pytest.skip("Global index not yet built on disk.")

    retrieval_service = SemanticEmbeddingRetrievalService(
        metadata_service=meta_service,
        dataset_service=dataset_service,
        index_service=index_service,
        embedding_model=mock_model,
    )

    target_id = "LOC_001_HYDERABAD_URBAN"
    similar_locs = retrieval_service.find_similar_locations(target_location_id=target_id, top_k=3)

    assert len(similar_locs) > 0
    # Crucial: target itself must be excluded from similar results
    for cand in similar_locs:
        assert cand.location.location_id != target_id
        assert cand.similarity_score is not None


def test_fallback_retrieval_on_missing_index():
    """Verify graceful fallback to PrototypeMetadataRetrievalService if index is missing."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    mock_model = MockEmbeddingModel(dimension=512)

    # Point index_service to non-existent path
    fake_index_service = IndexService(
        index_path=Path("non_existent_dir/missing.index"),
        metadata_path=Path("non_existent_dir/missing.json")
    )

    retrieval_service = SemanticEmbeddingRetrievalService(
        metadata_service=meta_service,
        dataset_service=dataset_service,
        index_service=fake_index_service,
        embedding_model=mock_model,
    )

    # Should not crash, should fall back to metadata search
    results = retrieval_service.search(query="urban", top_k=3)
    assert len(results) > 0
    assert results[0].similarity_score is None  # Fallback engine doesn't claim fake scores
    assert "Prototype" in results[0].engine_name


def test_real_clip_end_to_end_search():
    """Integration test verifying real CLIP model + FAISS cosine similarity ranking."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    index_service = IndexService()

    if not index_service.validate_index_files()[0]:
        pytest.skip("Global FAISS index not built on disk.")

    from terralens.app.services.embedding_service import get_embedding_model
    real_model = get_embedding_model(use_mock=False)

    retrieval_service = SemanticEmbeddingRetrievalService(
        metadata_service=meta_service,
        dataset_service=dataset_service,
        index_service=index_service,
        embedding_model=real_model,
    )

    # 1. Real text search query
    results = retrieval_service.search(query="new buildings and roads", top_k=3)
    assert len(results) > 0
    top_cand = results[0]
    # Check similarity is real float and reasonable for CLIP cosine similarity (usually between 0.15 and 0.45)
    assert top_cand.similarity_score is not None
    assert 0.0 < top_cand.similarity_score <= 1.0
    assert "CLIP baseline" in top_cand.engine_name

    # 2. Real similar location search
    similar = retrieval_service.find_similar_locations("LOC_001_HYDERABAD_URBAN", top_k=2)
    assert len(similar) > 0
    assert similar[0].location.location_id != "LOC_001_HYDERABAD_URBAN"
    assert similar[0].similarity_score is not None
