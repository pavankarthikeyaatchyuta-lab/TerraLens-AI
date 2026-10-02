"""Unit tests for geospatial utilities authored by Hemanth Maddula."""

import pytest
from terralens.app.models.location import BoundingBox
from terralens.app.utils.geo_utils import (
    format_coordinates,
    haversine_distance_km,
    is_point_in_bbox,
    compute_bbox_center,
    calculate_bbox_area_km2,
    calculate_bbox_iou,
    bbox_to_geojson_geometry,
    extract_mgrs_tile,
)


def test_format_coordinates():
    formatted = format_coordinates(17.3850, 78.4867)
    assert "17.3850° N" in formatted
    assert "78.4867° E" in formatted


def test_haversine_distance():
    # Distance between Hyderabad (17.3850, 78.4867) and Bangalore (12.9716, 77.5946) ~ 500 km
    dist = haversine_distance_km(17.3850, 78.4867, 12.9716, 77.5946)
    assert 480 < dist < 520


def test_calculate_bbox_area_and_iou():
    box1 = BoundingBox(min_lat=17.0, min_lon=78.0, max_lat=18.0, max_lon=79.0)
    area = calculate_bbox_area_km2(box1)
    assert area > 10000.0  # Approx 1 degree x 1 degree in tropics is ~11000 km^2

    # Identical boxes should have IoU = 1.0
    iou_identical = calculate_bbox_iou(box1, box1)
    assert iou_identical == 1.0

    # Disjoint boxes should have IoU = 0.0
    box_disjoint = BoundingBox(min_lat=20.0, min_lon=80.0, max_lat=21.0, max_lon=81.0)
    iou_disjoint = calculate_bbox_iou(box1, box_disjoint)
    assert iou_disjoint == 0.0

    # Half overlap
    box_half = BoundingBox(min_lat=17.5, min_lon=78.0, max_lat=18.5, max_lon=79.0)
    iou_half = calculate_bbox_iou(box1, box_half)
    assert 0.3 < iou_half < 0.4


def test_bbox_to_geojson_geometry():
    box = BoundingBox(min_lat=10.0, min_lon=20.0, max_lat=11.0, max_lon=21.0)
    geom = bbox_to_geojson_geometry(box)
    assert geom["type"] == "Polygon"
    coords = geom["coordinates"][0]
    assert len(coords) == 5
    assert coords[0] == coords[-1]  # Closed polygon ring


def test_extract_mgrs_tile():
    scene_id = "S2A_MSIL2A_20230113T051151_N0400_R019_T44QKE_20230113T190636"
    assert extract_mgrs_tile(scene_id) == "T44QKE"
    assert extract_mgrs_tile("INVALID_ID_WITHOUT_MGRS") == ""
