"""Scene model representing a single satellite observation."""

from datetime import date
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator


class Scene(BaseModel):
    """Represents a specific satellite observation scene taken at a particular timestamp."""

    scene_id: str = Field(..., description="Unique identifier for the scene")
    location_id: str = Field(..., description="Identifier of the associated geographic location")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude of scene center in decimal degrees")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude of scene center in decimal degrees")
    sensor: str = Field(..., description="Sensor name (e.g., MSI, OLI, SAR-C)")
    platform: str = Field(default="Sentinel-2", description="Satellite platform (e.g., Sentinel-2A, Landsat-8)")
    acquisition_date: str = Field(..., description="Date of acquisition in YYYY-MM-DD format")
    resolution_meters: Optional[float] = Field(default=10.0, description="Spatial resolution in meters per pixel")
    image_path: str = Field(..., description="Relative or absolute path to scene image file")
    thumbnail_path: Optional[str] = Field(default=None, description="Path to precomputed thumbnail")
    cloud_percentage: Optional[float] = Field(default=None, ge=0.0, le=100.0, description="Cloud cover percentage (0-100)")
    source: str = Field(default="prototype_dataset", description="Origin/source of imagery")
    tags: List[str] = Field(default_factory=list, description="Categorical or semantic tags associated with scene")
    processing_status: str = Field(default="available", description="Pipeline processing status (e.g. available, indexed, error)")
    extra_metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary supplemental sensor metadata")

    @field_validator("acquisition_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        # Validate ISO YYYY-MM-DD
        try:
            date.fromisoformat(v)
        except ValueError:
            raise ValueError(f"acquisition_date '{v}' must be valid ISO format YYYY-MM-DD")
        return v
