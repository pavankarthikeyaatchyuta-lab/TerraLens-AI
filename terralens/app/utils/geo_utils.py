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
