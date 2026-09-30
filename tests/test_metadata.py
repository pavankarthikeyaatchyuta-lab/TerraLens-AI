"""Tests for metadata loading, schema validation, and catalog filtering."""

import json
from pathlib import Path
import pytest
from pydantic import ValidationError

from terralens.app.models.scene import Scene
from terralens.app.models.location import Location, BoundingBox
from terralens.app.services.metadata_service import MetadataService
from terralens.app.utils.config import config


def test_scene_validation():
    """Verify that Scene model validates required fields and types."""
    valid_scene_data = {
        "scene_id": "SCENE_TEST_001",
        "location_id": "LOC_001",
        "latitude": 17.44,
        "longitude": 78.37,
        "sensor": "Sentinel-2 MSI",
        "platform": "Sentinel-2A",
        "acquisition_date": "2023-03-15",
        "resolution_meters": 10.0,
        "image_path": "data/samples/LOC_001/before_2023.jpg",
        "cloud_percentage": 1.5,
        "source": "prototype_dataset",
        "tags": ["urban", "water"],
    }
    scene = Scene(**valid_scene_data)
    assert scene.scene_id == "SCENE_TEST_001"
    assert scene.latitude == 17.44
    assert scene.cloud_percentage == 1.5

    # Test invalid date rejection
    invalid_date_data = valid_scene_data.copy()
    invalid_date_data["acquisition_date"] = "not-a-date"
    with pytest.raises(ValidationError):
        Scene(**invalid_date_data)

    # Test invalid latitude rejection
    invalid_lat_data = valid_scene_data.copy()
    invalid_lat_data["latitude"] = 999.0
    with pytest.raises(ValidationError):
        Scene(**invalid_lat_data)


def test_location_validation():
    """Verify that Location model validates coordinates, bounding box, and lists."""
    bbox = BoundingBox(min_lat=17.3, min_lon=78.2, max_lat=17.5, max_lon=78.4)
    loc_data = {
        "location_id": "LOC_TEST_001",
        "name": "Test Location",
        "description": "Validation test site",
        "latitude": 17.4,
        "longitude": 78.3,
        "bounding_box": bbox,
        "primary_sensor": "Sentinel-2 MSI",
        "available_dates": ["2023-01-01", "2025-01-01"],
        "tags": ["test", "urban"],
        "source": "prototype_dataset",
    }
    loc = Location(**loc_data)
    assert loc.location_id == "LOC_TEST_001"
    assert loc.bounding_box.min_lat == 17.3
    assert len(loc.tags) == 2


def test_metadata_service_loading():
    """Verify MetadataService loads the generated locations.json correctly."""
    service = MetadataService()
    locations = service.get_all_locations()
    assert len(locations) >= 5

    # Check specific location
    hyderabad = service.get_location_by_id("LOC_001_HYDERABAD_URBAN")
    assert hyderabad is not None
    assert "urban" in hyderabad.tags
    assert len(hyderabad.available_dates) == 2

    # Check associated scenes
    scenes = service.get_scenes_for_location("LOC_001_HYDERABAD_URBAN")
    assert len(scenes) == 2
    assert scenes[0].acquisition_date < scenes[1].acquisition_date


def test_metadata_service_filtering():
    """Verify filtering locations by sensor, tags, and cloud cover threshold."""
    service = MetadataService()

    # Filter by tag
    urban_locs = service.filter_locations(tag="urban")
    assert any(l.location_id == "LOC_001_HYDERABAD_URBAN" for l in urban_locs)

    solar_locs = service.filter_locations(tag="solar")
    assert any(l.location_id == "LOC_005_THAR_SOLAR_PARK" for l in solar_locs)

    # Filter by cloud threshold
    clear_locs = service.filter_locations(max_cloud=5.0)
    assert len(clear_locs) > 0

    zero_cloud_locs = service.filter_locations(max_cloud=0.0)
    # Since prototype cloud percentage is ~1-2%, threshold 0.0 will filter them out
    assert len(zero_cloud_locs) == 0
