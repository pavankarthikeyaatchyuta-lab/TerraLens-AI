"""Metadata service for loading, validating, and querying satellite scenes and locations."""

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional
from pydantic import ValidationError

from terralens.app.models.location import Location, BoundingBox
from terralens.app.models.scene import Scene
from terralens.app.utils.config import config

logger = logging.getLogger("terralens.metadata_service")


class MetadataService:
    """Manages metadata catalogs for monitored locations and satellite scenes."""

    def __init__(self, metadata_path: Optional[Path] = None):
        self.metadata_path = Path(metadata_path or config.METADATA_PATH)
        self.locations: Dict[str, Location] = {}
        self.scenes: Dict[str, Scene] = {}
        self._load_metadata()

    def _load_metadata(self) -> None:
        """Loads and parses the JSON metadata catalog."""
        if not self.metadata_path.exists():
            logger.warning(f"Metadata catalog not found at: {self.metadata_path}")
            return

        try:
            with open(self.metadata_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read JSON metadata file {self.metadata_path}: {e}")
            return

        # Parse locations
        raw_locations = data.get("locations", [])
        for loc_data in raw_locations:
            try:
                # Handle nested bounding box if present as dict
                if "bounding_box" in loc_data and isinstance(loc_data["bounding_box"], dict):
                    loc_data["bounding_box"] = BoundingBox(**loc_data["bounding_box"])
                loc = Location(**loc_data)
                self.locations[loc.location_id] = loc
            except ValidationError as ve:
                logger.error(f"Validation error in location {loc_data.get('location_id')}: {ve}")
            except Exception as ex:
                logger.error(f"Unexpected error parsing location: {ex}")

        # Parse scenes
        raw_scenes = data.get("scenes", [])
        for scene_data in raw_scenes:
            try:
                scene = Scene(**scene_data)
                self.scenes[scene.scene_id] = scene
            except ValidationError as ve:
                logger.error(f"Validation error in scene {scene_data.get('scene_id')}: {ve}")
            except Exception as ex:
                logger.error(f"Unexpected error parsing scene: {ex}")

        logger.info(
            f"Successfully cataloged {len(self.locations)} locations and {len(self.scenes)} scenes from {self.metadata_path}"
        )

    def reload(self) -> None:
        """Reloads the catalog from disk."""
        self.locations.clear()
        self.scenes.clear()
        self._load_metadata()

    def get_all_locations(self) -> List[Location]:
        """Returns all registered locations."""
        return list(self.locations.values())

    def get_location_by_id(self, location_id: str) -> Optional[Location]:
        """Retrieves a single location by its unique ID."""
        return self.locations.get(location_id)

    def get_scene_by_id(self, scene_id: str) -> Optional[Scene]:
        """Retrieves a single scene by its unique ID."""
        return self.scenes.get(scene_id)

    def get_scenes_for_location(self, location_id: str) -> List[Scene]:
        """Retrieves all scenes captured for a given location, sorted chronologically."""
        scenes = [s for s in self.scenes.values() if s.location_id == location_id]
        scenes.sort(key=lambda s: s.acquisition_date)
        return scenes

    def filter_locations(
        self,
        sensor: Optional[str] = None,
        tag: Optional[str] = None,
        max_cloud: Optional[float] = None
    ) -> List[Location]:
        """Filters locations according to sensor, tag, or scene cloud coverage threshold."""
        results = list(self.locations.values())

        if sensor and sensor != "All Sensors":
            results = [loc for loc in results if loc.primary_sensor == sensor]

        if tag and tag != "All Tags":
            results = [loc for loc in results if tag.lower() in [t.lower() for t in loc.tags]]

        if max_cloud is not None:
            # Keep locations where all associated scenes have cloud_cover <= max_cloud (if recorded)
            filtered = []
            for loc in results:
                loc_scenes = self.get_scenes_for_location(loc.location_id)
                cloudy = False
                for sc in loc_scenes:
                    if sc.cloud_percentage is not None and sc.cloud_percentage > max_cloud:
                        cloudy = True
                        break
                if not cloudy:
                    filtered.append(loc)
            results = filtered

        return results
