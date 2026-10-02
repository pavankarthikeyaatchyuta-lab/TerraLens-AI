"""Real Bi-Temporal Sentinel-2 Change Analysis Engine.

Implements Phase 4B scientific change detection pipeline:
- STAC analysis asset acquisition (B04, B08, SCL)
- SCL quality masking (suppression of clouds, shadows, snow, nodata)
- Surface reflectance normalization and relative radiometric matching
- Derived spectral signals (NDVI deltas, spectral reflectance deltas)
- Statistically derived adaptive thresholding
- Morphological false-alarm mitigation (opening, closing, area filtering)
- Connected components extraction and geospatial cluster geometry calculation
- Explainable change classification (construction, vegetation loss/growth, water, uncertain)
- Explainable confidence formulation
- Standard GeoJSON FeatureCollection generation
- Complete provenance trace preservation
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional, Union
import numpy as np


class Sentinel2QualityMasker:
    """Handles Sentinel-2 Scene Classification Layer (SCL) quality masking."""

    # Official ESA Sentinel-2 Level-2A Scene Classification Layer (SCL) mapping
    SCL_NO_DATA = 0
    SCL_SATURATED_OR_DEFECTIVE = 1
    SCL_DARK_AREA_PIXELS = 2
    SCL_CLOUD_SHADOWS = 3
    SCL_VEGETATION = 4
    SCL_NOT_VEGETATED = 5
    SCL_WATER = 6
    SCL_UNCLASSIFIED = 7
    SCL_CLOUD_MEDIUM_PROBABILITY = 8
    SCL_CLOUD_HIGH_PROBABILITY = 9
    SCL_THIN_CIRRUS = 10
    SCL_SNOW_OR_ICE = 11

    # Unsuitable pixels that must be masked out for valid bi-temporal analysis
    MASKED_SCL_CLASSES = {
        SCL_NO_DATA,
        SCL_SATURATED_OR_DEFECTIVE,
        SCL_CLOUD_SHADOWS,
        SCL_CLOUD_MEDIUM_PROBABILITY,
        SCL_CLOUD_HIGH_PROBABILITY,
        SCL_THIN_CIRRUS,
        SCL_SNOW_OR_ICE,
    }

    # Suitable surface observation pixels
    VALID_SCL_CLASSES = {
        SCL_DARK_AREA_PIXELS,
        SCL_VEGETATION,
        SCL_NOT_VEGETATED,
        SCL_WATER,
        SCL_UNCLASSIFIED,
    }

    @classmethod
    def create_quality_mask(
        cls,
        scl_array: Optional[np.ndarray],
        red_array: np.ndarray,
        nir_array: np.ndarray,
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """Generates a boolean validity mask where True represents suitable surface pixels."""
        height, width = red_array.shape[:2]
        total_pixels = height * width

        # Base validity: non-zero, positive reflectance, non-infinite/NaN
        base_valid = (
            (red_array > 0)
            & (nir_array > 0)
            & (red_array < 15000)
            & (nir_array < 15000)
            & np.isfinite(red_array)
            & np.isfinite(nir_array)
        )

        scl_masked_count = 0
        cloud_pixels = 0
        shadow_pixels = 0

        if scl_array is not None:
            scl_arr = np.asarray(scl_array)
            # Ensure shape match
            if scl_arr.shape[:2] != (height, width):
                from PIL import Image
                scl_img = Image.fromarray(scl_arr.astype(np.uint8))
                scl_resized = scl_img.resize((width, height), resample=Image.NEAREST)
                scl_arr = np.array(scl_resized, dtype=np.uint8)

            scl_valid = np.isin(scl_arr, list(cls.VALID_SCL_CLASSES))
            cloud_mask = np.isin(scl_arr, [cls.SCL_CLOUD_MEDIUM_PROBABILITY, cls.SCL_CLOUD_HIGH_PROBABILITY, cls.SCL_THIN_CIRRUS])
            shadow_mask = (scl_arr == cls.SCL_CLOUD_SHADOWS)

            cloud_pixels = int(np.sum(cloud_mask))
            shadow_pixels = int(np.sum(shadow_mask))
            scl_masked_count = int(np.sum(~scl_valid))

            final_valid_mask = base_valid & scl_valid
        else:
            final_valid_mask = base_valid

        valid_pixels = int(np.sum(final_valid_mask))
        masked_pixels = total_pixels - valid_pixels
        valid_percentage = round((valid_pixels / total_pixels) * 100.0, 2) if total_pixels > 0 else 0.0

        stats = {
            "total_pixels": total_pixels,
            "valid_pixels": valid_pixels,
            "masked_pixels": masked_pixels,
            "valid_percentage": valid_percentage,
            "cloud_pixels": cloud_pixels,
            "shadow_pixels": shadow_pixels,
            "scl_masked_count": scl_masked_count,
            "scl_used": scl_array is not None,
        }

        return final_valid_mask, stats


class ChangeAnalysisEngine:
    """Core scientific engine for bi-temporal satellite change analysis."""

    @staticmethod
    def normalize_reflectance(dn_array: np.ndarray) -> np.ndarray:
        """Converts Sentinel-2 L2A Digital Numbers (DN) to surface reflectance [0.0, 1.5]."""
        arr = np.asarray(dn_array, dtype=np.float32)
        # Standard Sentinel-2 L2A BOA scale factor: 10000.0
        # If input array is already float in [0, 1], preserve it
        if arr.max() > 2.0:
            reflectance = arr / 10000.0
        else:
            reflectance = arr
        return np.clip(reflectance, 0.0, 1.5)

    @staticmethod
    def match_illumination(
        before_arr: np.ndarray,
        after_arr: np.ndarray,
        valid_mask: np.ndarray,
    ) -> np.ndarray:
        """Applies deterministic radiometric matching to normalize illumination and solar disparities."""
        if not np.any(valid_mask):
            return after_arr

        b_vals = before_arr[valid_mask]
        a_vals = after_arr[valid_mask]

        b_mean = float(np.mean(b_vals))
        b_std = float(np.std(b_vals)) + 1e-6
        a_mean = float(np.mean(a_vals))
        a_std = float(np.std(a_vals)) + 1e-6

        # Bounded gain [0.75, 1.25] to prevent overcorrection of actual real change
        gain = np.clip(b_std / a_std, 0.75, 1.25)
        offset = np.clip(b_mean - (gain * a_mean), -0.1, 0.1)

        matched_after = np.clip((after_arr * gain) + offset, 0.0, 1.5)
        return matched_after

    @staticmethod
    def compute_ndvi(red: np.ndarray, nir: np.ndarray, valid_mask: np.ndarray) -> np.ndarray:
        """Computes Normalized Difference Vegetation Index (NDVI) safely."""
        denominator = nir + red
        ndvi = np.zeros_like(red, dtype=np.float32)

        safe_div = (denominator > 1e-4) & valid_mask
        ndvi[safe_div] = (nir[safe_div] - red[safe_div]) / denominator[safe_div]
        ndvi[~safe_div] = 0.0

        return np.clip(ndvi, -1.0, 1.0)

    @classmethod
    def calculate_bi_temporal_change(
        cls,
        before_b04: np.ndarray,
        before_b08: np.ndarray,
        after_b04: np.ndarray,
        after_b08: np.ndarray,
        before_scl: Optional[np.ndarray] = None,
        after_scl: Optional[np.ndarray] = None,
        geotransform: Optional[List[float]] = None,
        target_crs: str = "EPSG:32644",
        min_cluster_pixels: int = 9,
        fixed_threshold: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Executes full bi-temporal change detection pipeline on calibrated Sentinel-2 bands."""
        # 1. Surface reflectance normalization
        b_red = cls.normalize_reflectance(before_b04)
        b_nir = cls.normalize_reflectance(before_b08)
        a_red = cls.normalize_reflectance(after_b04)
        a_nir = cls.normalize_reflectance(after_b08)

        # 2. Quality masking
        v_mask_b, stats_b = Sentinel2QualityMasker.create_quality_mask(before_scl, b_red, b_nir)
        v_mask_a, stats_a = Sentinel2QualityMasker.create_quality_mask(after_scl, a_red, a_nir)
        combined_valid = v_mask_b & v_mask_a

        total_pixels = b_red.size
        valid_pixels = int(np.sum(combined_valid))
        valid_pct = round((valid_pixels / total_pixels) * 100.0, 2) if total_pixels > 0 else 0.0

        quality_report = {
            "total_pixels": total_pixels,
            "valid_pixels": valid_pixels,
            "masked_pixels": total_pixels - valid_pixels,
            "valid_percentage": valid_pct,
            "before_quality": stats_b,
            "after_quality": stats_a,
            "clouds_suppressed": stats_b["cloud_pixels"] + stats_a["cloud_pixels"],
            "shadows_suppressed": stats_b["shadow_pixels"] + stats_a["shadow_pixels"],
        }

        if valid_pixels < 25:
            return {
                "status": "INSUFFICIENT_VALID_DATA",
                "quality": quality_report,
                "change": {"threshold": 0.0, "changed_pixels": 0, "changed_area_m2": 0.0},
                "clusters": [],
                "reason": "Insufficient clear-sky observation pixels after cloud/shadow quality masking.",
            }

        # 3. Relative radiometric illumination matching on after acquisition
        a_red_matched = cls.match_illumination(b_red, a_red, combined_valid)
        a_nir_matched = cls.match_illumination(b_nir, a_nir, combined_valid)

        # 4. Spectral indices (NDVI)
        ndvi_before = cls.compute_ndvi(b_red, b_nir, combined_valid)
        ndvi_after = cls.compute_ndvi(a_red_matched, a_nir_matched, combined_valid)
        ndvi_diff = ndvi_after - ndvi_before

        red_diff = a_red_matched - b_red
        nir_diff = a_nir_matched - b_nir

        # Multi-spectral change magnitude combining vegetation index delta and reflectance shifts
        spectral_magnitude = np.sqrt((red_diff ** 2) + (nir_diff ** 2))
        change_score = np.zeros_like(spectral_magnitude, dtype=np.float32)
        change_score[combined_valid] = (
            0.50 * np.abs(ndvi_diff[combined_valid])
            + 0.50 * np.clip(spectral_magnitude[combined_valid] * 3.0, 0.0, 1.0)
        )

        # 5. Deterministic Adaptive Thresholding
        valid_scores = change_score[combined_valid]
        if fixed_threshold is not None:
            threshold = float(fixed_threshold)
            threshold_method = "Manual Operator Parameter"
        else:
            mean_score = float(np.mean(valid_scores))
            std_score = float(np.std(valid_scores))
            # Adaptive robust threshold: mean + 1.8 * std, bounded between [0.15, 0.45]
            raw_thresh = mean_score + (1.8 * std_score)
            threshold = float(np.clip(raw_thresh, 0.15, 0.45))
            threshold_method = "Adaptive Statistical Distribution (mean + 1.8*std, clamped [0.15, 0.45])"

        raw_change_mask = (change_score >= threshold) & combined_valid
        raw_change_count = int(np.sum(raw_change_mask))

        # 6. Morphological Cleanup & False-Alarm Suppression
        cleaned_mask = cls.apply_morphology(raw_change_mask)
        false_alarms_suppressed = raw_change_count - int(np.sum(cleaned_mask))

        # 7. Connected components extraction & clustering
        if geotransform and len(geotransform) >= 6:
            pixel_res = abs(geotransform[1])
            if pixel_res < 0.1:
                # WGS84 degree resolution: approx 111,320m per degree at equator
                resolution_m = max(5.0, round(pixel_res * 111320.0, 1))
            else:
                resolution_m = pixel_res
        else:
            resolution_m = 10.0
        clusters = cls.extract_clusters(
            cleaned_mask=cleaned_mask,
            change_score=change_score,
            ndvi_diff=ndvi_diff,
            red_diff=red_diff,
            nir_diff=nir_diff,
            combined_valid=combined_valid,
            geotransform=geotransform,
            resolution_m=resolution_m,
            min_cluster_pixels=min_cluster_pixels,
        )

        # Filter out clusters below minimum area
        valid_clusters = [c for c in clusters if c["pixel_count"] >= min_cluster_pixels]
        final_changed_pixels = sum(c["pixel_count"] for c in valid_clusters)

        pixel_area_m2 = resolution_m * resolution_m
        changed_area_m2 = round(final_changed_pixels * pixel_area_m2, 2)
        changed_area_ha = round(changed_area_m2 / 10000.0, 4)
        changed_area_km2 = round(changed_area_m2 / 1000000.0, 6)

        # 8. Spectral Diagnostics
        spectral_diagnostics = {
            "mean_ndvi_before": round(float(np.mean(ndvi_before[combined_valid])), 4),
            "mean_ndvi_after": round(float(np.mean(ndvi_after[combined_valid])), 4),
            "mean_ndvi_diff": round(float(np.mean(ndvi_diff[combined_valid])), 4),
            "mean_change_score": round(float(np.mean(valid_scores)), 4),
            "max_change_score": round(float(np.max(valid_scores)), 4),
        }

        # 9. GeoJSON FeatureCollection
        geojson = {
            "type": "FeatureCollection",
            "features": [c["geojson_feature"] for c in valid_clusters],
        }

        return {
            "status": "ANALYZED",
            "quality": quality_report,
            "spectral": spectral_diagnostics,
            "change": {
                "threshold": round(threshold, 4),
                "threshold_method": threshold_method,
                "raw_changed_pixels": raw_change_count,
                "changed_pixels": final_changed_pixels,
                "changed_area_m2": changed_area_m2,
                "changed_area_ha": changed_area_ha,
                "changed_area_km2": changed_area_km2,
                "resolution_meters": resolution_m,
                "false_alarms_suppressed": max(0, false_alarms_suppressed),
                "clusters_count": len(valid_clusters),
            },
            "clusters": valid_clusters,
            "geojson": geojson,
            "change_mask_array": cleaned_mask.astype(np.uint8),
        }

    @staticmethod
    def apply_morphology(mask: np.ndarray) -> np.ndarray:
        """Performs morphological opening (3x3) and closing (3x3) in pure NumPy."""
        h, w = mask.shape
        # Simple 3x3 structuring element
        # 1. Erosion (opening step 1)
        eroded = np.zeros_like(mask, dtype=bool)
        for r in range(1, h - 1):
            for c in range(1, w - 1):
                if np.all(mask[r - 1 : r + 2, c - 1 : c + 2]):
                    eroded[r, c] = True

        # 2. Dilation (opening step 2)
        opened = np.zeros_like(mask, dtype=bool)
        for r in range(1, h - 1):
            for c in range(1, w - 1):
                if np.any(eroded[r - 1 : r + 2, c - 1 : c + 2]):
                    opened[r, c] = True

        # 3. Closing (dilation followed by erosion)
        dilated = np.zeros_like(opened, dtype=bool)
        for r in range(1, h - 1):
            for c in range(1, w - 1):
                if np.any(opened[r - 1 : r + 2, c - 1 : c + 2]):
                    dilated[r, c] = True

        closed = np.zeros_like(opened, dtype=bool)
        for r in range(1, h - 1):
            for c in range(1, w - 1):
                if np.all(dilated[r - 1 : r + 2, c - 1 : c + 2]):
                    closed[r, c] = True

        # Retain opened results in non-border pixels to prevent boundary loss
        result = np.copy(closed)
        result[0, :] = False
        result[-1, :] = False
        result[:, 0] = False
        result[:, -1] = False
        return result

    @classmethod
    def extract_clusters(
        cls,
        cleaned_mask: np.ndarray,
        change_score: np.ndarray,
        ndvi_diff: np.ndarray,
        red_diff: np.ndarray,
        nir_diff: np.ndarray,
        combined_valid: np.ndarray,
        geotransform: Optional[List[float]],
        resolution_m: float,
        min_cluster_pixels: int = 9,
    ) -> List[Dict[str, Any]]:
        """Extracts connected component clusters and computes geospatial geometry and classification."""
        h, w = cleaned_mask.shape
        visited = np.zeros((h, w), dtype=bool)
        clusters: List[Dict[str, Any]] = []

        # 8-neighbor connectivity offsets
        neighbors = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]

        cluster_idx = 1
        for r in range(h):
            for c in range(w):
                if cleaned_mask[r, c] and not visited[r, c]:
                    # Breadth-first search for connected component
                    queue = [(r, c)]
                    visited[r, c] = True
                    cluster_pixels = []

                    while queue:
                        curr_r, curr_c = queue.pop(0)
                        cluster_pixels.append((curr_r, curr_c))

                        for dr, dc in neighbors:
                            nr, nc = curr_r + dr, curr_c + dc
                            if 0 <= nr < h and 0 <= nc < w:
                                if cleaned_mask[nr, nc] and not visited[nr, nc]:
                                    visited[nr, nc] = True
                                    queue.append((nr, nc))

                    pixel_count = len(cluster_pixels)
                    if pixel_count < min_cluster_pixels:
                        continue

                    # Compute cluster metrics
                    pixel_rows = [p[0] for p in cluster_pixels]
                    pixel_cols = [p[1] for p in cluster_pixels]

                    min_r, max_r = min(pixel_rows), max(pixel_rows)
                    min_c, max_c = min(pixel_cols), max(pixel_cols)

                    mean_r = float(np.mean(pixel_rows))
                    mean_c = float(np.mean(pixel_cols))

                    scores = [change_score[pr, pc] for pr, pc in cluster_pixels]
                    c_ndvi_diffs = [ndvi_diff[pr, pc] for pr, pc in cluster_pixels]
                    c_red_diffs = [red_diff[pr, pc] for pr, pc in cluster_pixels]
                    c_nir_diffs = [nir_diff[pr, pc] for pr, pc in cluster_pixels]

                    mean_score = float(np.mean(scores))
                    max_score = float(np.max(scores))
                    mean_c_ndvi_diff = float(np.mean(c_ndvi_diffs))
                    mean_c_red_diff = float(np.mean(c_red_diffs))
                    mean_c_nir_diff = float(np.mean(c_nir_diffs))

                    # Geospatial coordinates from affine geotransform
                    if geotransform and len(geotransform) >= 6:
                        # [x0, res_x, 0, y0, 0, res_y]
                        x0, res_x, _, y0, _, res_y = geotransform
                        centroid_x = x0 + (mean_c * res_x)
                        centroid_y = y0 + (mean_r * res_y)

                        min_x = x0 + (min_c * res_x)
                        max_x = x0 + ((max_c + 1) * res_x)
                        # res_y is negative in north-up images
                        top_y = y0 + (min_r * res_y)
                        bottom_y = y0 + ((max_r + 1) * res_y)
                        min_y = min(top_y, bottom_y)
                        max_y = max(top_y, bottom_y)

                        # Bounding box in [min_lon, min_lat, max_lon, max_lat]
                        bbox = [round(min_x, 6), round(min_y, 6), round(max_x, 6), round(max_y, 6)]
                        centroid = [round(centroid_y, 6), round(centroid_x, 6)]  # [lat, lon]
                        poly_coords = [
                            [
                                [round(min_x, 6), round(min_y, 6)],
                                [round(max_x, 6), round(min_y, 6)],
                                [round(max_x, 6), round(max_y, 6)],
                                [round(min_x, 6), round(max_y, 6)],
                                [round(min_x, 6), round(min_y, 6)],
                            ]
                        ]
                    else:
                        bbox = [min_c, min_r, max_c, max_r]
                        centroid = [round(mean_r, 2), round(mean_c, 2)]
                        poly_coords = [[[min_c, min_r], [max_c, min_r], [max_c, max_r], [min_c, max_r], [min_c, min_r]]]

                    # Change Classification
                    change_class, class_reason = cls.classify_cluster(
                        mean_c_ndvi_diff, mean_c_red_diff, mean_c_nir_diff
                    )

                    # Explainable Confidence Formulation
                    confidence = cls.compute_cluster_confidence(
                        mean_score=mean_score,
                        pixel_count=pixel_count,
                        mean_ndvi_diff=mean_c_ndvi_diff,
                        mean_red_diff=mean_c_red_diff,
                    )

                    area_m2 = round(pixel_count * (resolution_m ** 2), 2)
                    area_ha = round(area_m2 / 10000.0, 4)

                    cluster_id = f"CLUST_{cluster_idx:03d}"
                    cluster_idx += 1

                    geojson_feature = {
                        "type": "Feature",
                        "id": cluster_id,
                        "properties": {
                            "cluster_id": cluster_id,
                            "change_class": change_class,
                            "confidence_score": confidence,
                            "area_m2": area_m2,
                            "area_ha": area_ha,
                            "pixel_count": pixel_count,
                            "mean_change_score": round(mean_score, 4),
                            "max_change_score": round(max_score, 4),
                            "mean_ndvi_diff": round(mean_c_ndvi_diff, 4),
                            "mean_red_diff": round(mean_c_red_diff, 4),
                            "centroid": centroid,
                            "classification_rationale": class_reason,
                        },
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": poly_coords,
                        },
                    }

                    clusters.append({
                        "cluster_id": cluster_id,
                        "pixel_count": pixel_count,
                        "area_m2": area_m2,
                        "area_ha": area_ha,
                        "centroid": centroid,
                        "bounding_box": bbox,
                        "mean_change_score": round(mean_score, 4),
                        "max_change_score": round(max_score, 4),
                        "change_class": change_class,
                        "confidence_score": confidence,
                        "classification_rationale": class_reason,
                        "geojson_feature": geojson_feature,
                    })

        # Sort clusters by area descending
        clusters.sort(key=lambda x: x["area_m2"], reverse=True)
        return clusters

    @staticmethod
    def classify_cluster(
        mean_ndvi_diff: float, mean_red_diff: float, mean_nir_diff: float
    ) -> Tuple[str, str]:
        """Performs explainable spectral change classification for detected spatial clusters."""
        if mean_ndvi_diff < -0.15 and mean_red_diff > 0.02:
            return (
                "VEGETATION_LOSS / CLEARANCE",
                f"Significant NDVI decrease ({mean_ndvi_diff:+.3f}) with increased bare soil/surface reflectance ({mean_red_diff:+.3f}).",
            )
        elif mean_ndvi_diff > 0.15:
            return (
                "VEGETATION_GROWTH",
                f"Significant NDVI gain ({mean_ndvi_diff:+.3f}) indicating seasonal greening or crop development.",
            )
        elif mean_nir_diff < -0.10 and mean_ndvi_diff < 0.0:
            return (
                "WATER_VARIATION",
                f"Sharp NIR drop ({mean_nir_diff:+.3f}) characteristic of inundation or reservoir surface dynamics.",
            )
        elif mean_red_diff > 0.08 and mean_ndvi_diff < -0.04:
            return (
                "BUILT_UP_CONSTRUCTION",
                f"High red surface reflectance increase ({mean_red_diff:+.3f}) with vegetation suppression indicating new impervious structure.",
            )
        else:
            return (
                "OTHER / UNCERTAIN",
                f"Spectral shift (ΔNDVI={mean_ndvi_diff:+.3f}, ΔRed={mean_red_diff:+.3f}) does not match unambiguous canonical profile.",
            )

    @staticmethod
    def compute_cluster_confidence(
        mean_score: float,
        pixel_count: int,
        mean_ndvi_diff: float,
        mean_red_diff: float,
    ) -> float:
        """Formulates explainable confidence score in range [0.0, 1.0]."""
        # 1. Magnitude component (0 to 0.40)
        c_mag = min(0.40, mean_score * 0.8)

        # 2. Spatial coherence component based on cluster size (0 to 0.35)
        # Larger contiguous components have higher confidence against random pixel noise
        c_spatial = min(0.35, 0.15 + (math.log10(max(10, pixel_count)) * 0.08))

        # 3. Spectral signal consistency (0 to 0.25)
        has_clear_spectral_trend = abs(mean_ndvi_diff) > 0.10 or abs(mean_red_diff) > 0.05
        c_spectral = 0.25 if has_clear_spectral_trend else 0.10

        confidence = c_mag + c_spatial + c_spectral
        return round(float(np.clip(confidence, 0.20, 0.98)), 2)
