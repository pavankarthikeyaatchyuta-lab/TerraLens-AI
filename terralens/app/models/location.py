"""Location model representing a monitored geographic area of interest (AOI)."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Geographic bounding box in decimal degrees [WGS84]."""
    min_lat: float = Field(..., ge=-90.0, le=90.0)
    min_lon: float = Field(..., ge=-180.0, le=180.0)
    max_lat: float = Field(..., ge=-90.0, le=90.0)
    max_lon: float = Field(..., ge=-180.0, le=180.0)


class Location(BaseModel):
    """Represents a discrete geographic monitoring target with temporal scene coverage."""

    location_id: str = Field(..., description="Unique alphanumeric identifier (e.g. LOC_001)")
    name: str = Field(..., description="Human-readable location title")
    description: str = Field(default="", description="Detailed contextual description of the site")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Center latitude")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Center longitude")
    bounding_box: Optional[BoundingBox] = Field(default=None, description="Spatial extent of AOI")
    primary_sensor: str = Field(default="Sentinel-2", description="Primary sensor family")
    before_scene_id: Optional[str] = Field(default=None, description="Baseline / before scene ID")
    after_scene_id: Optional[str] = Field(default=None, description="Monitoring / after scene ID")
    available_dates: List[str] = Field(default_factory=list, description="Available observation dates")
    tags: List[str] = Field(default_factory=list, description="Semantic tags (e.g., urban, water, forest)")
    source: str = Field(default="prototype_dataset", description="Origin of this location record")
    extra_metadata: Dict[str, Any] = Field(default_factory=dict, description="Custom sensor/geographic properties")
