"""Local dataset staging and ingestion service for TerraLens AI (SIH26227).

Enables offline / local ingestion of satellite scenes (GeoTIFF, COG, TIFF, PNG, JPEG),
extracting spatial, spectral, and temporal metadata, computing SHA-256 checksums,
deduplicating against existing indexes, and generating a standardized manifest.
"""

import os
import json
import hashlib
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime, timezone
from PIL import Image, TiffImagePlugin

from terralens.app.utils.config import config

logger = logging.getLogger("terralens.staging_service")


class LocalDatasetStagingService:
    """Discovers, validates, stages, and indexes local satellite imagery without network access."""

    SUPPORTED_EXTENSIONS = {".tif", ".tiff", ".geotiff", ".png", ".jpg", ".jpeg"}

    def __init__(
        self,
        staging_dir: Optional[Path] = None,
        manifest_filename: str = "staged_scenes_manifest.json",
    ):
        self.staging_dir = Path(staging_dir) if staging_dir else (config.DATA_DIR / "staged")
        self.manifest_path = self.staging_dir / manifest_filename
        self.staging_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def compute_sha256(file_path: Path) -> str:
        """Computes deterministic SHA-256 checksum of an imagery file in chunks."""
        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(65536):
                hasher.update(chunk)
        return hasher.hexdigest()

    @staticmethod
    def extract_image_metadata(file_path: Path) -> Dict[str, Any]:
        """Extracts spatial, band, and format metadata from an image file using PIL.
        
        Reads standard TIFF/GeoTIFF tags when available:
        - 33550: ModelPixelScaleTag (resolution [dx, dy, dz])
        - 33922: ModelTiepointTag (tie point [i, j, k, x, y, z])
        - 34735: GeoKeyDirectoryTag
        - 34737: GeoAsciiParamsTag (CRS description)
        """
        meta: Dict[str, Any] = {
            "format": file_path.suffix.lower().lstrip("."),
            "width": None,
            "height": None,
            "bands": ["B04", "B03", "B02"],  # default RGB
            "band_count": 3,
            "crs": "EPSG:4326 (Default WGS84)",
            "resolution_m": 10.0,
            "bbox": None,
        }

        try:
            with Image.open(file_path) as img:
                meta["width"] = img.width
                meta["height"] = img.height
                meta["mode"] = img.mode

                # Infer band count
                if img.mode in ("RGB", "YCbCr"):
                    meta["band_count"] = 3
                    meta["bands"] = ["B04", "B03", "B02"]
                elif img.mode == "RGBA":
                    meta["band_count"] = 4
                    meta["bands"] = ["B04", "B03", "B02", "B08"]
                elif img.mode in ("L", "I", "F"):
                    meta["band_count"] = 1
                    meta["bands"] = ["GRAYSCALE"]
                elif hasattr(img, "n_frames") and img.n_frames > 1:
                    meta["band_count"] = img.n_frames
                    meta["bands"] = [f"BAND_{i+1}" for i in range(img.n_frames)]

                # Check for TIFF / GeoTIFF tags
                if hasattr(img, "tag_v2"):
                    tag_v2 = img.tag_v2
                    # ModelPixelScaleTag
                    if 33550 in tag_v2:
                        scale = tag_v2[33550]
                        if len(scale) >= 1:
                            meta["resolution_m"] = round(float(scale[0]), 3)

                    # GeoAsciiParamsTag (CRS name)
                    if 34737 in tag_v2:
                        crs_raw = tag_v2[34737]
                        if isinstance(crs_raw, (bytes, str)):
                            meta["crs"] = str(crs_raw).strip("|\x00'")

                    # ModelTiepointTag ([i, j, k, x, y, z])
                    if 33922 in tag_v2 and 33550 in tag_v2:
                        tp = tag_v2[33922]
                        scale = tag_v2[33550]
                        if len(tp) >= 6 and len(scale) >= 2:
                            x0, y0 = float(tp[3]), float(tp[4])
                            dx, dy = float(scale[0]), float(scale[1])
                            w, h = img.width, img.height
                            x1 = x0 + (w * dx)
                            y1 = y0 - (h * dy)
                            meta["bbox"] = [
                                round(min(x0, x1), 6),
                                round(min(y0, y1), 6),
                                round(max(x0, x1), 6),
                                round(max(y0, y1), 6),
                            ]
        except Exception as e:
            logger.warning(f"Could not read PIL metadata for {file_path.name}: {e}")

        return meta

    @classmethod
    def load_sidecar_metadata(cls, image_path: Path) -> Dict[str, Any]:
        """Looks for matching sidecar JSON files (e.g. `scene.json` or `scene_metadata.json`)."""
        candidates = [
            image_path.with_suffix(".json"),
            image_path.parent / f"{image_path.stem}_metadata.json",
            image_path.parent / "metadata.json",
            image_path.parent / "scene_metadata.json",
        ]

        for cand in candidates:
            if cand.exists() and cand.is_file():
                try:
                    with open(cand, "r", encoding="utf-8") as f:
                        return json.load(f)
                except Exception as e:
                    logger.warning(f"Failed to parse sidecar {cand}: {e}")

        return {}

    def load_manifest(self) -> Dict[str, Any]:
        """Loads the current staging manifest if it exists."""
        if self.manifest_path.exists():
            try:
                with open(self.manifest_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.warning(f"Failed to read existing manifest: {e}. Reinitializing.")

        return {
            "project": "TerraLens AI",
            "problem_statement": "SIH26227",
            "manifest_version": "1.0.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_scenes": 0,
            "scenes": [],
        }

    def stage_local_scenes(
        self,
        source_dir: Path,
        recursive: bool = True,
        incremental: bool = True,
        default_sensor: str = "Sentinel-2 MSI L2A",
    ) -> Dict[str, Any]:
        """Scans a local directory, validates imagery, extracts metadata, and updates manifest.
        
        Guarantees:
        - Deduplication by SHA-256 and scene ID.
        - Deterministic schema recording.
        - Zero network access.
        """
        source_dir = Path(source_dir).resolve()
        if not source_dir.exists():
            raise FileNotFoundError(f"Source directory does not exist: {source_dir}")

        manifest = self.load_manifest() if incremental else {
            "project": "TerraLens AI",
            "problem_statement": "SIH26227",
            "manifest_version": "1.0.0",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "total_scenes": 0,
            "scenes": [],
        }

        # Track existing checksums and scene IDs for strict deduplication
        existing_checksums = {s.get("checksum_sha256") for s in manifest["scenes"] if "checksum_sha256" in s}
        existing_scene_ids = {s.get("scene_id") for s in manifest["scenes"]}

        # Scan files
        pattern = "**/*" if recursive else "*"
        discovered_files: List[Path] = [
            p for p in source_dir.glob(pattern)
            if p.is_file() and p.suffix.lower() in self.SUPPORTED_EXTENSIONS
        ]

        # Sort for deterministic processing order
        discovered_files.sort(key=lambda p: str(p).lower())

        staged_count = 0
        skipped_duplicates = 0
        corrupted_count = 0

        for file_path in discovered_files:
            # 1. Compute checksum
            try:
                sha = self.compute_sha256(file_path)
            except Exception as e:
                logger.error(f"Error reading {file_path}: {e}")
                corrupted_count += 1
                continue

            if sha in existing_checksums:
                logger.debug(f"Skipping duplicate checksum: {file_path.name}")
                skipped_duplicates += 1
                continue

            # 2. Extract technical image metadata
            img_meta = self.extract_image_metadata(file_path)
            if img_meta["width"] is None or img_meta["height"] is None:
                logger.warning(f"Could not open valid raster: {file_path.name}")
                corrupted_count += 1
                continue

            # 3. Check sidecar metadata
            sidecar = self.load_sidecar_metadata(file_path)

            # 4. Synthesize scene ID
            scene_id = sidecar.get("id") or sidecar.get("scene_id") or file_path.stem
            # Deduplicate scene_id if identical ID has different hash
            base_id = scene_id
            counter = 1
            while scene_id in existing_scene_ids:
                scene_id = f"{base_id}_{counter}"
                counter += 1

            # 5. Extract timestamp
            timestamp = sidecar.get("timestamp") or sidecar.get("acquisition_date") or sidecar.get("datetime")
            if not timestamp:
                # Try file modification time as fallback
                mtime = os.path.getmtime(file_path)
                timestamp = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

            # 6. Extract AOI / Bounding box
            aoi = sidecar.get("aoi")
            if not aoi and "bbox" in sidecar:
                b = sidecar["bbox"]
                if len(b) == 4:
                    aoi = {"min_lon": b[0], "min_lat": b[1], "max_lon": b[2], "max_lat": b[3]}
            elif not aoi and img_meta["bbox"]:
                b = img_meta["bbox"]
                aoi = {"min_lon": b[0], "min_lat": b[1], "max_lon": b[2], "max_lat": b[3]}
            elif not aoi:
                # Default empty geographic footprint placeholder
                aoi = {"min_lon": 0.0, "min_lat": 0.0, "max_lon": 0.0, "max_lat": 0.0}

            # 7. Assemble standardized staged record
            scene_record = {
                "scene_id": scene_id,
                "source": sidecar.get("source", "LOCAL_STAGED_OFFLINE"),
                "sensor": sidecar.get("sensor", default_sensor),
                "platform": sidecar.get("platform", "Sentinel-2"),
                "acquisition_timestamp": timestamp,
                "aoi": aoi,
                "bands": sidecar.get("bands", img_meta["bands"]),
                "band_count": img_meta["band_count"],
                "crs": sidecar.get("crs", img_meta["crs"]),
                "resolution_m": sidecar.get("resolution_m", img_meta["resolution_m"]),
                "dimensions": {
                    "width": img_meta["width"],
                    "height": img_meta["height"],
                },
                "file_path": str(file_path),
                "relative_path": os.path.relpath(file_path, config.PROJECT_ROOT).replace("\\", "/"),
                "file_size_bytes": file_path.stat().st_size,
                "checksum_sha256": sha,
                "cloud_cover_percentage": sidecar.get("cloud_cover_percentage", 0.0),
                "provenance": {
                    "ingestion_timestamp": datetime.now(timezone.utc).isoformat(),
                    "ingestion_agent": "TerraLens Local Staging Engine v1.0",
                    "status": "STAGED_OFFLINE_VERIFIED",
                },
            }

            manifest["scenes"].append(scene_record)
            existing_checksums.add(sha)
            existing_scene_ids.add(scene_id)
            staged_count += 1

        manifest["total_scenes"] = len(manifest["scenes"])
        manifest["last_updated"] = datetime.now(timezone.utc).isoformat()

        # Write manifest deterministically
        with open(self.manifest_path, "w", encoding="utf-8") as f:
            json.dump(manifest, f, indent=2, sort_keys=True)

        return {
            "status": "SUCCESS",
            "source_dir": str(source_dir),
            "manifest_path": str(self.manifest_path),
            "total_scanned": len(discovered_files),
            "newly_staged": staged_count,
            "skipped_duplicates": skipped_duplicates,
            "corrupted_skipped": corrupted_count,
            "cumulative_staged_scenes": manifest["total_scenes"],
        }
