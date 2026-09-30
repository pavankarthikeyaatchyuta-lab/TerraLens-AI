"""Evidence and Provenance models for auditability and verification."""

from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ProvenanceStep(BaseModel):
    """A discrete verified step in the intelligence decision pipeline."""
    step_name: str = Field(..., description="Stage name (e.g. QUERY, RETRIEVAL, PREPROCESSING, TEMPORAL_COMPARE)")
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat(), description="UTC timestamp")
    status: str = Field(default="COMPLETED", description="Status: COMPLETED, PENDING, NOT_CALCULATED, FAILED")
    details: Dict[str, Any] = Field(default_factory=dict, description="Detailed parameters and artifacts")


class ProvenanceTrace(BaseModel):
    """Full end-to-end lineage trace for intelligence verification."""
    trace_id: str = Field(..., description="Unique UUID for this analysis trace")
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    query: Optional[str] = Field(default=None, description="Natural language search or filter query")
    location_id: str = Field(..., description="Target location ID")
    steps: List[ProvenanceStep] = Field(default_factory=list, description="Ordered execution audit trail")


class Evidence(BaseModel):
    """Formal evidence packet compiled for analyst review and validation."""

    evidence_id: str = Field(..., description="Unique evidence record identifier")
    location_id: str = Field(..., description="Associated location identifier")
    location_name: str = Field(..., description="Name of the location")
    coordinates: str = Field(..., description="Formatted latitude, longitude coordinates")
    sensor: str = Field(..., description="Primary sensor used")
    before_date: Optional[str] = Field(default=None, description="Baseline observation date")
    after_date: Optional[str] = Field(default=None, description="Recent observation date")
    source: str = Field(default="prototype_dataset", description="Origin of the imagery")
    processing_status: str = Field(default="PROTOTYPE_STAGED", description="Pipeline state")

    # Retrieval Evidence (Phase 2)
    retrieval_method: str = Field(
        default="Direct Catalog Navigation",
        description="Method used to retrieve candidate location (e.g. Semantic Vector Search, Keyword Filter)"
    )
    embedding_model: Optional[str] = Field(
        default=None,
        description="Vision-language model used for embedding (e.g. CLIP baseline)"
    )
    index_name: Optional[str] = Field(
        default=None,
        description="Vector index file used for retrieval (e.g. satellite_embeddings.index)"
    )
    similarity_score: Optional[float] = Field(
        default=None,
        description="Cosine similarity score from FAISS vector search"
    )

    # Change Analysis fields (Phase 3 Real Multi-Temporal Metrics)
    change_type: Optional[str] = Field(
        default=None,
        description="Categorical change detected (None indicates not yet analyzed)"
    )
    change_confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Measurable confidence score derived from physical contrast and spatial coherence"
    )
    changed_pixels: Optional[int] = Field(
        default=None,
        description="Number of changed pixels identified after false-alarm mitigation"
    )
    total_pixels: Optional[int] = Field(
        default=None,
        description="Total valid evaluated scene pixels"
    )
    change_ratio: Optional[float] = Field(
        default=None,
        description="Fraction of scene exhibiting change (changed_pixels / total_pixels)"
    )
    detected_regions_count: Optional[int] = Field(
        default=None,
        description="Number of structured connected components extracted"
    )
    quality_score: Optional[float] = Field(
        default=None,
        description="Image pair contrast and dynamic range assessment score"
    )
    change_mask_path: Optional[str] = Field(
        default=None,
        description="Path to generated binary change mask PNG"
    )
    difference_image_path: Optional[str] = Field(
        default=None,
        description="Path to generated difference heatmap PNG"
    )
    overlay_image_path: Optional[str] = Field(
        default=None,
        description="Path to generated visual change overlay PNG"
    )
    warnings: List[str] = Field(
        default_factory=list,
        description="Quality, cross-sensor, or seasonal false-alarm warnings"
    )

    # Lineage and Review
    provenance: Optional[ProvenanceTrace] = Field(default=None, description="Full audit lineage")
    analyst_decision: Optional[str] = Field(
        default="PENDING_REVIEW",
        description="Status of human analyst review (e.g., PENDING_REVIEW, CONFIRMED, REJECTED, ESCALATED)"
    )
    analyst_notes: Optional[str] = Field(
        default="",
        description="Operational remarks recorded by the analyst"
    )
