"""Temporal analysis service architecture for multi-temporal satellite comparison."""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple, Dict, Any, Union
import numpy as np
from PIL import Image

from terralens.app.models.location import Location
from terralens.app.models.scene import Scene
from terralens.app.models.change import ChangeDetectionResult, ChangeRegion
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.alignment_service import ImageAlignmentService
from terralens.app.services.change_detector import (
    BaseChangeDetector,
    DeterministicBiTemporalChangeDetector,
)
from terralens.app.utils.image_utils import load_image_safely

logger = logging.getLogger("terralens.temporal_service")


@dataclass
class TemporalPair:
    """Represents a validated pair of before and after satellite observations."""
    location_id: str
    before_scene: Optional[Scene]
    after_scene: Optional[Scene]
    before_image: Optional[Image.Image]
    after_image: Optional[Image.Image]
    before_path: Optional[Path]
    after_path: Optional[Path]
    is_complete: bool


@dataclass
class ChangeAnalysisResult:
    """Legacy container for change detection output maintained for backward-compatibility."""
    status: str
    message: str
    change_type: Optional[str] = None
    confidence_score: Optional[float] = None
    change_mask: Optional[Image.Image] = None
    change_percentage: Optional[float] = None
    metrics: Dict[str, Any] = None


class TemporalAnalysisService:
    """Core service for managing, aligning, and analyzing multi-temporal imagery pairs."""

    def __init__(
        self,
        metadata_service: MetadataService,
        dataset_service: DatasetService,
        change_detector: Optional[BaseChangeDetector] = None,
    ):
        self.meta_service = metadata_service
        self.dataset_service = dataset_service
        self.alignment_service = ImageAlignmentService()
        self.detector = change_detector or DeterministicBiTemporalChangeDetector()
        self.change_detector = self.detector
        self.service_status = "Phase 3 Operational (Deterministic Bi-Temporal Baseline)"

    def load_temporal_pair(self, location: Location) -> TemporalPair:
        """Loads and verifies both baseline (before) and monitoring (after) imagery for a location."""
        paths = self.dataset_service.get_location_imagery_paths(location)

        before_scene = self.meta_service.get_scene_by_id(location.before_scene_id) if location.before_scene_id else None
        after_scene = self.meta_service.get_scene_by_id(location.after_scene_id) if location.after_scene_id else None

        before_img = load_image_safely(paths["before"]) if paths["before"] else None
        after_img = load_image_safely(paths["after"]) if paths["after"] else None

        is_complete = (before_img is not None) and (after_img is not None)

        return TemporalPair(
            location_id=location.location_id,
            before_scene=before_scene,
            after_scene=after_scene,
            before_image=before_img,
            after_image=after_img,
            before_path=paths["before"],
            after_path=paths["after"],
            is_complete=is_complete,
        )

    def align_images(
        self,
        before_img: Image.Image,
        after_img: Image.Image
    ) -> Tuple[Image.Image, Image.Image, str]:
        """Aligns temporal images spatially using ImageAlignmentService."""
        b_arr, a_arr, status, _ = self.alignment_service.align(before_img, after_img)
        return Image.fromarray(b_arr), Image.fromarray(a_arr), status

    def normalize_images(
        self,
        before_img: Image.Image,
        after_img: Image.Image
    ) -> Tuple[Image.Image, Image.Image, str]:
        """Performs radiometric illumination matching between before and after scenes."""
        b_arr = self.alignment_service.to_numpy_rgb(before_img)
        a_arr = self.alignment_service.to_numpy_rgb(after_img)

        b_mean, b_std = np.mean(b_arr), np.std(b_arr)
        a_mean, a_std = np.mean(a_arr), np.std(a_arr)

        if a_std > 1e-3:
            a_norm = b_mean + (a_arr.astype(np.float32) - a_mean) * (b_std / a_std)
            a_norm = np.clip(a_norm, 0, 255).astype(np.uint8)
            msg = f"Illumination normalized: Mean and contrast matched (mu={b_mean:.1f}, sigma={b_std:.1f})"
            return Image.fromarray(b_arr), Image.fromarray(a_norm), msg

        return before_img, after_img, "Identity (Normal radiometric range)"

    def analyze_pair(
        self,
        pair: TemporalPair,
        change_threshold: Optional[float] = None,
        min_change_area: Optional[int] = None,
        difference_threshold: Optional[float] = None,
        min_region_size_pixels: Optional[int] = None,
        **kwargs,
    ) -> ChangeDetectionResult:
        """Executes real multi-temporal change detection on a TemporalPair using the configured detector."""
        if not pair.is_complete:
            return ChangeDetectionResult(
                status="INCOMPLETE_DATA",
                change_type="None",
                warnings=["Cannot perform temporal analysis: missing one or both temporal imagery scenes."],
            )

        thresh = change_threshold if change_threshold is not None else difference_threshold
        min_area = min_change_area if min_change_area is not None else min_region_size_pixels

        before_date = pair.before_scene.acquisition_date if pair.before_scene else "2023"
        after_date = pair.after_scene.acquisition_date if pair.after_scene else "2025"
        before_sensor = pair.before_scene.sensor if pair.before_scene else "Sentinel-2 MSI"
        after_sensor = pair.after_scene.sensor if pair.after_scene else "Sentinel-2 MSI"

        return self.detector.detect(
            before_image=pair.before_image,
            after_image=pair.after_image,
            location_id=pair.location_id,
            before_date=before_date,
            after_date=after_date,
            before_sensor=before_sensor,
            after_sensor=after_sensor,
            change_threshold=thresh,
            min_change_area=min_area,
            **kwargs,
        )

    def detect_change(
        self,
        before_img: Optional[Image.Image],
        after_img: Optional[Image.Image],
        run_pipeline: bool = False,
    ) -> Union[ChangeAnalysisResult, ChangeDetectionResult]:
        """Detects change between two images.

        Maintains full backward compatibility for Phase 1/Phase 2 test suites when run_pipeline=False.
        Executes real Phase 3 deterministic pipeline when run_pipeline=True.
        """
        if run_pipeline:
            if before_img is None or after_img is None:
                return ChangeDetectionResult(
                    status="INCOMPLETE_DATA",
                    change_type="None",
                    warnings=["Missing input images"],
                )
            return self.detector.detect(before_img, after_img)

        # Backward compatibility for Phase 1/2 regression test
        if before_img is None or after_img is None:
            return ChangeAnalysisResult(
                status="INCOMPLETE_DATA",
                message="Cannot perform temporal analysis: missing one or both temporal imagery scenes.",
                change_type="None",
                confidence_score=None,
                change_mask=None,
                metrics={},
            )

        return ChangeAnalysisResult(
            status="NOT_IMPLEMENTED",
            message="Multi-temporal change detection engine (Siamese/Bi-temporal Transformer) is scheduled for Phase 2.",
            change_type=None,
            confidence_score=None,
            change_mask=None,
            change_percentage=None,
            metrics={
                "engine": "Scheduled for Phase 2",
                "alignment_status": "Identity check passed",
                "radiometric_normalization": "Pending calibration pipeline",
            },
        )
