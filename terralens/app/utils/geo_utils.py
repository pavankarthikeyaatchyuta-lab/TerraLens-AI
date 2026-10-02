"""Geospatial helper utilities for coordinates and bounding boxes."""

import math
from typing import Tuple
from terralens.app.models.location import BoundingBox


def format_coordinates(lat: float, lon: float) -> str:
    """Formats latitude and longitude into standard geospatial string."""
    lat_cardinal = "N" if lat >= 0 else "S"
    lon_cardinal = "E" if lon >= 0 else "W"
    return f"{abs(lat):.4f}° {lat_cardinal}, {abs(lon):.4f}° {lon_cardinal}"


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates the great circle distance between two points on Earth in kilometers."""
    r = 6371.0  # Earth's radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def is_point_in_bbox(lat: float, lon: float, bbox: BoundingBox) -> bool:
    """Checks whether a lat/lon point lies inside a bounding box."""
    return (
        bbox.min_lat <= lat <= bbox.max_lat
        and bbox.min_lon <= lon <= bbox.max_lon
    )


def compute_bbox_center(bbox: BoundingBox) -> Tuple[float, float]:
    """Computes the geographic center (lat, lon) of a bounding box."""
    center_lat = (bbox.min_lat + bbox.max_lat) / 2.0
    center_lon = (bbox.min_lon + bbox.max_lon) / 2.0
    return center_lat, center_lon


def calculate_bbox_area_km2(bbox: BoundingBox) -> float:
    """Calculates approximate surface area of a bounding box in square kilometers."""
    # Approximate width and height using haversine
    center_lat = (bbox.min_lat + bbox.max_lat) / 2.0
    width_km = haversine_distance_km(center_lat, bbox.min_lon, center_lat, bbox.max_lon)
    height_km = haversine_distance_km(bbox.min_lat, bbox.min_lon, bbox.max_lat, bbox.min_lon)
    return round(width_km * height_km, 4)


def calculate_bbox_iou(bbox1: BoundingBox, bbox2: BoundingBox) -> float:
    """Calculates Intersection over Union (IoU) between two geospatial bounding boxes."""
    inter_min_lat = max(bbox1.min_lat, bbox2.min_lat)
    inter_max_lat = min(bbox1.max_lat, bbox2.max_lat)
    inter_min_lon = max(bbox1.min_lon, bbox2.min_lon)
    inter_max_lon = min(bbox1.max_lon, bbox2.max_lon)

    if inter_min_lat >= inter_max_lat or inter_min_lon >= inter_max_lon:
        return 0.0

    inter_area = (inter_max_lat - inter_min_lat) * (inter_max_lon - inter_min_lon)
    area1 = (bbox1.max_lat - bbox1.min_lat) * (bbox1.max_lon - bbox1.min_lon)
    area2 = (bbox2.max_lat - bbox2.min_lat) * (bbox2.max_lon - bbox2.min_lon)

    union_area = area1 + area2 - inter_area
    if union_area <= 0.0:
        return 0.0

    return round(inter_area / union_area, 4)


def bbox_to_geojson_geometry(bbox: BoundingBox) -> dict:
    """Converts a BoundingBox into a GeoJSON Polygon geometry."""
    return {
        "type": "Polygon",
        "coordinates": [[
            [bbox.min_lon, bbox.min_lat],
            [bbox.max_lon, bbox.min_lat],
            [bbox.max_lon, bbox.max_lat],
            [bbox.min_lon, bbox.max_lat],
            [bbox.min_lon, bbox.min_lat],
        ]],
    }


def extract_mgrs_tile(scene_id: str) -> str:
    """Extracts MGRS tile identifier from standard Sentinel-2 scene IDs (e.g. T44QKE)."""
    import re
    match = re.search(r"T([0-9]{2}[A-Z]{3})", scene_id)
    if match:
        return f"T{match.group(1)}"
    return ""
