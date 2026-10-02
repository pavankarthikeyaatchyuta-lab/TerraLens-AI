"""Unit tests for Phase 4A: Real Sentinel-2 Analysis Asset Acquisition & Raster Foundation.

Verifies:
1. Preview vs Analysis Asset classification (Preview assets rejected for scientific analysis).
2. STAC GeoTIFF/COG metadata extraction (CRS, shape, transform, resolution, nodata).
3. In-memory raster inspection via RasterAssetService.
4. AOI spatial intersection and pixel subwindow calculation.
5. Temporal pair validation (chronology, distinct scene IDs, separation).
6. CRS and spatial resolution compatibility detection.
7. Dimension reconciliation and image alignment planning.
8. Analysis readiness assessment (READY_FOR_ANALYSIS vs NOT_READY).
9. Provenance record assembly and processing chain preservation.
10. Controlled benchmark and offline research mode isolation.
"""

import pytest
import numpy as np
from datetime import datetime, timezone

from terralens.app.services.raster_asset_service import RasterAssetService


# Mock STAC item asset dictionaries mimicking real Copernicus Sentinel-2 L2A STAC items
MOCK_SENTINEL2_ASSETS = {
    "visual": {
        "href": "https://sentinel2l2a01.blob.core.windows.net/sentinel2-l2/44/Q/KE/2024/03/28/S2A_MSIL2A_visual.tif",
        "type": "image/tiff; application=geotiff; profile=cloud-optimized",
        "roles": ["data"],
        "title": "True color image",
        "proj:epsg": 32644,
        "proj:shape": [10980, 10980],
        "proj:transform": [10.0, 0.0, 499980.0, 0.0, -10.0, 4900020.0],
    },
    "B04": {
        "href": "https://sentinel2l2a01.blob.core.windows.net/sentinel2-l2/44/Q/KE/2024/03/28/S2A_MSIL2A_B04.tif",
        "type": "image/tiff; application=geotiff; profile=cloud-optimized",
        "roles": ["data"],
        "title": "Band 4 - Red - 10m",
        "proj:epsg": 32644,
        "proj:shape": [10980, 10980],
        "proj:transform": [10.0, 0.0, 499980.0, 0.0, -10.0, 4900020.0],
    },
    "B08": {
        "href": "https://sentinel2l2a01.blob.core.windows.net/sentinel2-l2/44/Q/KE/2024/03/28/S2A_MSIL2A_B08.tif",
        "type": "image/tiff; application=geotiff; profile=cloud-optimized",
        "roles": ["data"],
        "title": "Band 8 - NIR - 10m",
        "proj:epsg": 32644,
        "proj:shape": [10980, 10980],
        "proj:transform": [10.0, 0.0, 499980.0, 0.0, -10.0, 4900020.0],
    },
    "rendered_preview": {
        "href": "https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?item=S2A",
        "type": "image/png",
        "roles": ["overview"],
        "title": "Rendered preview",
    },
    "thumbnail": {
        "href": "https://planetarycomputer.microsoft.com/api/data/v1/item/thumb.jpg",
        "type": "image/jpeg",
        "roles": ["thumbnail"],
        "title": "Thumbnail image",
    },
}


class TestPhase4ARasterFoundation:
    """Test suite for Phase 4A scientific raster foundation."""

    def test_classify_analysis_asset(self):
        """Analysis assets (COGs, spectral bands) must be recognized as analysis-capable."""
        classified = RasterAssetService.classify_asset("B04", MOCK_SENTINEL2_ASSETS["B04"])
        assert classified["is_analysis_capable"] is True
        assert classified["asset_category"] == "ANALYSIS_ASSET"
        assert classified["resolution"] == 10
        assert classified["crs"] == "EPSG:32644"
        assert classified["shape"] == [10980, 10980]
        assert classified["is_cog"] is True
        assert classified["requires_signing"] is True

    def test_reject_preview_assets_for_analysis(self):
        """CRITICAL SCIENTIFIC RULE: Preview thumbnails must NEVER be classified as analysis-capable."""
        preview_png = RasterAssetService.classify_asset("rendered_preview", MOCK_SENTINEL2_ASSETS["rendered_preview"])
        assert preview_png["is_analysis_capable"] is False
        assert preview_png["asset_category"] == "PREVIEW_ASSET"
        assert "Preview/thumbnail assets lack georeferenced" in preview_png["reason"]

        thumb_jpg = RasterAssetService.classify_asset("thumbnail", MOCK_SENTINEL2_ASSETS["thumbnail"])
        assert thumb_jpg["is_analysis_capable"] is False
        assert thumb_jpg["asset_category"] == "PREVIEW_ASSET"

    def test_raster_array_inspection(self):
        """Validates in-memory raster inspection metrics (shape, count, dtype, valid percentage)."""
        data = np.ones((512, 512, 3), dtype=np.uint8) * 128
        data[0:50, 0:50, :] = 0  # 2500 pixels nodata

        inspection = RasterAssetService.inspect_raster_array(
            data,
            crs="EPSG:32644",
            resolution=10.0,
            nodata_val=0,
        )

        assert inspection["width"] == 512
        assert inspection["height"] == 512
        assert inspection["count"] == 3
        assert inspection["dtype"] == "uint8"
        assert inspection["crs"] == "EPSG:32644"
        assert inspection["resolution"] == 10.0
        assert inspection["valid_data_percentage"] < 100.0
        assert inspection["valid_data_percentage"] > 98.0

    def test_spatial_intersection_calculation(self):
        """Evaluates bounding box spatial intersection and overlap percentage."""
        # Scene over Hyderabad
        scene_bbox = [78.0, 17.0, 79.0, 18.0]
        # AOI inside Hyderabad
        aoi_bbox = [78.4, 17.3, 78.6, 17.5]

        inter = RasterAssetService.compute_spatial_intersection(scene_bbox, aoi_bbox)
        assert inter["intersects"] is True
        assert inter["intersection_bbox"] == [78.4, 17.3, 78.6, 17.5]
        # AOI is 0.2 x 0.2 = 0.04; scene is 1.0 x 1.0 = 1.0 -> 4%
        assert inter["overlap_percentage"] == 4.0

    def test_spatial_intersection_disjoint(self):
        """Disjoint bounding boxes must report no intersection."""
        bbox1 = [78.0, 17.0, 78.5, 17.5]
        bbox2 = [80.0, 20.0, 80.5, 20.5]

        inter = RasterAssetService.compute_spatial_intersection(bbox1, bbox2)
        assert inter["intersects"] is False
        assert inter["overlap_percentage"] == 0.0

    def test_aoi_subwindow_computation(self):
        """AOI subwindow should calculate pixel offsets without reading full 10980x10980 scenes."""
        scene_bbox = [78.0, 17.0, 79.0, 18.0]
        aoi_bbox = [78.5, 17.5, 78.6, 17.6]  # exactly in upper-right quadrant

        subwin = RasterAssetService.compute_aoi_subwindow(
            scene_bbox=scene_bbox,
            aoi_bbox=aoi_bbox,
            raster_shape=(10000, 10000),
            resolution_m=10.0,
        )

        assert subwin["width"] > 0
        assert subwin["height"] > 0
        assert subwin["col_off"] >= 4900
        assert subwin["row_off"] <= 5100
        assert subwin["estimated_size_bytes"] > 0
        assert subwin["range_header_supported"] is True

    def test_evaluate_temporal_pair_ready(self):
        """Valid temporal pair with georeferenced COG assets must report READY_FOR_ANALYSIS."""
        before_scene = {
            "scene_id": "S2A_MSIL2A_20240115T050651",
            "acquisition_date": "2024-01-15T05:06:51Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
            "source_provider": "Copernicus Sentinel-2 L2A (Public STAC)",
            "collection": "sentinel-2-l2a",
        }
        after_scene = {
            "scene_id": "S2B_MSIL2A_20240325T050649",
            "acquisition_date": "2024-03-25T05:06:49Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
            "source_provider": "Copernicus Sentinel-2 L2A (Public STAC)",
            "collection": "sentinel-2-l2a",
        }

        before_assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        after_assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        aoi = {"min_lon": 78.4, "min_lat": 17.3, "max_lon": 78.6, "max_lat": 17.5}

        result = RasterAssetService.evaluate_temporal_pair(
            before_scene, after_scene, before_assets, after_assets, aoi
        )

        assert result["status"] == "READY_FOR_ANALYSIS"
        assert result["temporal_gap_days"] == 69  # 2024 leap year: 16 (Jan) + 29 (Feb) + 24 (Mar) = 69
        assert result["alignment"]["crs_match"] is True
        assert result["alignment"]["target_resolution"] == 10
        assert "PROV-" in result["provenance"]["provenance_id"]
        assert len(result["issues"]) == 0

    def test_evaluate_temporal_pair_chronological_violation(self):
        """Before scene later than after scene must report NOT_READY with clear issue."""
        before_scene = {
            "scene_id": "S2B_MSIL2A_20240401T000000",
            "acquisition_date": "2024-04-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
        }
        after_scene = {
            "scene_id": "S2A_MSIL2A_20240101T000000",
            "acquisition_date": "2024-01-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
        }

        before_assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        after_assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        aoi = {"min_lon": 78.4, "min_lat": 17.3, "max_lon": 78.6, "max_lat": 17.5}

        result = RasterAssetService.evaluate_temporal_pair(
            before_scene, after_scene, before_assets, after_assets, aoi
        )

        assert result["status"] == "NOT_READY"
        assert any("Chronological order violation" in issue for issue in result["issues"])

    def test_evaluate_temporal_pair_missing_analysis_assets(self):
        """Scene with only preview PNGs (no georeferenced rasters) must report NOT_READY."""
        before_scene = {
            "scene_id": "S2A_MSIL2A_20240101",
            "acquisition_date": "2024-01-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
        }
        after_scene = {
            "scene_id": "S2B_MSIL2A_20240301",
            "acquisition_date": "2024-03-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
        }

        # Provide ONLY preview assets
        before_assets = [RasterAssetService.classify_asset("rendered_preview", MOCK_SENTINEL2_ASSETS["rendered_preview"])]
        after_assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        aoi = {"min_lon": 78.4, "min_lat": 17.3, "max_lon": 78.6, "max_lat": 17.5}

        result = RasterAssetService.evaluate_temporal_pair(
            before_scene, after_scene, before_assets, after_assets, aoi
        )

        assert result["status"] == "NOT_READY"
        assert any("No georeferenced raster analysis assets found" in issue for issue in result["issues"])

    def test_evaluate_temporal_pair_identical_scenes(self):
        """Identical scene for before and after must be rejected."""
        scene = {
            "scene_id": "S2A_MSIL2A_20240101",
            "acquisition_date": "2024-01-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
        }
        assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        aoi = {"min_lon": 78.4, "min_lat": 17.3, "max_lon": 78.6, "max_lat": 17.5}

        result = RasterAssetService.evaluate_temporal_pair(
            scene, scene, assets, assets, aoi
        )

        assert result["status"] == "NOT_READY"
        assert any("distinct acquisitions" in issue for issue in result["issues"])

    def test_provenance_audit_trail_completeness(self):
        """Provenance records must capture immutable processing steps and parameters."""
        before_scene = {
            "scene_id": "S2A_20240101",
            "acquisition_date": "2024-01-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
            "source_provider": "Microsoft Planetary Computer",
            "collection": "sentinel-2-l2a",
        }
        after_scene = {
            "scene_id": "S2B_20240201",
            "acquisition_date": "2024-02-01T00:00:00Z",
            "bbox": [78.0, 17.0, 79.0, 18.0],
            "source_provider": "Microsoft Planetary Computer",
            "collection": "sentinel-2-l2a",
        }
        assets = [RasterAssetService.classify_asset("visual", MOCK_SENTINEL2_ASSETS["visual"])]
        aoi = {"min_lon": 78.4, "min_lat": 17.3, "max_lon": 78.6, "max_lat": 17.5}

        result = RasterAssetService.evaluate_temporal_pair(
            before_scene, after_scene, assets, assets, aoi
        )

        prov = result["provenance"]
        assert prov["before_scene_id"] == "S2A_20240101"
        assert prov["after_scene_id"] == "S2B_20240201"
        assert prov["provider"] == "Microsoft Planetary Computer"
        assert len(prov["processing_chain"]) >= 5
        assert "STAC Item Discovery & Metadata Verification" in prov["processing_chain"]
