"""Tests for temporal pair assembly, spatial alignment checks, and honest change detection status."""

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.temporal_service import TemporalAnalysisService


def test_temporal_pair_loading():
    """Verify loading temporal pairs for locations with complete before/after imagery."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    temporal_service = TemporalAnalysisService(meta_service, dataset_service)

    loc = meta_service.get_location_by_id("LOC_001_HYDERABAD_URBAN")
    pair = temporal_service.load_temporal_pair(loc)

    assert pair.is_complete is True
    assert pair.before_image is not None
    assert pair.after_image is not None
    assert pair.before_scene.acquisition_date < pair.after_scene.acquisition_date


def test_spatial_alignment():
    """Verify image dimension reconciliation and alignment status report."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    temporal_service = TemporalAnalysisService(meta_service, dataset_service)

    loc = meta_service.get_location_by_id("LOC_001_HYDERABAD_URBAN")
    pair = temporal_service.load_temporal_pair(loc)

    aligned_b, aligned_a, status = temporal_service.align_images(pair.before_image, pair.after_image)
    assert aligned_b.size == aligned_a.size
    assert "Identity" in status or "Resized" in status


def test_detect_change_honest_status():
    """Verify that detect_change explicitly returns NOT_IMPLEMENTED with no fabricated confidence scores."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    temporal_service = TemporalAnalysisService(meta_service, dataset_service)

    loc = meta_service.get_location_by_id("LOC_001_HYDERABAD_URBAN")
    pair = temporal_service.load_temporal_pair(loc)

    result = temporal_service.detect_change(pair.before_image, pair.after_image)

    # Strictly honest: No fake scores or claimed models
    assert result.status == "NOT_IMPLEMENTED"
    assert result.confidence_score is None
    assert result.change_mask is None
    assert "Phase 2" in result.message
