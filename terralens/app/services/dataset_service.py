"""Dataset service for discovering local imagery files and auditing dataset health."""

import logging
from pathlib import Path
from typing import Dict, List, Any, Optional

from terralens.app.models.location import Location
from terralens.app.models.scene import Scene
from terralens.app.services.metadata_service import MetadataService
from terralens.app.utils.config import config
from terralens.app.utils.image_utils import load_image_safely

logger = logging.getLogger("terralens.dataset_service")


class DatasetService:
    """Discovers, validates, and manages physical satellite imagery stored locally."""

    def __init__(self, metadata_service: MetadataService):
        self.meta_service = metadata_service
        self.data_dir = config.DATA_DIR
        self.samples_dir = config.SAMPLES_DIR

    def resolve_image_path(self, relative_or_absolute_path: str) -> Path:
        """Resolves an image path to an absolute path against PROJECT_ROOT or DATA_DIR."""
        path = Path(relative_or_absolute_path)
        if path.is_absolute() and path.exists():
            return path

        # Try relative to PROJECT_ROOT
        candidate_root = config.PROJECT_ROOT / path
        if candidate_root.exists():
            return candidate_root

        # Try relative to DATA_DIR
        candidate_data = config.DATA_DIR / path
        if candidate_data.exists():
            return candidate_data

        return candidate_root  # Return canonical candidate path for logging

    def get_dataset_summary(self) -> Dict[str, Any]:
        """Audits the dataset and returns status metrics."""
        locations = self.meta_service.get_all_locations()
        scenes = list(self.meta_service.scenes.values())

        missing_images: List[str] = []
        valid_scenes = 0

        for scene in scenes:
            resolved = self.resolve_image_path(scene.image_path)
            if resolved.exists():
                valid_scenes += 1
            else:
                missing_images.append(f"{scene.scene_id} -> {scene.image_path}")

        status = "Healthy" if len(missing_images) == 0 and len(locations) > 0 else "Degraded"
        if len(locations) == 0:
            status = "Empty"

        return {
            "status": status,
            "dataset_name": config.DATASET_LABEL,
            "total_locations": len(locations),
            "total_scenes": len(scenes),
            "valid_scenes_on_disk": valid_scenes,
            "missing_scenes_count": len(missing_images),
            "missing_scenes": missing_images,
            "is_prototype": "prototype" in config.DATASET_LABEL.lower(),
        }

    def get_location_imagery_paths(self, location: Location) -> Dict[str, Optional[Path]]:
        """Finds resolved file paths for before and after scenes of a location."""
        before_path: Optional[Path] = None
        after_path: Optional[Path] = None

        if location.before_scene_id:
            scene_before = self.meta_service.get_scene_by_id(location.before_scene_id)
            if scene_before:
                p = self.resolve_image_path(scene_before.image_path)
                if p.exists():
                    before_path = p

        if location.after_scene_id:
            scene_after = self.meta_service.get_scene_by_id(location.after_scene_id)
            if scene_after:
                p = self.resolve_image_path(scene_after.image_path)
                if p.exists():
                    after_path = p

        return {
            "before": before_path,
            "after": after_path,
        }
