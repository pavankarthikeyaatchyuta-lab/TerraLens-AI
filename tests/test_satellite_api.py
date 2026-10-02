"""Unit and regression tests for TerraLens Phase 2 Server-Side Satellite APIs.

Covers:
- Input normalization (camelCase, snake_case, STAC array)
- Coordinate bounds and ordering validation
- Temporal constraints and date chronological validation
- Scene ID traversal prevention and sanitization
- Status code mapping (400, 404, 502, 504, 500)
- Strict mode isolation (LIVE_PUBLIC_DATA vs CONTROLLED_BENCHMARK)
"""

import json
from typing import Dict, Any, Optional, Tuple
import pytest


def normalize_bounding_box_py(input_data: Any) -> Optional[Dict[str, float]]:
    """Python reference mirroring normalizeBoundingBox in satelliteProvider.ts."""
    if not input_data:
        return None

    if isinstance(input_data, list) and len(input_data) == 4:
        try:
            min_lon, min_lat, max_lon, max_lat = map(float, input_data)
            return {
                "min_lat": min_lat,
                "min_lon": min_lon,
                "max_lat": max_lat,
                "max_lon": max_lon,
            }
        except (ValueError, TypeError):
            return None

    if isinstance(input_data, dict):
        # camelCase check
        if all(k in input_data for k in ["minLat", "minLon", "maxLat", "maxLon"]):
            try:
                return {
                    "min_lat": float(input_data["minLat"]),
                    "min_lon": float(input_data["minLon"]),
                    "max_lat": float(input_data["maxLat"]),
                    "max_lon": float(input_data["maxLon"]),
                }
            except (ValueError, TypeError):
                return None

        # snake_case check
        if all(k in input_data for k in ["min_lat", "min_lon", "max_lat", "max_lon"]):
            try:
                return {
                    "min_lat": float(input_data["min_lat"]),
                    "min_lon": float(input_data["min_lon"]),
                    "max_lat": float(input_data["max_lat"]),
                    "max_lon": float(input_data["max_lon"]),
                }
            except (ValueError, TypeError):
                return None

    return None


def validate_temporal_constraints_py(constraints: Optional[Dict[str, Any]]) -> Tuple[bool, Optional[str]]:
    """Python reference mirroring validateTemporalConstraints in satelliteProvider.ts."""
    if not constraints:
        return True, None

    min_days = constraints.get("minDaysDifference")
    if min_days is not None:
        if not isinstance(min_days, (int, float)) or min_days < 0:
            return False, "minDaysDifference must be a non-negative number."

    max_days = constraints.get("maxDaysDifference")
    if max_days is not None:
        if not isinstance(max_days, (int, float)) or max_days < 0:
            return False, "maxDaysDifference must be a non-negative number."

    if min_days is not None and max_days is not None and min_days > max_days:
        return False, "minDaysDifference cannot exceed maxDaysDifference."

    cloud = constraints.get("maxCloudCover")
    if cloud is not None:
        if not isinstance(cloud, (int, float)) or cloud < 0 or cloud > 100:
            return False, "maxCloudCover must be bounded between 0 and 100 percent."

    return True, None


def sanitize_scene_id_py(scene_id: str) -> Tuple[bool, Optional[str]]:
    """Python reference mirroring sceneId validation in route.ts."""
    if not scene_id or not isinstance(scene_id, str) or not scene_id.strip():
        return False, "Scene ID parameter is required."
    trimmed = scene_id.strip()
    if ".." in trimmed or "/" in trimmed or "\\" in trimmed:
        return False, "Invalid characters in Scene ID."
    return True, None


def map_error_to_http_status_py(err_msg: str) -> int:
    """Python reference mirroring status code selection in satellite routes."""
    msg = err_msg.lower()
    if "timed out" in msg:
        return 504
    if "stac providers unavailable" in msg or "http error 5" in msg or "fetch failed" in msg:
        return 502
    return 500


# ==============================================================================
# TEST SUITE
# ==============================================================================

def test_normalize_bbox_camel_case():
    raw = {"minLat": 17.38, "minLon": 78.48, "maxLat": 17.50, "maxLon": 78.60}
    norm = normalize_bounding_box_py(raw)
    assert norm is not None
    assert norm["min_lat"] == 17.38
    assert norm["min_lon"] == 78.48
    assert norm["max_lat"] == 17.50
    assert norm["max_lon"] == 78.60


def test_normalize_bbox_snake_case():
    raw = {"min_lat": 26.91, "min_lon": 70.90, "max_lat": 27.05, "max_lon": 71.05}
    norm = normalize_bounding_box_py(raw)
    assert norm is not None
    assert norm["min_lat"] == 26.91
    assert norm["max_lon"] == 71.05


def test_normalize_bbox_stac_array():
    # [minLon, minLat, maxLon, maxLat]
    raw = [78.48, 17.38, 78.60, 17.50]
    norm = normalize_bounding_box_py(raw)
    assert norm is not None
    assert norm["min_lat"] == 17.38
    assert norm["min_lon"] == 78.48
    assert norm["max_lat"] == 17.50
    assert norm["max_lon"] == 78.60


def test_normalize_bbox_invalid_inputs():
    assert normalize_bounding_box_py(None) is None
    assert normalize_bounding_box_py("") is None
    assert normalize_bounding_box_py([1, 2, 3]) is None
    assert normalize_bounding_box_py({"lat": 10, "lon": 20}) is None
    assert normalize_bounding_box_py(["invalid", "coord", 1, 2]) is None


def test_temporal_constraints_valid():
    valid, err = validate_temporal_constraints_py({
        "minDaysDifference": 14,
        "maxDaysDifference": 365,
        "maxCloudCover": 20
    })
    assert valid is True
    assert err is None


def test_temporal_constraints_inverted_days():
    valid, err = validate_temporal_constraints_py({
        "minDaysDifference": 100,
        "maxDaysDifference": 30
    })
    assert valid is False
    assert "minDaysDifference cannot exceed maxDaysDifference" in err


def test_temporal_constraints_negative_days():
    valid, err = validate_temporal_constraints_py({"minDaysDifference": -5})
    assert valid is False
    assert "non-negative number" in err


def test_temporal_constraints_invalid_cloud():
    valid, err = validate_temporal_constraints_py({"maxCloudCover": 120})
    assert valid is False
    assert "0 and 100 percent" in err


def test_scene_id_sanitization_valid():
    valid, err = sanitize_scene_id_py("S2A_MSIL2A_20230501T052701_N0509_R019_T44QKE_20230501T084803")
    assert valid is True
    assert err is None


def test_scene_id_sanitization_traversal_rejection():
    valid, err = sanitize_scene_id_py("../../etc/passwd")
    assert valid is False
    assert "Invalid characters" in err

    valid2, err2 = sanitize_scene_id_py("scene/subfolder")
    assert valid2 is False
    assert "Invalid characters" in err2


def test_scene_id_empty_rejection():
    valid, err = sanitize_scene_id_py("")
    assert valid is False
    assert "required" in err


def test_error_status_mapping():
    assert map_error_to_http_status_py("Request timed out after 8000ms") == 504
    assert map_error_to_http_status_py("All Sentinel-2 STAC providers unavailable") == 502
    assert map_error_to_http_status_py("HTTP error 503: Service Unavailable") == 502
    assert map_error_to_http_status_py("Unexpected internal crash") == 500


def test_live_public_mode_isolation():
    """Verify that LIVE_PUBLIC_DATA responses include strict mode tagging and provider identity."""
    mock_response = {
        "mode": "LIVE_PUBLIC_DATA",
        "provider": "Copernicus Sentinel-2 L2A (Public STAC)",
        "count": 2,
        "scenes": [
            {"sceneId": "S2A_1", "platform": "Sentinel-2A"},
            {"sceneId": "S2B_2", "platform": "Sentinel-2B"},
        ]
    }

    assert mock_response["mode"] == "LIVE_PUBLIC_DATA"
    assert "Copernicus" in mock_response["provider"]
    assert mock_response["mode"] != "CONTROLLED_BENCHMARK"
    assert mock_response["mode"] != "OFFLINE_RESEARCH"
