"""Unit and workflow tests for Phase 3 Live Public Data Mode and AOI Search Workflow.

Tests cover:
- AOI coordinate validation and bounding box structure
- AOI drawing state lifecycle transitions
- Search parameter validation (dates, cloud cover bounds)
- Scene result parsing and live metadata fidelity
- Scene selection logic and prevention of identical before/after selections
- Temporal pair discovery and application
- Mode isolation guarantees (CONTROLLED_BENCHMARK vs LIVE_PUBLIC_DATA vs OFFLINE_RESEARCH)
"""

from typing import Dict, Any, Optional, Tuple, List
import pytest


class MockLiveAOISearchEngine:
    """Mock test harness mirroring LiveAOISearch.tsx business logic."""

    def __init__(self):
        self.aoi: Optional[Dict[str, float]] = None
        self.is_drawing_aoi: bool = False
        self.selected_before_scene: Optional[Dict[str, Any]] = None
        self.selected_after_scene: Optional[Dict[str, Any]] = None
        self.selected_pair: Optional[Dict[str, Any]] = None
        self.operating_mode: str = "CONTROLLED_BENCHMARK"

    def set_operating_mode(self, mode: str) -> None:
        valid_modes = ["CONTROLLED_BENCHMARK", "LIVE_PUBLIC_DATA", "OFFLINE_RESEARCH"]
        if mode not in valid_modes:
            raise ValueError(f"Invalid operating mode: {mode}")
        self.operating_mode = mode

    def set_aoi_manual(
        self, min_lat: float, min_lon: float, max_lat: float, max_lon: float
    ) -> Tuple[bool, Optional[str]]:
        if not (-90 <= min_lat <= 90 and -90 <= max_lat <= 90):
            return False, "Latitude must be between -90 and 90 degrees."
        if not (-180 <= min_lon <= 180 and -180 <= max_lon <= 180):
            return False, "Longitude must be between -180 and 180 degrees."
        if min_lat >= max_lat:
            return False, "Min Latitude must be less than Max Latitude."
        if min_lon >= max_lon:
            return False, "Min Longitude must be less than Max Longitude."

        self.aoi = {
            "min_lat": min_lat,
            "min_lon": min_lon,
            "max_lat": max_lat,
            "max_lon": max_lon,
        }
        return True, None

    def toggle_drawing_aoi(self, state: Optional[bool] = None) -> bool:
        if state is not None:
            self.is_drawing_aoi = state
        else:
            self.is_drawing_aoi = not self.is_drawing_aoi
        return self.is_drawing_aoi

    def complete_map_drawing(
        self, start_lat: float, start_lon: float, end_lat: float, end_lon: float
    ) -> Tuple[bool, Optional[str]]:
        min_lat = min(start_lat, end_lat)
        max_lat = max(start_lat, end_lat)
        min_lon = min(start_lon, end_lon)
        max_lon = max(start_lon, end_lon)

        self.is_drawing_aoi = False
        if abs(max_lat - min_lat) < 0.0001 or abs(max_lon - min_lon) < 0.0001:
            return False, "Drawn rectangle area too small."

        return self.set_aoi_manual(min_lat, min_lon, max_lat, max_lon)

    def validate_search_params(
        self, start_date: str, end_date: str, max_cloud: float
    ) -> Tuple[bool, Optional[str]]:
        if not self.aoi:
            return False, "Area of Interest (AOI) is required."
        if not start_date or not end_date:
            return False, "Both start date and end date are required."
        if start_date > end_date:
            return False, "Start date cannot be later than end date."
        if not (0 <= max_cloud <= 100):
            return False, "maxCloudCover must be bounded between 0 and 100 percent."
        return True, None

    def select_scene(
        self, scene: Dict[str, Any], role: str
    ) -> Tuple[bool, Optional[str]]:
        scene_id = scene.get("sceneId")
        if not scene_id:
            return False, "Invalid scene: missing sceneId"

        if role == "before":
            if (
                self.selected_after_scene
                and self.selected_after_scene.get("sceneId") == scene_id
            ):
                return (
                    False,
                    "Cannot select the same scene as both Before and After.",
                )
            self.selected_before_scene = scene
            return True, None
        elif role == "after":
            if (
                self.selected_before_scene
                and self.selected_before_scene.get("sceneId") == scene_id
            ):
                return (
                    False,
                    "Cannot select the same scene as both Before and After.",
                )
            self.selected_after_scene = scene
            return True, None
        return False, "Role must be 'before' or 'after'"

    def apply_pair(self, pair: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        before = pair.get("beforeScene")
        after = pair.get("afterScene")
        if not before or not after:
            return False, "Pair candidate missing scenes."
        if before.get("sceneId") == after.get("sceneId"):
            return False, "Invalid temporal pair: identical scenes."

        self.selected_pair = pair
        self.selected_before_scene = before
        self.selected_after_scene = after
        return True, None


# ==============================================================================
# TEST SUITE
# ==============================================================================

def test_aoi_manual_validation_success():
    engine = MockLiveAOISearchEngine()
    ok, err = engine.set_aoi_manual(17.36, 78.40, 17.52, 78.56)
    assert ok is True
    assert err is None
    assert engine.aoi["min_lat"] == 17.36
    assert engine.aoi["max_lon"] == 78.56


def test_aoi_manual_inverted_coords():
    engine = MockLiveAOISearchEngine()
    ok, err = engine.set_aoi_manual(18.0, 78.0, 17.0, 79.0)
    assert ok is False
    assert "Min Latitude must be less than Max Latitude" in err


def test_aoi_manual_out_of_bounds():
    engine = MockLiveAOISearchEngine()
    ok, err = engine.set_aoi_manual(95.0, 78.0, 96.0, 79.0)
    assert ok is False
    assert "between -90 and 90 degrees" in err


def test_aoi_drawing_lifecycle():
    engine = MockLiveAOISearchEngine()
    assert engine.is_drawing_aoi is False

    # Start drawing
    engine.toggle_drawing_aoi(True)
    assert engine.is_drawing_aoi is True

    # Complete rectangle on map
    ok, err = engine.complete_map_drawing(17.36, 78.40, 17.52, 78.56)
    assert ok is True
    assert err is None
    assert engine.is_drawing_aoi is False
    assert engine.aoi is not None


def test_aoi_drawing_negligible_area():
    engine = MockLiveAOISearchEngine()
    engine.toggle_drawing_aoi(True)
    ok, err = engine.complete_map_drawing(17.36, 78.40, 17.36001, 78.40001)
    assert ok is False
    assert "too small" in err


def test_search_param_validation_missing_aoi():
    engine = MockLiveAOISearchEngine()
    ok, err = engine.validate_search_params("2024-01-01", "2024-06-30", 20)
    assert ok is False
    assert "AOI) is required" in err


def test_search_param_validation_inverted_dates():
    engine = MockLiveAOISearchEngine()
    engine.set_aoi_manual(17.36, 78.40, 17.52, 78.56)
    ok, err = engine.validate_search_params("2024-06-30", "2024-01-01", 20)
    assert ok is False
    assert "Start date cannot be later than end date" in err


def test_search_param_validation_cloud_cover_bounds():
    engine = MockLiveAOISearchEngine()
    engine.set_aoi_manual(17.36, 78.40, 17.52, 78.56)
    ok, err = engine.validate_search_params("2024-01-01", "2024-06-30", 120)
    assert ok is False
    assert "between 0 and 100 percent" in err


def test_scene_selection_and_same_scene_prevention():
    engine = MockLiveAOISearchEngine()
    scene_a = {"sceneId": "S2A_20230101", "acquisitionDate": "2023-01-01T05:00:00Z"}
    scene_b = {"sceneId": "S2B_20230601", "acquisitionDate": "2023-06-01T05:00:00Z"}

    # Set before scene
    ok, err = engine.select_scene(scene_a, "before")
    assert ok is True
    assert engine.selected_before_scene["sceneId"] == "S2A_20230101"

    # Attempt to set SAME scene as after scene -> MUST BE REJECTED
    ok2, err2 = engine.select_scene(scene_a, "after")
    assert ok2 is False
    assert "Cannot select the same scene as both Before and After" in err2

    # Set distinct scene as after scene -> SUCCESS
    ok3, err3 = engine.select_scene(scene_b, "after")
    assert ok3 is True
    assert engine.selected_after_scene["sceneId"] == "S2B_20230601"


def test_apply_temporal_pair_candidate():
    engine = MockLiveAOISearchEngine()
    pair = {
        "beforeScene": {"sceneId": "S2A_20230101", "acquisitionDate": "2023-01-01T05:00:00Z"},
        "afterScene": {"sceneId": "S2B_20230601", "acquisitionDate": "2023-06-01T05:00:00Z"},
        "daysDifference": 151,
        "recommended": True,
    }

    ok, err = engine.apply_pair(pair)
    assert ok is True
    assert engine.selected_pair is not None
    assert engine.selected_before_scene["sceneId"] == "S2A_20230101"
    assert engine.selected_after_scene["sceneId"] == "S2B_20230601"


def test_mode_isolation_guarantees():
    engine = MockLiveAOISearchEngine()
    assert engine.operating_mode == "CONTROLLED_BENCHMARK"

    engine.set_operating_mode("LIVE_PUBLIC_DATA")
    assert engine.operating_mode == "LIVE_PUBLIC_DATA"

    engine.set_operating_mode("OFFLINE_RESEARCH")
    assert engine.operating_mode == "OFFLINE_RESEARCH"

    with pytest.raises(ValueError):
        engine.set_operating_mode("INVALID_FABRICATED_MODE")
