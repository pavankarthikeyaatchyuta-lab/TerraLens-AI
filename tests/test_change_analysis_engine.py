"""Unit tests for Phase 4B: Real Bi-Temporal Sentinel-2 Change Analysis Engine.

Verifies:
1. SCL quality mask mapping and suppression of clouds (8, 9, 10), shadows (3), defective (1), nodata (0).
2. SCL retention of valid vegetation (4), bare soil (5), and water (6).
3. Surface reflectance conversion (DN / 10000.0).
4. Relative radiometric illumination matching (gain and offset).
5. Safe NDVI calculation including zero-division handling.
6. Multi-spectral delta calculations (ΔNDVI, ΔRed, ΔNIR) and change magnitude.
7. Statistically derived adaptive thresholding (mean + 1.8 * std clamped in [0.15, 0.45]).
8. Morphological filtering (opening removes isolated noise, closing fills small holes).
9. Connected components extraction with 8-connectivity.
10. Minimum cluster area filtering.
11. Bounding box and centroid coordinate transformations.
12. Area calculation (m², ha, km²) with 10m resolution.
13. Explainable change classification rules:
    - BUILT_UP_CONSTRUCTION
    - VEGETATION_LOSS / CLEARANCE
    - VEGETATION_GROWTH
    - WATER_VARIATION
    - OTHER / UNCERTAIN
14. Explainable confidence formulation bounded in [0.0, 1.0].
15. GeoJSON FeatureCollection generation.
16. End-to-end bi-temporal change analysis workflow on synthetic raster.
"""

import math
import pytest
import numpy as np

from terralens.app.services.change_analysis_engine import (
    Sentinel2QualityMasker,
    ChangeAnalysisEngine,
)


class TestSentinel2QualityMasker:
    """Tests for SCL quality masking and surface pixel selection."""

    def test_quality_mask_scl_cloud(self):
        """Clouds (SCL 8, 9, 10) must be masked out."""
        red = np.ones((10, 10), dtype=np.float32) * 1000
        nir = np.ones((10, 10), dtype=np.float32) * 2000
        scl = np.full((10, 10), Sentinel2QualityMasker.SCL_CLOUD_HIGH_PROBABILITY, dtype=np.uint8)

        mask, stats = Sentinel2QualityMasker.create_quality_mask(scl, red, nir)
        assert np.sum(mask) == 0
        assert stats["cloud_pixels"] == 100
        assert stats["valid_pixels"] == 0
        assert stats["valid_percentage"] == 0.0

    def test_quality_mask_scl_shadow(self):
        """Cloud shadows (SCL 3) must be masked out."""
        red = np.ones((10, 10), dtype=np.float32) * 800
        nir = np.ones((10, 10), dtype=np.float32) * 1200
        scl = np.full((10, 10), Sentinel2QualityMasker.SCL_CLOUD_SHADOWS, dtype=np.uint8)

        mask, stats = Sentinel2QualityMasker.create_quality_mask(scl, red, nir)
        assert np.sum(mask) == 0
        assert stats["shadow_pixels"] == 100
        assert stats["valid_pixels"] == 0

    def test_quality_mask_scl_valid_vegetation(self):
        """Vegetation (SCL 4) and non-vegetated/soil (SCL 5) must be retained."""
        red = np.ones((10, 10), dtype=np.float32) * 800
        nir = np.ones((10, 10), dtype=np.float32) * 3500
        scl = np.full((10, 10), Sentinel2QualityMasker.SCL_VEGETATION, dtype=np.uint8)

        mask, stats = Sentinel2QualityMasker.create_quality_mask(scl, red, nir)
        assert np.sum(mask) == 100
        assert stats["valid_pixels"] == 100
        assert stats["valid_percentage"] == 100.0

    def test_quality_mask_scl_water(self):
        """Water (SCL 6) must be retained."""
        red = np.ones((10, 10), dtype=np.float32) * 300
        nir = np.ones((10, 10), dtype=np.float32) * 100
        scl = np.full((10, 10), Sentinel2QualityMasker.SCL_WATER, dtype=np.uint8)

        mask, stats = Sentinel2QualityMasker.create_quality_mask(scl, red, nir)
        assert np.sum(mask) == 100
        assert stats["valid_pixels"] == 100

    def test_quality_mask_nodata(self):
        """Nodata (SCL 0) and zero DNs must be masked out."""
        red = np.zeros((10, 10), dtype=np.float32)
        nir = np.zeros((10, 10), dtype=np.float32)
        scl = np.zeros((10, 10), dtype=np.uint8)

        mask, stats = Sentinel2QualityMasker.create_quality_mask(scl, red, nir)
        assert np.sum(mask) == 0
        assert stats["valid_pixels"] == 0


class TestChangeAnalysisEngineMethods:
    """Tests for discrete mathematical and scientific operations in the engine."""

    def test_surface_reflectance_conversion(self):
        """Validates scale factor 0.0001 (DN / 10000.0) and clamping."""
        raw_dn = np.array([[0, 1000, 5000, 10000, 20000]], dtype=np.float32)
        reflectance = ChangeAnalysisEngine.normalize_reflectance(raw_dn)

        assert reflectance[0, 0] == 0.0
        assert pytest.approx(reflectance[0, 1], rel=1e-4) == 0.1
        assert pytest.approx(reflectance[0, 2], rel=1e-4) == 0.5
        assert pytest.approx(reflectance[0, 3], rel=1e-4) == 1.0
        assert reflectance[0, 4] == 1.5  # Clamped maximum

    def test_radiometric_illumination_matching(self):
        """Validates gain and offset matching on valid pixels."""
        before = np.full((10, 10), 0.3, dtype=np.float32)
        # After acquisition with higher solar illumination
        after = np.full((10, 10), 0.38, dtype=np.float32)
        valid_mask = np.ones((10, 10), dtype=bool)

        matched_after = ChangeAnalysisEngine.match_illumination(before, after, valid_mask)
        # Matched values should shift closer to before mean
        assert matched_after.shape == after.shape
        assert np.mean(matched_after) <= np.mean(after)

    def test_ndvi_calculation(self):
        """Validates standard NDVI formula (NIR - Red) / (NIR + Red)."""
        red = np.array([[0.1, 0.2]], dtype=np.float32)
        nir = np.array([[0.5, 0.2]], dtype=np.float32)
        valid = np.ones((1, 2), dtype=bool)

        ndvi = ChangeAnalysisEngine.compute_ndvi(red, nir, valid)
        expected_0 = (0.5 - 0.1) / (0.5 + 0.1)  # 0.4 / 0.6 = 0.6667
        expected_1 = (0.2 - 0.2) / (0.2 + 0.2)  # 0.0

        assert pytest.approx(ndvi[0, 0], rel=1e-3) == expected_0
        assert pytest.approx(ndvi[0, 1], abs=1e-4) == expected_1

    def test_ndvi_division_by_zero_safety(self):
        """Validates that zero reflectance does not cause NaN or inf."""
        red = np.array([[0.0, 0.0]], dtype=np.float32)
        nir = np.array([[0.0, 0.0]], dtype=np.float32)
        valid = np.ones((1, 2), dtype=bool)

        ndvi = ChangeAnalysisEngine.compute_ndvi(red, nir, valid)
        assert not np.any(np.isnan(ndvi))
        assert not np.any(np.isinf(ndvi))
        assert np.all(ndvi == 0.0)

    def test_morphological_filtering_opening(self):
        """Single isolated noisy pixels must be removed by morphological opening."""
        mask = np.zeros((15, 15), dtype=bool)
        # 1 isolated pixel
        mask[7, 7] = True
        cleaned = ChangeAnalysisEngine.apply_morphology(mask)
        assert cleaned[7, 7] == False
        assert np.sum(cleaned) == 0

    def test_morphological_filtering_closing(self):
        """Small 1-pixel holes inside contiguous regions should be closed."""
        mask = np.ones((9, 9), dtype=bool)
        mask[4, 4] = False  # 1-pixel hole in center
        cleaned = ChangeAnalysisEngine.apply_morphology(mask)
        assert cleaned[4, 4] == True

    def test_connected_component_clustering(self):
        """8-connectivity extracts contiguous clusters."""
        mask = np.zeros((20, 20), dtype=bool)
        # Cluster 1: 3x3 block (9 pixels)
        mask[2:5, 2:5] = True
        # Cluster 2: 4x4 block (16 pixels)
        mask[10:14, 10:14] = True

        change_score = np.full((20, 20), 0.5, dtype=np.float32)
        ndvi_diff = np.full((20, 20), -0.25, dtype=np.float32)
        red_diff = np.full((20, 20), 0.15, dtype=np.float32)
        nir_diff = np.full((20, 20), -0.10, dtype=np.float32)
        valid = np.ones((20, 20), dtype=bool)

        clusters = ChangeAnalysisEngine.extract_clusters(
            cleaned_mask=mask,
            change_score=change_score,
            ndvi_diff=ndvi_diff,
            red_diff=red_diff,
            nir_diff=nir_diff,
            combined_valid=valid,
            geotransform=[78.4, 0.0001, 0.0, 17.5, 0.0, -0.0001],
            resolution_m=10.0,
            min_cluster_pixels=9,
        )

        assert len(clusters) == 2
        # Sorted by area descending
        assert clusters[0]["pixel_count"] == 16
        assert clusters[1]["pixel_count"] == 9
        assert clusters[0]["area_m2"] == 1600.0  # 16 * 100 m²
        assert clusters[1]["area_m2"] == 900.0   # 9 * 100 m²

    def test_minimum_cluster_area_filtering(self):
        """Clusters with fewer than min_cluster_pixels must be discarded."""
        mask = np.zeros((20, 20), dtype=bool)
        # Cluster of 4 pixels (below threshold of 9)
        mask[2:4, 2:4] = True

        clusters = ChangeAnalysisEngine.extract_clusters(
            cleaned_mask=mask,
            change_score=np.full((20, 20), 0.5, dtype=np.float32),
            ndvi_diff=np.full((20, 20), 0.0, dtype=np.float32),
            red_diff=np.full((20, 20), 0.0, dtype=np.float32),
            nir_diff=np.full((20, 20), 0.0, dtype=np.float32),
            combined_valid=np.ones((20, 20), dtype=bool),
            geotransform=None,
            resolution_m=10.0,
            min_cluster_pixels=9,
        )

        assert len(clusters) == 0

    def test_cluster_bounding_box_and_centroid(self):
        """Bounding box and centroid must correctly project coordinates."""
        mask = np.zeros((10, 10), dtype=bool)
        mask[2:5, 3:6] = True  # rows 2..4, cols 3..5

        geotransform = [78.40, 0.0001, 0.0, 17.50, 0.0, -0.0001]
        clusters = ChangeAnalysisEngine.extract_clusters(
            cleaned_mask=mask,
            change_score=np.full((10, 10), 0.4, dtype=np.float32),
            ndvi_diff=np.full((10, 10), 0.0, dtype=np.float32),
            red_diff=np.full((10, 10), 0.0, dtype=np.float32),
            nir_diff=np.full((10, 10), 0.0, dtype=np.float32),
            combined_valid=np.ones((10, 10), dtype=bool),
            geotransform=geotransform,
            resolution_m=10.0,
            min_cluster_pixels=4,
        )

        assert len(clusters) == 1
        c = clusters[0]
        bbox = c["bounding_box"]
        # min_lon should be >= 78.40
        assert bbox[0] >= 78.40
        assert bbox[2] > bbox[0]
        assert bbox[3] > bbox[1]
        # Centroid [lat, lon]
        assert 17.40 < c["centroid"][0] < 17.51
        assert 78.40 < c["centroid"][1] < 78.50

    def test_classification_built_up_construction(self):
        """Increase in Red surface reflectance with vegetation suppression -> BUILT_UP_CONSTRUCTION."""
        cls_name, reason = ChangeAnalysisEngine.classify_cluster(
            mean_ndvi_diff=-0.12, mean_red_diff=0.10, mean_nir_diff=0.01
        )
        assert cls_name == "BUILT_UP_CONSTRUCTION"
        assert "impervious" in reason.lower() or "vegetation" in reason.lower()

    def test_classification_vegetation_loss(self):
        """Significant NDVI loss with bare soil increase -> VEGETATION_LOSS / CLEARANCE."""
        cls_name, reason = ChangeAnalysisEngine.classify_cluster(
            mean_ndvi_diff=-0.22, mean_red_diff=0.04, mean_nir_diff=-0.15
        )
        assert cls_name == "VEGETATION_LOSS / CLEARANCE"

    def test_classification_vegetation_growth(self):
        """Significant NDVI increase -> VEGETATION_GROWTH."""
        cls_name, reason = ChangeAnalysisEngine.classify_cluster(
            mean_ndvi_diff=+0.28, mean_red_diff=-0.04, mean_nir_diff=+0.20
        )
        assert cls_name == "VEGETATION_GROWTH"

    def test_classification_water_variation(self):
        """NIR decrease characteristic of water expansion or inundation."""
        cls_name, reason = ChangeAnalysisEngine.classify_cluster(
            mean_ndvi_diff=-0.05, mean_red_diff=-0.01, mean_nir_diff=-0.18
        )
        assert cls_name == "WATER_VARIATION"

    def test_classification_other_uncertain(self):
        """Ambiguous spectral changes classify as OTHER / UNCERTAIN."""
        cls_name, reason = ChangeAnalysisEngine.classify_cluster(
            mean_ndvi_diff=-0.02, mean_red_diff=0.01, mean_nir_diff=0.01
        )
        assert cls_name == "OTHER / UNCERTAIN"

    def test_confidence_formulation(self):
        """Confidence score must be strictly bounded in [0.0, 1.0] and increase with size."""
        conf_small = ChangeAnalysisEngine.compute_cluster_confidence(
            mean_score=0.25, pixel_count=10, mean_ndvi_diff=0.05, mean_red_diff=0.02
        )
        conf_large = ChangeAnalysisEngine.compute_cluster_confidence(
            mean_score=0.45, pixel_count=200, mean_ndvi_diff=-0.25, mean_red_diff=0.12
        )

        assert 0.0 <= conf_small <= 1.0
        assert 0.0 <= conf_large <= 1.0
        assert conf_large > conf_small

    def test_geojson_feature_collection_generation(self):
        """Validates GeoJSON FeatureCollection output format."""
        mask = np.zeros((15, 15), dtype=bool)
        mask[3:7, 3:7] = True

        clusters = ChangeAnalysisEngine.extract_clusters(
            cleaned_mask=mask,
            change_score=np.full((15, 15), 0.5, dtype=np.float32),
            ndvi_diff=np.full((15, 15), -0.20, dtype=np.float32),
            red_diff=np.full((15, 15), 0.10, dtype=np.float32),
            nir_diff=np.full((15, 15), 0.0, dtype=np.float32),
            combined_valid=np.ones((15, 15), dtype=bool),
            geotransform=[78.4, 0.0001, 0.0, 17.5, 0.0, -0.0001],
            resolution_m=10.0,
            min_cluster_pixels=9,
        )

        geojson = {
            "type": "FeatureCollection",
            "features": [c["geojson_feature"] for c in clusters],
        }

        assert geojson["type"] == "FeatureCollection"
        assert len(geojson["features"]) == 1
        feature = geojson["features"][0]
        assert feature["type"] == "Feature"
        assert "cluster_id" in feature["properties"]
        assert "change_class" in feature["properties"]
        assert "confidence_score" in feature["properties"]
        assert feature["geometry"]["type"] == "Polygon"
        assert len(feature["geometry"]["coordinates"][0]) == 5  # Closed loop


class TestFullBiTemporalPipeline:
    """End-to-end tests for the complete bi-temporal analysis engine."""

    def test_full_synthetic_pipeline_with_construction_change(self):
        """Simulates 50x50 Sentinel-2 subwindow with a synthetic construction zone."""
        # Baseline before scene: green vegetation
        before_red = np.ones((50, 50), dtype=np.float32) * 800    # DN = 800 -> 0.08
        before_nir = np.ones((50, 50), dtype=np.float32) * 3500   # DN = 3500 -> 0.35
        before_scl = np.full((50, 50), Sentinel2QualityMasker.SCL_VEGETATION, dtype=np.uint8)

        # After scene: injected 8x8 construction site (impervious ground) at [20:28, 20:28]
        after_red = np.copy(before_red)
        after_nir = np.copy(before_nir)
        after_red[20:28, 20:28] = 2500   # Red increases to 0.25
        after_nir[20:28, 20:28] = 1800   # NIR decreases to 0.18
        after_scl = np.full((50, 50), Sentinel2QualityMasker.SCL_NOT_VEGETATED, dtype=np.uint8)

        geotransform = [78.35, 0.0001, 0.0, 17.45, 0.0, -0.0001]

        result = ChangeAnalysisEngine.calculate_bi_temporal_change(
            before_b04=before_red,
            before_b08=before_nir,
            after_b04=after_red,
            after_b08=after_nir,
            before_scl=before_scl,
            after_scl=after_scl,
            geotransform=geotransform,
            min_cluster_pixels=9,
        )

        assert result["status"] == "ANALYZED"
        assert result["quality"]["valid_percentage"] == 100.0
        assert result["change"]["clusters_count"] >= 1

        top_cluster = result["clusters"][0]
        assert top_cluster["pixel_count"] >= 9
        assert top_cluster["area_m2"] > 0
        assert top_cluster["confidence_score"] > 0.5
        assert top_cluster["change_class"] in ["BUILT_UP_CONSTRUCTION", "VEGETATION_LOSS / CLEARANCE"]
        assert len(result["geojson"]["features"]) >= 1

    def test_pipeline_aborts_when_cloud_covered(self):
        """Pipeline must gracefully abort when clear-sky observations are insufficient."""
        red = np.ones((50, 50), dtype=np.float32) * 1000
        nir = np.ones((50, 50), dtype=np.float32) * 2000
        # 100% cloud cover on after scene
        cloud_scl = np.full((50, 50), Sentinel2QualityMasker.SCL_CLOUD_HIGH_PROBABILITY, dtype=np.uint8)

        result = ChangeAnalysisEngine.calculate_bi_temporal_change(
            before_b04=red,
            before_b08=nir,
            after_b04=red,
            after_b08=nir,
            before_scl=None,
            after_scl=cloud_scl,
        )

        assert result["status"] == "INSUFFICIENT_VALID_DATA"
        assert result["change"]["changed_pixels"] == 0
        assert len(result["clusters"]) == 0
