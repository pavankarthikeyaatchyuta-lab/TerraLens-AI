"""Tests for candidate location search and retrieval service."""

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.retrieval_service import PrototypeMetadataRetrievalService


def test_empty_query_retrieval():
    """Empty query should retrieve all catalogued candidate locations."""
    meta_service = MetadataService()
    retrieval_service = PrototypeMetadataRetrievalService(meta_service)

    results = retrieval_service.search(query="")
    assert len(results) == len(meta_service.get_all_locations())
    for r in results:
        # Crucial: Check that no fake similarity scores are generated
        assert r.similarity_score is None
        assert "Prototype" in r.engine_name


def test_keyword_query_retrieval():
    """Specific query terms should rank matching locations."""
    meta_service = MetadataService()
    retrieval_service = PrototypeMetadataRetrievalService(meta_service)

    # Search for urban / river
    results = retrieval_service.search(query="new buildings near a river")
    assert len(results) >= 1
    top_loc_id = results[0].location.location_id
    assert top_loc_id == "LOC_001_HYDERABAD_URBAN"
    assert "Tag" in results[0].match_reason or "Name" in results[0].match_reason or "Context" in results[0].match_reason

    # Search for solar panels
    solar_results = retrieval_service.search(query="solar panels")
    assert len(solar_results) >= 1
    assert any(c.location.location_id == "LOC_005_THAR_SOLAR_PARK" for c in solar_results)


def test_filtered_retrieval():
    """Search combined with sensor and tag filters."""
    meta_service = MetadataService()
    retrieval_service = PrototypeMetadataRetrievalService(meta_service)

    results = retrieval_service.search(
        query="",
        sensor_filter="Sentinel-2 MSI",
        tag_filter="forest"
    )
    assert len(results) == 1
    assert results[0].location.location_id == "LOC_003_WESTERN_GHATS_FOREST"
