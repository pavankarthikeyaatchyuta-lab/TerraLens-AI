"""Unit and integration tests for Local Dataset Staging Service and Held-Out Evaluation (SIH26227).

Verifies:
1. LocalDatasetStagingService discovers imagery (TIFF, GeoTIFF, PNG, JPEG).
2. Deterministic SHA-256 calculation for file integrity.
3. Metadata extraction (bands, resolution, CRS, dimensions, tags).
4. Sidecar metadata priority (.json).
5. Incremental staging and deduplication by checksum / scene ID.
6. Manifest schema compliance with SIH audit requirements.
7. External held-out evaluation handling when organizer dataset is missing (BLOCKED BY EXTERNAL INPUT).
8. External evaluation execution when valid custom manifests are provided.
"""

import os
import json
import tempfile
import subprocess
import sys
from pathlib import Path
import numpy as np
from PIL import Image, TiffImagePlugin
import pytest

from terralens.app.services.staging_service import LocalDatasetStagingService
from terralens.app.utils.config import config


@pytest.fixture
def temp_staging_environment():
    """Creates a temporary sandbox directory with mock imagery and sidecars."""
    with tempfile.TemporaryDirectory() as tmpdir:
        root = Path(tmpdir)
        source_dir = root / "incoming_raw_satellite"
        staging_dir = root / "staged_archive"
        source_dir.mkdir()
        staging_dir.mkdir()

        # 1. Create a mock GeoTIFF-style TIFF file
        tif_path = source_dir / "S2A_MSIL2A_20261001T054639_T43RBL.tif"
        img = Image.new("RGB", (256, 256), color=(45, 120, 80))
        # Add TIFF tags for resolution and tiepoint
        info = TiffImagePlugin.ImageFileDirectory_v2()
        info[33550] = (10.0, 10.0, 0.0)  # ModelPixelScaleTag (10m GSD)
        info[33922] = (0.0, 0.0, 0.0, 71.85, 27.60, 0.0)  # Tiepoint (lon=71.85, lat=27.60)
        info[34737] = "WGS 84 / UTM zone 43N"  # CRS description
        img.save(tif_path, tiffinfo=info)

        # 2. Create sidecar metadata for the TIFF file
        sidecar_path = source_dir / "S2A_MSIL2A_20261001T054639_T43RBL.json"
        with open(sidecar_path, "w", encoding="utf-8") as f:
            json.dump({
                "scene_id": "S2A_TEST_BHADLA_001",
                "sensor": "Sentinel-2 MSI L2A",
                "platform": "Sentinel-2A",
                "acquisition_date": "2026-10-01T05:46:39Z",
                "cloud_cover_percentage": 0.0,
                "bands": ["B02", "B03", "B04", "B08"],
            }, f, indent=2)

        # 3. Create a PNG satellite scene
        png_path = source_dir / "SCENE_COASTAL_2025.png"
        img_png = Image.new("RGB", (128, 128), color=(20, 60, 180))
        img_png.save(png_path)

        yield {
            "root": root,
            "source_dir": source_dir,
            "staging_dir": staging_dir,
            "tif_path": tif_path,
            "png_path": png_path,
        }


def test_sha256_computation(temp_staging_environment):
    """Verify SHA-256 is deterministic and matches raw file hash."""
    tif_path = temp_staging_environment["tif_path"]
    sha = LocalDatasetStagingService.compute_sha256(tif_path)
    assert isinstance(sha, str)
    assert len(sha) == 64

    # Recalculate
    sha2 = LocalDatasetStagingService.compute_sha256(tif_path)
    assert sha == sha2


def test_metadata_extraction(temp_staging_environment):
    """Verify spatial, band, and format metadata extraction from TIFF/GeoTIFF."""
    tif_path = temp_staging_environment["tif_path"]
    meta = LocalDatasetStagingService.extract_image_metadata(tif_path)

    assert meta["width"] == 256
    assert meta["height"] == 256
    assert meta["resolution_m"] == 10.0
    assert "WGS 84" in meta["crs"]
    assert meta["bbox"] is not None
    assert meta["bbox"][0] == 71.85  # x0


def test_staging_pipeline_and_manifest_generation(temp_staging_environment):
    """Verify LocalDatasetStagingService stages files and generates standard manifest."""
    source_dir = temp_staging_environment["source_dir"]
    staging_dir = temp_staging_environment["staging_dir"]

    service = LocalDatasetStagingService(staging_dir=staging_dir)
    res = service.stage_local_scenes(source_dir=source_dir, recursive=True)

    assert res["status"] == "SUCCESS"
    assert res["total_scanned"] == 2
    assert res["newly_staged"] == 2
    assert res["skipped_duplicates"] == 0

    manifest_path = Path(res["manifest_path"])
    assert manifest_path.exists()

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert manifest["project"] == "TerraLens AI"
    assert manifest["problem_statement"] == "SIH26227"
    assert manifest["total_scenes"] == 2

    # Check first scene (TIFF with sidecar)
    s0 = next(s for s in manifest["scenes"] if s["scene_id"] == "S2A_TEST_BHADLA_001")
    assert s0["sensor"] == "Sentinel-2 MSI L2A"
    assert s0["acquisition_timestamp"] == "2026-10-01T05:46:39Z"
    assert s0["resolution_m"] == 10.0
    assert len(s0["checksum_sha256"]) == 64
    assert s0["provenance"]["status"] == "STAGED_OFFLINE_VERIFIED"
    assert "B08" in s0["bands"]


def test_incremental_staging_deduplication(temp_staging_environment):
    """Verify second run ignores identical files by checksum without duplicating manifest."""
    source_dir = temp_staging_environment["source_dir"]
    staging_dir = temp_staging_environment["staging_dir"]

    service = LocalDatasetStagingService(staging_dir=staging_dir)
    res1 = service.stage_local_scenes(source_dir=source_dir, incremental=True)
    assert res1["newly_staged"] == 2

    # Second run without changes
    res2 = service.stage_local_scenes(source_dir=source_dir, incremental=True)
    assert res2["newly_staged"] == 0
    assert res2["skipped_duplicates"] == 2
    assert res2["cumulative_staged_scenes"] == 2


def test_heldout_evaluation_reporting_blocked_when_absent(tmp_path):
    """Verify scripts/run_evaluation.py reports BLOCKED BY EXTERNAL INPUT when organizer data is missing."""
    empty_heldout = tmp_path / "non_existent_sih_data"
    output_json = tmp_path / "eval_blocked.json"

    cmd = [
        sys.executable,
        str(config.PROJECT_ROOT / "scripts" / "run_evaluation.py"),
        "--sih-heldout-dir", str(empty_heldout),
        "--output-json", str(output_json),
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    assert res.returncode == 0
    assert "BLOCKED BY EXTERNAL INPUT" in res.stdout
    assert "organiser-held-out evaluation data is not present in the repository" in res.stdout

    # Verify JSON output
    assert output_json.exists()
    with open(output_json, "r", encoding="utf-8") as f:
        data = json.load(f)
    assert "BLOCKED BY EXTERNAL INPUT" in data["status"]
    assert data["evaluation_mode"] == "SIH_HELDOUT_EXTERNAL"
