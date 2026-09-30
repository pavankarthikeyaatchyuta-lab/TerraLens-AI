"""Tests for dataset discovery, image loading, and physical file integrity."""

from pathlib import Path
from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.utils.image_utils import load_image_safely, generate_thumbnail, get_image_dimensions


def test_dataset_service_summary():
    """Verify DatasetService audits dataset health without crashing."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)

    summary = dataset_service.get_dataset_summary()
    assert summary["status"] == "Healthy"
    assert summary["total_locations"] >= 5
    assert summary["total_scenes"] >= 10
    assert summary["valid_scenes_on_disk"] == summary["total_scenes"]
    assert summary["missing_scenes_count"] == 0
    assert summary["is_prototype"] is True


def test_image_loading_and_dimensions():
    """Verify that sample satellite images can be safely loaded and read as RGB."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)

    loc = meta_service.get_location_by_id("LOC_001_HYDERABAD_URBAN")
    assert loc is not None

    paths = dataset_service.get_location_imagery_paths(loc)
    assert paths["before"] is not None
    assert paths["after"] is not None

    img_before = load_image_safely(paths["before"])
    assert img_before is not None
    assert img_before.size == (512, 512)
    assert img_before.mode == "RGB"

    dims = get_image_dimensions(paths["before"])
    assert dims == (512, 512)


def test_thumbnail_generation():
    """Verify proportional thumbnail generation."""
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)

    loc = meta_service.get_location_by_id("LOC_002_GODAVARI_RESERVOIR")
    paths = dataset_service.get_location_imagery_paths(loc)

    thumb = generate_thumbnail(paths["before"], max_size=(128, 128))
    assert thumb is not None
    assert thumb.size[0] <= 128
    assert thumb.size[1] <= 128


def test_missing_image_graceful_handling():
    """Verify that missing files return None and do not raise unhandled exceptions."""
    non_existent = Path("data/samples/non_existent_folder/missing.jpg")
    img = load_image_safely(non_existent)
    assert img is None

    # Thumbnail of missing image falls back to placeholder safely
    thumb = generate_thumbnail(non_existent, max_size=(64, 64))
    assert thumb is not None
    assert thumb.size == (64, 64)
