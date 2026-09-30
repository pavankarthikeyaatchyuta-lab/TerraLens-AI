"""Unit and integration tests for Phase 3 multi-temporal change detection and false-alarm reduction."""

import os
from pathlib import Path
import numpy as np
import pytest
from PIL import Image

from terralens.app.models.scene import Scene
from terralens.app.models.location import Location
from terralens.app.models.change import ChangeRegion, ChangeDetectionResult
from terralens.app.services.alignment_service import ImageAlignmentService
from terralens.app.services.change_detector import DeterministicBiTemporalChangeDetector
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.provenance_service import ProvenanceService


def test_alignment_service_spatial_check():
    """Verifies image alignment dimensions validation and dimension normalization."""
    aligner = ImageAlignmentService()

    img1 = Image.new("RGB", (256, 256), color=(100, 100, 100))
    img2 = Image.new("RGB", (256, 256), color=(120, 120, 120))
    img3 = Image.new("RGB", (512, 512), color=(120, 120, 120))

    is_aligned1, msg1, meta1 = aligner.check_alignment(img1, img2)
    assert is_aligned1 is True
    assert meta1["exact_dimension_match"] is True
    assert meta1["before_shape"] == (256, 256)
    assert meta1["after_shape"] == (256, 256)

    is_aligned2, msg2, meta2 = aligner.check_alignment(img1, img3)
    assert is_aligned2 is False
    assert meta2["exact_dimension_match"] is False

    # Normalize dimensions via align
    b_arr, a_arr, op, norm_meta = aligner.align(img1, img3)
    assert b_arr.shape[:2] == (256, 256)
    assert a_arr.shape[:2] == (256, 256)
    assert "normalized" in op.lower()


def test_no_change_scenario(tmp_path):
    """Verifies that two identical images produce NO_SIGNIFICANT_CHANGE."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(tmp_path))

    # Create uniform image
    img = Image.new("RGB", (100, 100), color=(80, 120, 80))

    result = detector.detect(
        before_image=img,
        after_image=img,
        location_id="TEST_NO_CHANGE",
        before_date="2024-01-01",
        after_date="2025-01-01",
        difference_threshold=30,
        min_region_size_pixels=20,
    )

    assert result.status == "NO_SIGNIFICANT_CHANGE"
    assert result.changed_pixels == 0
    assert result.change_ratio == 0.0
    assert len(result.change_regions) == 0
    assert result.confidence_score is not None
    assert result.confidence_score <= 0.25


def test_synthetic_known_change(tmp_path):
    """Verifies detection of a known synthetic change block."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(tmp_path))

    # Base image: smooth terrain gradient with spatial continuity
    y, x = np.mgrid[0:120, 0:120]
    base_channel = (50 + 0.3 * x + 0.3 * y).astype(np.uint8)
    arr_before = np.stack([base_channel, base_channel, base_channel], axis=-1)
    arr_after = arr_before.copy()

    # Introduce a 40x40 distinct bright structural block (1600 pixels) at (20, 20) to (60, 60)
    arr_after[20:60, 20:60, :] = 230

    img_before = Image.fromarray(arr_before)
    img_after = Image.fromarray(arr_after)

    result = detector.detect(
        before_image=img_before,
        after_image=img_after,
        location_id="TEST_SYNTHETIC",
        before_date="2024-01-01",
        after_date="2025-01-01",
        difference_threshold=30,
        min_region_size_pixels=25,
    )

    assert result.status == "CHANGE_DETECTED"
    assert result.total_pixels == 120 * 120
    # Expected area is roughly 1600 pixels (accounting for morphological edge effects)
    assert 1400 <= result.changed_pixels <= 1700
    assert len(result.change_regions) >= 1

    # First region should be around the synthetic block
    r0 = result.change_regions[0]
    assert 15 <= r0.x <= 25
    assert 15 <= r0.y <= 25
    assert 35 <= r0.width <= 45
    assert 35 <= r0.height <= 45
    assert 35 <= r0.centroid[0] <= 45
    assert 35 <= r0.centroid[1] <= 45


def test_morphological_noise_suppression(tmp_path):
    """Verifies that isolated pixel noise (salt-and-pepper) is rejected by false-alarm reduction."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(tmp_path))

    arr_before = np.full((100, 100, 3), 80, dtype=np.uint8)
    arr_after = arr_before.copy()

    # Add 10 isolated single-pixel changes
    np.random.seed(42)
    for _ in range(10):
        rx, ry = np.random.randint(5, 95, size=2)
        arr_after[ry, rx, :] = 250

    img_before = Image.fromarray(arr_before)
    img_after = Image.fromarray(arr_after)

    result = detector.detect(
        before_image=img_before,
        after_image=img_after,
        location_id="TEST_NOISE",
        before_date="2024-01-01",
        after_date="2025-01-01",
        difference_threshold=30,
        min_region_size_pixels=20,
    )

    # Isolated noise pixels must be rejected
    assert result.status == "NO_SIGNIFICANT_CHANGE"
    assert result.changed_pixels == 0
    assert len(result.change_regions) == 0


def test_honest_confidence_calculation(tmp_path):
    """Verifies honest confidence breakdown and bounded score formulation."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(tmp_path))

    arr_before = np.full((100, 100, 3), 50, dtype=np.uint8)
    arr_after = arr_before.copy()
    arr_after[30:70, 30:70, :] = 200

    result = detector.detect(
        before_image=Image.fromarray(arr_before),
        after_image=Image.fromarray(arr_after),
        location_id="TEST_CONF",
        before_date="2024-01-01",
        after_date="2025-01-01",
        before_sensor="Sentinel-2 MSI",
        after_sensor="Sentinel-2 MSI",
    )

    bd = result.confidence_breakdown
    assert "signal_strength" in bd
    assert "spatial_coherence" in bd
    assert "quality_score" in bd
    assert "sensor_mismatch_penalty" in bd

    # Confidence must be properly bounded
    assert 0.05 <= result.confidence_score <= 0.98
    # With large clean coherent block, confidence should be high (> 0.60)
    assert result.confidence_score >= 0.60


def test_cross_sensor_warning(tmp_path):
    """Verifies that sensor mismatch generates an explicit false-alarm advisory warning."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(tmp_path))

    arr_before = np.full((80, 80, 3), 60, dtype=np.uint8)
    arr_after = arr_before.copy()
    arr_after[20:50, 20:50, :] = 210

    result = detector.detect(
        before_image=Image.fromarray(arr_before),
        after_image=Image.fromarray(arr_after),
        location_id="TEST_CROSS_SENSOR",
        before_date="2024-01-01",
        after_date="2025-01-01",
        before_sensor="Sentinel-2 MSI",
        after_sensor="PlanetScope Dove",
    )

    assert any("Cross-sensor comparison" in w for w in result.warnings)
    assert result.confidence_breakdown["sensor_mismatch_penalty"] == 0.15


def test_artifact_persistence(tmp_path):
    """Verifies that change mask, difference heatmap, and overlay PNG files are persisted."""
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(tmp_path))

    arr_before = np.full((80, 80, 3), 70, dtype=np.uint8)
    arr_after = arr_before.copy()
    arr_after[15:45, 15:45, :] = 220

    result = detector.detect(
        before_image=Image.fromarray(arr_before),
        after_image=Image.fromarray(arr_after),
        location_id="LOC_ARTIFACT_TEST",
        before_date="2024",
        after_date="2025",
    )

    assert result.change_mask_path is not None
    assert os.path.exists(result.change_mask_path)
    assert result.difference_image_path is not None
    assert os.path.exists(result.difference_image_path)
    assert result.overlay_image_path is not None
    assert os.path.exists(result.overlay_image_path)

    # Verify they can be opened as valid images
    with Image.open(result.change_mask_path) as m_img:
        assert m_img.size == (80, 80)
    with Image.open(result.difference_image_path) as d_img:
        assert d_img.size == (80, 80)
    with Image.open(result.overlay_image_path) as o_img:
        assert o_img.size == (80, 80)


def test_temporal_service_analyze_pair_integration():
    """Tests end-to-end integration of TemporalAnalysisService.analyze_pair on real benchmark dataset."""
    meta_service = MetadataService()
    data_service = DatasetService(metadata_service=meta_service)
    temporal_service = TemporalAnalysisService(metadata_service=meta_service, dataset_service=data_service)

    locations = meta_service.get_all_locations()
    assert len(locations) > 0

    # Pick the first location (e.g. LOC_001_URBAN_EXPANSION)
    loc = locations[0]
    pair = temporal_service.load_temporal_pair(loc)
    assert pair.is_complete is True

    result = temporal_service.analyze_pair(pair=pair)

    assert isinstance(result, ChangeDetectionResult)
    assert result.status in ["CHANGE_DETECTED", "NO_SIGNIFICANT_CHANGE"]
    assert result.total_pixels > 0
    assert result.confidence_score is not None
    assert result.change_mask_path is not None
    assert Path(result.change_mask_path).exists()


def test_provenance_integration_with_change_result():
    """Verifies that ProvenanceService creates an enriched dossier when provided a ChangeDetectionResult."""
    prov_service = ProvenanceService()
    meta_service = MetadataService()

    loc = meta_service.get_all_locations()[0]
    before_scene = meta_service.get_scene_by_id(loc.before_scene_id)
    after_scene = meta_service.get_scene_by_id(loc.after_scene_id)

    dummy_result = ChangeDetectionResult(
        status="CHANGE_DETECTED",
        change_type="Detected Change",
        detector_name="DeterministicBiTemporalChangeDetector",
        detector_label="Deterministic Bi-Temporal Baseline",
        changed_pixels=1540,
        total_pixels=65536,
        change_ratio=0.0235,
        change_regions=[
            ChangeRegion(
                region_id=1,
                x=50,
                y=60,
                width=30,
                height=35,
                area_pixels=1050,
                relative_area=0.016,
                centroid=(65.0, 77.5),
            )
        ],
        confidence_score=0.84,
        confidence_breakdown={"signal_strength": 0.85, "spatial_coherence": 0.88, "quality_score": 0.75, "sensor_mismatch_penalty": 0.0},
        quality_score=0.75,
        change_mask_path="data/outputs/change_masks/test_mask.png",
        difference_image_path="data/outputs/change_masks/test_diff.png",
        overlay_image_path="data/outputs/change_masks/test_overlay.png",
        preprocessing_steps=["Spatial dimension check", "Illumination calibration"],
        warnings=[],
    )

    evidence = prov_service.create_evidence_dossier(
        location=loc,
        before_scene=before_scene,
        after_scene=after_scene,
        query="new construction",
        retrieval_method="Semantic Vector Search",
        change_result=dummy_result,
    )

    assert evidence.processing_status == "ANALYZED_READY_FOR_REVIEW"
    assert evidence.change_type == "Detected Change"
    assert evidence.change_confidence == 0.84
    assert evidence.changed_pixels == 1540
    assert evidence.change_ratio == 0.0235
    assert evidence.detected_regions_count == 1
    assert evidence.change_mask_path == "data/outputs/change_masks/test_mask.png"

    # Verify audit steps in provenance trace
    step_names = [s.step_name for s in evidence.provenance.steps]
    assert "PREPROCESSING_ALIGNMENT" in step_names
    assert "TEMPORAL_CHANGE_DETECTION" in step_names
    assert "FALSE_ALARM_FILTERING" in step_names
    assert "CONFIDENCE_EVALUATION" in step_names
