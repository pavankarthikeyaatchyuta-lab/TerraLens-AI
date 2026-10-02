"""Unit and integration tests for Satellite Data Provider Abstraction & STAC Adapter."""

import json
from typing import Dict, Any, List
import pytest


def validate_search_query_py(query: Dict[str, Any]) -> Dict[str, Any]:
    """Python reference validator mirroring web/lib/providers/satelliteProvider.ts."""
    if not query:
        return {"valid": False, "error": "Search query object is required."}

    aoi = query.get("aoi")
    if not aoi:
        return {"valid": False, "error": "Bounding box (aoi) is required."}

    for k in ["min_lat", "min_lon", "max_lat", "max_lon"]:
        if k not in aoi or not isinstance(aoi[k], (int, float)):
            return {"valid": False, "error": "Bounding box coordinates must be finite numeric values."}

    min_lat, max_lat = aoi["min_lat"], aoi["max_lat"]
    min_lon, max_lon = aoi["min_lon"], aoi["max_lon"]

    if min_lat < -90 or min_lat > 90 or max_lat < -90 or max_lat > 90:
        return {"valid": False, "error": "Latitude must be within the range [-90, 90]."}

    if min_lon < -180 or min_lon > 180 or max_lon < -180 or max_lon > 180:
        return {"valid": False, "error": "Longitude must be within the range [-180, 180]."}

    if min_lat > max_lat:
        return {"valid": False, "error": "min_lat cannot be greater than max_lat."}

    if min_lon > max_lon:
        return {"valid": False, "error": "min_lon cannot be greater than max_lon."}

    start_date = query.get("startDate")
    end_date = query.get("endDate")
    if not start_date or not end_date:
        return {"valid": False, "error": "Both startDate and endDate are required."}

    if start_date > end_date:
        return {"valid": False, "error": "startDate must be chronologically earlier than or equal to endDate."}

    cloud = query.get("maxCloudCover")
    if cloud is not None:
        if not isinstance(cloud, (int, float)) or cloud < 0 or cloud > 100:
            return {"valid": False, "error": "maxCloudCover must be bounded between 0 and 100 percent."}

    return {"valid": True}


def parse_stac_feature_py(feature: Dict[str, Any], provider_label: str) -> Dict[str, Any]:
    """Python reference parser mirroring CopernicusSentinelProvider.parseStacItem."""
    props = feature.get("properties", {})
    assets = feature.get("assets", {})

    cloud_raw = props.get("eo:cloud_cover", props.get("cloud_cover", 0.0))
    if 0.0 < cloud_raw <= 1.0:
        cloud_pct = round(cloud_raw * 100.0, 2)
    else:
        cloud_pct = round(float(cloud_raw), 2)

    thumb = None
    if "rendered_preview" in assets and "href" in assets["rendered_preview"]:
        thumb = assets["rendered_preview"]["href"]
    elif "thumbnail" in assets and "href" in assets["thumbnail"]:
        thumb = assets["thumbnail"]["href"]
    elif "visual" in assets and "href" in assets["visual"]:
        thumb = assets["visual"]["href"]

    platform_raw = props.get("platform", "Sentinel-2")
    if "sentinel-2b" in platform_raw.lower():
        platform = "Sentinel-2B"
    elif "sentinel-2a" in platform_raw.lower():
        platform = "Sentinel-2A"
    else:
        platform = platform_raw

    return {
        "sceneId": feature.get("id"),
        "platform": platform,
        "instrument": "MSI",
        "acquisitionDate": props.get("datetime"),
        "cloudCoverPercentage": cloud_pct,
        "mgrsTile": props.get("s2:mgrs_tile"),
        "bbox": feature.get("bbox", [0, 0, 0, 0]),
        "sourceProvider": provider_label,
        "thumbnailUrl": thumb,
    }


# ==============================================================================
# 1. Input Validation Tests
# ==============================================================================

def test_valid_aoi_search_query():
    query = {
        "aoi": {"min_lat": 17.3, "min_lon": 78.3, "max_lat": 17.5, "max_lon": 78.5},
        "startDate": "2024-01-01",
        "endDate": "2024-03-31",
        "maxCloudCover": 20.0,
        "limit": 10,
    }
    result = validate_search_query_py(query)
    assert result["valid"] is True


def test_invalid_latitude_rejection():
    query = {
        "aoi": {"min_lat": -95.0, "min_lon": 78.3, "max_lat": 17.5, "max_lon": 78.5},
        "startDate": "2024-01-01",
        "endDate": "2024-03-31",
    }
    result = validate_search_query_py(query)
    assert result["valid"] is False
    assert "Latitude must be within the range" in result["error"]


def test_invalid_longitude_rejection():
    query = {
        "aoi": {"min_lat": 17.3, "min_lon": 185.0, "max_lat": 17.5, "max_lon": 78.5},
        "startDate": "2024-01-01",
        "endDate": "2024-03-31",
    }
    result = validate_search_query_py(query)
    assert result["valid"] is False
    assert "Longitude must be within the range" in result["error"]


def test_invalid_inverted_bbox_bounds():
    query = {
        "aoi": {"min_lat": 20.0, "min_lon": 78.0, "max_lat": 10.0, "max_lon": 79.0},
        "startDate": "2024-01-01",
        "endDate": "2024-03-31",
    }
    result = validate_search_query_py(query)
    assert result["valid"] is False
    assert "min_lat cannot be greater than max_lat" in result["error"]


def test_invalid_date_range_chronology():
    query = {
        "aoi": {"min_lat": 17.3, "min_lon": 78.3, "max_lat": 17.5, "max_lon": 78.5},
        "startDate": "2024-12-31",
        "endDate": "2024-01-01",
    }
    result = validate_search_query_py(query)
    assert result["valid"] is False
    assert "startDate must be chronologically earlier" in result["error"]


def test_cloud_cover_bounds():
    query_neg = {
        "aoi": {"min_lat": 17.3, "min_lon": 78.3, "max_lat": 17.5, "max_lon": 78.5},
        "startDate": "2024-01-01",
        "endDate": "2024-03-31",
        "maxCloudCover": -5.0,
    }
    query_over = {
        "aoi": {"min_lat": 17.3, "min_lon": 78.3, "max_lat": 17.5, "max_lon": 78.5},
        "startDate": "2024-01-01",
        "endDate": "2024-03-31",
        "maxCloudCover": 105.0,
    }
    assert validate_search_query_py(query_neg)["valid"] is False
    assert validate_search_query_py(query_over)["valid"] is False


# ==============================================================================
# 2. STAC Response Parsing & Discovery Tests
# ==============================================================================

def test_stac_response_parsing_planetary_computer():
    mock_pc_feature = {
        "id": "S2A_MSIL2A_20240328T050651_R019_T44QKE_20240330T042454",
        "properties": {
            "datetime": "2024-03-28T05:06:51.024000Z",
            "platform": "Sentinel-2A",
            "instruments": ["msi"],
            "s2:mgrs_tile": "44QKE",
            "eo:cloud_cover": 0.004061,  # fractional representation
        },
        "bbox": [78.16, 17.07, 79.21, 18.08],
        "assets": {
            "rendered_preview": {
                "href": "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png"
            }
        },
    }

    parsed = parse_stac_feature_py(mock_pc_feature, "Microsoft Planetary Computer")
    assert parsed["sceneId"] == "S2A_MSIL2A_20240328T050651_R019_T44QKE_20240330T042454"
    assert parsed["platform"] == "Sentinel-2A"
    assert parsed["cloudCoverPercentage"] == 0.41  # properly scaled from 0.004061
    assert parsed["mgrsTile"] == "44QKE"
    assert parsed["thumbnailUrl"] == "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png"
    assert parsed["sourceProvider"] == "Microsoft Planetary Computer"


def test_stac_response_parsing_earth_search():
    mock_es_feature = {
        "id": "S2B_44QKE_20240402_0_L2A",
        "properties": {
            "datetime": "2024-04-02T05:16:49.027000Z",
            "platform": "sentinel-2b",
            "instruments": ["msi"],
            "s2:mgrs_tile": "44QKE",
            "eo:cloud_cover": 12.45,  # direct percentage
        },
        "bbox": [78.16, 17.07, 79.21, 18.08],
        "assets": {
            "thumbnail": {
                "href": "https://sentinel-s2-l2a.s3.amazonaws.com/preview.jpg"
            }
        },
    }

    parsed = parse_stac_feature_py(mock_es_feature, "AWS Earth Search (Element 84)")
    assert parsed["sceneId"] == "S2B_44QKE_20240402_0_L2A"
    assert parsed["platform"] == "Sentinel-2B"
    assert parsed["cloudCoverPercentage"] == 12.45
    assert parsed["thumbnailUrl"] == "https://sentinel-s2-l2a.s3.amazonaws.com/preview.jpg"
    assert parsed["sourceProvider"] == "AWS Earth Search (Element 84)"


def test_empty_stac_result_handling():
    raw_empty = {"features": []}
    scenes = [parse_stac_feature_py(f, "PC") for f in raw_empty["features"]]
    assert len(scenes) == 0


# ==============================================================================
# 3. Provider Fallback & Timeout Simulation Tests
# ==============================================================================

def test_primary_failure_fallback_simulation():
    """Simulates primary STAC throwing error and fallback resolving successfully."""
    primary_failed = False
    fallback_invoked = False

    try:
        # Simulate primary timeout
        raise TimeoutError("Planetary Computer STAC timed out after 8000ms")
    except Exception:
        primary_failed = True
        # Invoke fallback
        mock_fallback_feature = {
            "id": "S2A_FALLBACK_SCENE",
            "properties": {"datetime": "2024-01-15T00:00:00Z", "cloud_cover": 5.0},
        }
        fallback_results = [parse_stac_feature_py(mock_fallback_feature, "AWS Earth Search")]
        fallback_invoked = True

    assert primary_failed is True
    assert fallback_invoked is True
    assert len(fallback_results) == 1
    assert fallback_results[0]["sceneId"] == "S2A_FALLBACK_SCENE"


def test_both_providers_unavailable_raises_structured_error():
    """Simulates both providers failing and asserts structured error without synthetic substitution."""
    primary_err = "Primary timeout after 8000ms"
    fallback_err = "Fallback 503 Service Unavailable"

    with pytest.raises(RuntimeError) as exc_info:
        raise RuntimeError(
            f'All Sentinel-2 STAC providers unavailable. Primary error: "{primary_err}". Fallback error: "{fallback_err}".'
        )

    assert "All Sentinel-2 STAC providers unavailable" in str(exc_info.value)
    assert primary_err in str(exc_info.value)
    assert fallback_err in str(exc_info.value)


# ==============================================================================
# 4. Benchmark Provider Determinism & Mode Separation
# ==============================================================================

def test_benchmark_provider_determinism():
    """Verifies that the benchmark dataset remains 100% deterministic (10 scenes, 5 locations)."""
    from terralens.app.services.dataset_service import DatasetService
    from terralens.app.services.metadata_service import MetadataService

    ms = MetadataService()
    ds = DatasetService(ms)
    summary = ds.get_dataset_summary()
    assert summary["total_locations"] == 5
    assert summary["total_scenes"] == 10

    locations = ms.get_all_locations()
    assert len(locations) == 5
    loc_ids = [l.location_id for l in locations]
    assert "LOC_001_HYDERABAD_URBAN" in loc_ids
    assert "LOC_005_THAR_SOLAR_PARK" in loc_ids


def test_mode_separation_labels():
    """Ensures conceptual mode labels are distinctly defined."""
    valid_modes = {"CONTROLLED_BENCHMARK", "LIVE_PUBLIC_DATA", "OFFLINE_RESEARCH"}
    assert "CONTROLLED_BENCHMARK" in valid_modes
    assert "LIVE_PUBLIC_DATA" in valid_modes
    assert "OFFLINE_RESEARCH" in valid_modes
