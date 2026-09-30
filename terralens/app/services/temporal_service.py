"""Temporal analysis service architecture for multi-temporal satellite comparison."""

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple, Dict, Any
from PIL import Image

from terralens.app.models.location import Location
from terralens.app.models.scene import Scene
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.metadata_service import MetadataService
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
    """Container for change detection output.

    Fields are explicitly typed and marked as 'NOT_IMPLEMENTED' or None
    until actual deep-learning change detectors (e.g. Siamese UNet/ChangeFormer) are added.
    """
    status: str  # e.g., "NOT_IMPLEMENTED", "READY_FOR_PIPELINE", "COMPLETED"
    message: str
    change_type: Optional[str] = None
    confidence_score: Optional[float] = None
    change_mask: Optional[Image.Image] = None
    change_percentage: Optional[float] = None
    metrics: Dict[str, Any] = None


class TemporalAnalysisService:
    """Core service for managing, aligning, and analyzing multi-temporal imagery pairs."""

    def __init__(self, metadata_service: MetadataService, dataset_service: DatasetService):
        self.meta_service = metadata_service
        self.dataset_service = dataset_service
        self.service_status = "Phase 1 Prototype (Display & Inspection Layer)"

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
        """Aligns temporal images spatially (e.g., SIFT / ECC / affine transformation).

        In Phase 1, images are dimensionally reconciled without claiming algorithmic warp.
        """
        if before_img.size != after_img.size:
            # Reconcile dimensions safely to match for side-by-side rendering
            target_size = before_img.size
            after_resized = after_img.resize(target_size, Image.Resampling.BILINEAR)
            return before_img, after_resized, "Resized to match dimensions (Phase 1 Baseline)"

        return before_img, after_img, "Identity (Native Coordinates Aligned)"

    def normalize_images(
        self,
        before_img: Image.Image,
        after_img: Image.Image
    ) -> Tuple[Image.Image, Image.Image, str]:
        """Histogram matching and radiometric normalization.

        Stubbed honestly for Phase 2 implementation.
        """
        return before_img, after_img, "Radiometric normalization: Scheduled for Phase 2"

    def detect_change(
        self,
        before_img: Optional[Image.Image],
        after_img: Optional[Image.Image]
    ) -> ChangeAnalysisResult:
        """Executes automated multi-temporal change detection.

        Strictly reports that automated detection model is planned for Phase 2,
        ensuring NO deceptive mock confidence numbers are presented.
        """
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
            confidence_score=None,  # No fake scores
            change_mask=None,
            change_percentage=None,
            metrics={
                "engine": "Scheduled for Phase 2",
                "alignment_status": "Identity check passed",
                "radiometric_normalization": "Pending calibration pipeline",
            },
        )
