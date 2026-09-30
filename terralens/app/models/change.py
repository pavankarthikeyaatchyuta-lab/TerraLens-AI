"""Data models for multi-temporal change detection and region extraction."""

from typing import List, Optional, Dict, Any, Tuple
from pydantic import BaseModel, Field


class ChangeRegion(BaseModel):
    """Represents a discrete contiguous spatial cluster of detected multi-temporal change."""

    region_id: int = Field(..., description="Unique integer index of the connected region")
    x: int = Field(..., description="Bounding box top-left X coordinate in pixel space")
    y: int = Field(..., description="Bounding box top-left Y coordinate in pixel space")
    width: int = Field(..., description="Bounding box width in pixels")
    height: int = Field(..., description="Bounding box height in pixels")
    area_pixels: int = Field(..., description="Total number of changed pixels in this connected component")
    relative_area: float = Field(..., description="Area fraction relative to the total analyzed image scene")
    centroid: Tuple[float, float] = Field(..., description="Spatial centroid (x, y) of the connected component")
    bbox_geo: Optional[Dict[str, float]] = Field(default=None, description="Optional bounding box in geographic coordinates")


class ChangeDetectionResult(BaseModel):
    """Container for multi-temporal change detection outputs, metrics, and diagnostics."""

    status: str = Field(
        ...,
        description="High-level status: CHANGE_DETECTED, NO_SIGNIFICANT_CHANGE, UNCERTAIN, or INCOMPLETE_DATA"
    )
    change_type: str = Field(
        default="Detected Change",
        description="Categorical change classification (e.g. Detected Change, No Significant Change, Uncertain)"
    )
    detector_name: str = Field(
        default="DeterministicBiTemporalChangeDetector",
        description="Name of the change detection model or engine executed"
    )
    detector_label: str = Field(
        default="Deterministic Bi-Temporal Baseline",
        description="Human-readable label of the detection algorithm"
    )

    # Measurable pixel-level metrics
    changed_pixels: int = Field(default=0, ge=0, description="Count of binary changed pixels after filtering")
    total_pixels: int = Field(default=0, ge=0, description="Total number of valid evaluated pixels in scene")
    change_ratio: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Fraction of valid image area exhibiting detected change (changed_pixels / total_pixels)"
    )

    # Structured spatial regions
    change_regions: List[ChangeRegion] = Field(default_factory=list, description="Extracted connected change components")

    # Honest, measurable confidence calculation
    confidence_score: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Measurable confidence derived from signal contrast, spatial coherence, and alignment quality"
    )
    confidence_breakdown: Dict[str, float] = Field(
        default_factory=dict,
        description="Transparent score breakdown (signal_strength, spatial_coherence, quality_score, penalty)"
    )
    quality_score: Optional[float] = Field(
        default=None,
        description="Measurable contrast/dynamic range score of the analyzed scene pair"
    )

    # File paths for persisted artifacts
    change_mask_path: Optional[str] = Field(default=None, description="Local path to persisted binary change mask PNG")
    difference_image_path: Optional[str] = Field(default=None, description="Local path to persisted difference heatmap PNG")
    overlay_image_path: Optional[str] = Field(default=None, description="Local path to persisted visualization overlay PNG")

    # Audit & diagnostics
    preprocessing_steps: List[str] = Field(
        default_factory=list,
        description="Ordered list of deterministic preprocessing steps executed"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Quality, cross-sensor, or seasonal false-alarm warnings"
    )
    diagnostics: Dict[str, Any] = Field(
        default_factory=dict,
        description="Technical parameters (thresholds, kernel sizes, timing)"
    )
