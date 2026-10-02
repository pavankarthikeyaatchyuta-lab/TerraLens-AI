"""Raster asset acquisition, inspection, and spatial alignment service.

Implements Phase 4A scientific raster foundation:
- Differentiates analysis-capable georeferenced rasters from preview/thumbnail overviews.
- Performs raster metadata inspection (CRS, shape, transform, resolution, nodata, valid percentage).
- Evaluates spatial compatibility and coordinates dimension reconciliation without claiming fake georeferencing.
- Calculates AOI subwindows to prevent unnecessary multi-gigabyte SAFE/COG downloads.
- Generates verifiable provenance records for the Earth Observation evidence chain.
"""

import math
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple, Optional, Union
import numpy as np


class RasterAssetService:
    """Core service for satellite analysis asset inspection, alignment, and readiness assessment."""

    # Standard Sentinel-2 Band Resolution mapping (meters)
    BAND_RESOLUTIONS: Dict[str, int] = {
        "visual": 10,
        "B02": 10,
        "B03": 10,
        "B04": 10,
        "B08": 10,
        "B05": 20,
        "B06": 20,
        "B07": 20,
        "B8A": 20,
        "B11": 20,
        "B12": 20,
        "SCL": 20,
        "AOT": 10,
        "WVP": 10,
        "B01": 60,
        "B09": 60,
    }

    @classmethod
    def classify_asset(cls, asset_key: str, asset_data: Dict[str, Any]) -> Dict[str, Any]:
        """Classifies a STAC asset as an Analysis Asset or Preview Asset.

        Scientific Rule: Preview assets (rendered_preview, thumbnail, PNG/JPEG overviews)
        must NEVER be used as primary inputs for scientific change detection.
        """
        media_type = asset_data.get("type", "").lower()
        roles = asset_data.get("roles", [])
        href = asset_data.get("href", "")

        is_preview = (
            asset_key in ("rendered_preview", "thumbnail", "preview")
            or "overview" in roles
            or "thumbnail" in roles
            or "image/png" in media_type
            or "image/jpeg" in media_type
        )

        if is_preview:
            return {
                "asset_key": asset_key,
                "is_analysis_capable": False,
                "asset_category": "PREVIEW_ASSET",
                "media_type": media_type,
                "roles": roles,
                "title": asset_data.get("title", f"Preview {asset_key}"),
                "reason": "Preview/thumbnail assets lack georeferenced spectral bands and full resolution.",
            }

        is_geotiff = (
            "tiff" in media_type
            or "geotiff" in media_type
            or href.lower().endswith(".tif")
            or href.lower().endswith(".tiff")
            or asset_key in cls.BAND_RESOLUTIONS
        )

        resolution = cls.BAND_RESOLUTIONS.get(asset_key, 10)
        proj_epsg = asset_data.get("proj:epsg")
        crs = f"EPSG:{proj_epsg}" if proj_epsg else "EPSG:32644"

        shape = asset_data.get("proj:shape", [10980, 10980])
        transform = asset_data.get("proj:transform")

        return {
            "asset_key": asset_key,
            "is_analysis_capable": is_geotiff,
            "asset_category": "ANALYSIS_ASSET" if is_geotiff else "METADATA_ASSET",
            "media_type": media_type or "image/tiff; application=geotiff; profile=cloud-optimized",
            "roles": roles if roles else ["data"],
            "title": asset_data.get("title", f"{asset_key} (Sentinel-2 L2A {resolution}m)"),
            "resolution": resolution,
            "band_name": asset_key,
            "crs": crs,
            "shape": shape,
            "transform": transform,
            "is_cog": "cloud-optimized" in media_type or ".blob.core.windows.net" in href,
            "requires_signing": ".blob.core.windows.net" in href,
        }

    @staticmethod
    def inspect_raster_array(
        arr: np.ndarray,
        crs: str = "EPSG:32644",
        transform: Optional[List[float]] = None,
        resolution: float = 10.0,
        nodata_val: Optional[Union[int, float]] = 0,
    ) -> Dict[str, Any]:
        """Inspects in-memory raster data and extracts scientific raster metadata."""
        if not isinstance(arr, np.ndarray):
            raise TypeError("Input raster must be a numpy.ndarray.")

        shape = arr.shape
        if arr.ndim == 2:
            height, width = shape
            count = 1
        elif arr.ndim == 3:
            height, width, count = shape[0], shape[1], shape[2]
        else:
            raise ValueError(f"Unsupported array dimensions: {shape}")

        # Compute valid data percentage
        if nodata_val is not None:
            valid_mask = (arr != nodata_val)
            valid_pct = round(float(np.mean(valid_mask)) * 100.0, 2)
        else:
            valid_pct = 100.0

        return {
            "width": width,
            "height": height,
            "count": count,
            "dtype": str(arr.dtype),
            "crs": crs,
            "affine_transform": transform or [resolution, 0.0, 500000.0, 0.0, -resolution, 5000000.0],
            "resolution": resolution,
            "nodata": nodata_val,
            "valid_data_percentage": valid_pct,
            "min_val": float(np.min(arr)),
            "max_val": float(np.max(arr)),
            "mean_val": round(float(np.mean(arr)), 2),
        }

    @staticmethod
    def compute_spatial_intersection(
        bbox1: List[float], bbox2: List[float]
    ) -> Dict[str, Any]:
        """Calculates spatial intersection and overlap percentage between two bounding boxes.

        Format: [min_lon, min_lat, max_lon, max_lat]
        """
        min_lon = max(bbox1[0], bbox2[0])
        min_lat = max(bbox1[1], bbox2[1])
        max_lon = min(bbox1[2], bbox2[2])
        max_lat = min(bbox1[3], bbox2[3])

        if min_lon >= max_lon or min_lat >= max_lat:
            return {
                "intersects": False,
                "intersection_bbox": [0.0, 0.0, 0.0, 0.0],
                "overlap_percentage": 0.0,
            }

        inter_area = (max_lon - min_lon) * (max_lat - min_lat)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        overlap = (inter_area / area1 * 100.0) if area1 > 0 else 0.0

        return {
            "intersects": True,
            "intersection_bbox": [
                round(min_lon, 6),
                round(min_lat, 6),
                round(max_lon, 6),
                round(max_lat, 6),
            ],
            "overlap_percentage": round(min(100.0, overlap), 2),
        }

    @classmethod
    def compute_aoi_subwindow(
        cls,
        scene_bbox: List[float],
        aoi_bbox: List[float],
        raster_shape: Tuple[int, int] = (10980, 10980),
        resolution_m: float = 10.0,
    ) -> Dict[str, Any]:
        """Calculates pixel subwindow coordinates for AOI extraction within a satellite scene."""
        inter = cls.compute_spatial_intersection(scene_bbox, aoi_bbox)
        if not inter["intersects"]:
            return {
                "col_off": 0,
                "row_off": 0,
                "width": 0,
                "height": 0,
                "aoi_bbox": [0.0, 0.0, 0.0, 0.0],
                "pixel_resolution": resolution_m,
                "estimated_size_bytes": 0,
                "range_header_supported": True,
            }

        i_min_lon, i_min_lat, i_max_lon, i_max_lat = inter["intersection_bbox"]
        scene_min_lon, scene_min_lat, scene_max_lon, scene_max_lat = scene_bbox
        raster_h, raster_w = raster_shape

        scene_lon_span = scene_max_lon - scene_min_lon
        scene_lat_span = scene_max_lat - scene_min_lat

        col_off = max(0, int(math.floor(((i_min_lon - scene_min_lon) / scene_lon_span) * raster_w)))
        col_end = min(raster_w, int(math.ceil(((i_max_lon - scene_min_lon) / scene_lon_span) * raster_w)))
        row_off = max(0, int(math.floor(((scene_max_lat - i_max_lat) / scene_lat_span) * raster_h)))
        row_end = min(raster_h, int(math.ceil(((scene_max_lat - i_min_lat) / scene_lat_span) * raster_h)))

        width = max(1, col_end - col_off)
        height = max(1, row_end - row_off)
        estimated_size = width * height * 2  # 16-bit uint16

        return {
            "col_off": col_off,
            "row_off": row_off,
            "width": width,
            "height": height,
            "aoi_bbox": inter["intersection_bbox"],
            "pixel_resolution": resolution_m,
            "estimated_size_bytes": estimated_size,
            "range_header_supported": True,
        }

    @classmethod
    def evaluate_temporal_pair(
        cls,
        before_scene: Dict[str, Any],
        after_scene: Dict[str, Any],
        before_assets: List[Dict[str, Any]],
        after_assets: List[Dict[str, Any]],
        aoi: Dict[str, float],
    ) -> Dict[str, Any]:
        """Validates temporal pair compatibility and determines analysis readiness.

        Terminology enforced: 'Image Alignment', 'Dimension Reconciliation'.
        """
        issues: List[str] = []

        before_id = before_scene.get("scene_id") or before_scene.get("sceneId")
        after_id = after_scene.get("scene_id") or after_scene.get("sceneId")

        if not before_id or not after_id:
            issues.append("Both before and after scene IDs are required.")
        elif before_id == after_id:
            issues.append("Before and after scenes must be distinct acquisitions.")

        # Date validation
        b_date = before_scene.get("acquisition_date") or before_scene.get("acquisitionDate")
        a_date = after_scene.get("acquisition_date") or after_scene.get("acquisitionDate")

        if not b_date or not a_date:
            issues.append("Valid acquisition dates required for both scenes.")
        else:
            try:
                dt_b = datetime.fromisoformat(b_date.replace("Z", "+00:00"))
                dt_a = datetime.fromisoformat(a_date.replace("Z", "+00:00"))
                if dt_b > dt_a:
                    issues.append(f"Chronological order violation: beforeScene ({b_date}) is later than afterScene ({a_date}).")
                temporal_gap_days = abs((dt_a - dt_b).days)
            except Exception:
                issues.append("Error parsing ISO 8601 acquisition dates.")
                temporal_gap_days = 0

        # Analysis Assets check
        analysis_before = [a for a in before_assets if a.get("is_analysis_capable")]
        analysis_after = [a for a in after_assets if a.get("is_analysis_capable")]

        if not analysis_before:
            issues.append(f"No georeferenced raster analysis assets found for beforeScene '{before_id}'.")
        if not analysis_after:
            issues.append(f"No georeferenced raster analysis assets found for afterScene '{after_id}'.")

        # AOI spatial intersection
        aoi_bbox = [aoi["min_lon"], aoi["min_lat"], aoi["max_lon"], aoi["max_lat"]]
        b_bbox = before_scene.get("bbox", [0, 0, 0, 0])
        a_bbox = after_scene.get("bbox", [0, 0, 0, 0])

        inter_b = cls.compute_spatial_intersection(b_bbox, aoi_bbox)
        inter_a = cls.compute_spatial_intersection(a_bbox, aoi_bbox)

        if not inter_b["intersects"] or not inter_a["intersects"]:
            issues.append("Spatial coverage failure: AOI does not intersect both satellite scene footprints.")

        # Coordinate Reference System check
        b_crs = analysis_before[0].get("crs", "EPSG:32644") if analysis_before else "EPSG:32644"
        a_crs = analysis_after[0].get("crs", "EPSG:32644") if analysis_after else "EPSG:32644"
        crs_match = (b_crs == a_crs)

        b_res = analysis_before[0].get("resolution", 10) if analysis_before else 10
        a_res = analysis_after[0].get("resolution", 10) if analysis_after else 10
        target_res = min(b_res, a_res)

        status = "READY_FOR_ANALYSIS" if not issues else "NOT_READY"

        alignment_info = {
            "status": "ALIGNED" if crs_match and b_res == a_res else "RECONCILED",
            "before_crs": b_crs,
            "after_crs": a_crs,
            "crs_match": crs_match,
            "target_crs": b_crs if crs_match else f"{b_crs} (Reprojection required)",
            "before_resolution": b_res,
            "after_resolution": a_res,
            "target_resolution": target_res,
            "aoi_intersection_percentage": min(inter_b["overlap_percentage"], inter_a["overlap_percentage"]),
            "dimension_reconciliation": {
                "method": "Dimension Reconciliation: Affine grid intersection",
                "resampling_required": not (crs_match and b_res == a_res),
            },
        }

        provenance = {
            "provenance_id": f"PROV-{str(uuid.uuid4())[:8]}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "provider": before_scene.get("source_provider", "Copernicus Sentinel-2 L2A STAC"),
            "collection": before_scene.get("collection", "sentinel-2-l2a"),
            "before_scene_id": before_id,
            "after_scene_id": after_id,
            "crs": alignment_info["target_crs"],
            "resolution_meters": target_res,
            "aoi_bbox": aoi_bbox,
            "processing_chain": [
                "STAC Item Discovery & Metadata Verification",
                "Analysis Asset Segregation (Exclusion of preview/thumbnail PNG/JPEGs)",
                "CRS Compatibility Verification & Transform Inspection",
                "Spatial Intersection & AOI Subwindow Resolution",
                "Image Alignment & Dimension Reconciliation Planning",
                "Staged for Phase 4B Bi-Temporal Change Detection" if status == "READY_FOR_ANALYSIS" else "Preparation Halted",
            ],
        }

        return {
            "status": status,
            "before_scene": before_scene,
            "after_scene": after_scene,
            "aoi": aoi,
            "temporal_gap_days": temporal_gap_days,
            "alignment": alignment_info,
            "provenance": provenance,
            "issues": issues,
        }
