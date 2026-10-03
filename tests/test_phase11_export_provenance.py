"""Unit tests for Phase 11: Export & Provenance Suite (SIH26227).

Verifies:
A. Manifest generation & completeness
B. Provenance generation (structured auditable, no blockchain/crypto claims)
C. GeoJSON RFC 7946 validity and closed polygon rings
D. Cluster metadata preservation (cluster_id, classification, area, confidence, deltas)
E. T1/T2 metadata preservation (scene IDs, timestamps, sensor)
F. Scientific threshold preservation (mean + 1.8*std, clamped [0.15, 0.45], no Otsu)
G. Confidence semantics preservation (deterministic analytical score, not probability)
H. Analyst status preservation (decision, notes)
I. Export bundle completeness (manifest, provenance, analysis, geojson, readme)
J. Secret and token exclusion / URL sanitization
"""

import json
import os
import tempfile
import pytest

from terralens.app.models.evidence import Evidence, ProvenanceTrace, ProvenanceStep
from terralens.app.models.change import ChangeRegion, ChangeDetectionResult
from terralens.app.utils.export_utils import (
    generate_manifest,
    generate_provenance,
    generate_geojson,
    generate_analysis_json,
    assemble_export_bundle,
    sanitize_url,
)


@pytest.fixture
def sample_evidence():
    trace = ProvenanceTrace(
        trace_id="TR_PHASE11_1234",
        created_at="2026-10-03T18:00:00Z",
        query="industrial development and solar expansion",
        location_id="LOC_TEST_BHADLA",
        steps=[
            ProvenanceStep(step_name="VECTOR_RETRIEVAL", timestamp="2026-10-03T18:00:01Z", status="COMPLETED"),
            ProvenanceStep(step_name="SPATIAL_ALIGNMENT", timestamp="2026-10-03T18:00:02Z", status="COMPLETED"),
            ProvenanceStep(step_name="QUALITY_MASKING", timestamp="2026-10-03T18:00:03Z", status="COMPLETED"),
            ProvenanceStep(step_name="CHANGE_DETECTION", timestamp="2026-10-03T18:00:04Z", status="COMPLETED"),
        ],
    )

    return Evidence(
        evidence_id="EVID_PHASE11_BHADLA_001",
        location_id="LOC_TEST_BHADLA",
        location_name="Bhadla Solar Park",
        coordinates="27.5385° N, 71.9152° E",
        sensor="Sentinel-2 MSI",
        before_date="2023-04-05",
        after_date="2025-03-12",
        source="Copernicus Sentinel-2 L2A via Planetary Computer STAC",
        change_type="BUILT_UP_CONSTRUCTION",
        change_confidence=0.84,
        changed_pixels=4500,
        total_pixels=262144,
        change_ratio=0.0172,
        detected_regions_count=2,
        quality_score=0.92,
        warnings=[],
        provenance=trace,
        analyst_decision="CONFIRMED",
        analyst_notes="Verified new solar panel mounting structures and service roads.",
    )


@pytest.fixture
def sample_change_result():
    return ChangeDetectionResult(
        location_id="LOC_TEST_BHADLA",
        status="CHANGE_DETECTED",
        change_type="BUILT_UP_CONSTRUCTION",
        detector_name="sentinel2_bitemporal_engine",
        detector_label="Copernicus Sentinel-2 L2A Bi-Temporal Engine",
        changed_pixels=4500,
        total_pixels=262144,
        change_ratio=0.0172,
        change_regions=[
            ChangeRegion(
                region_id=1,
                x=120,
                y=140,
                width=50,
                height=60,
                area_pixels=3000,
                relative_area=0.0114,
                centroid=(27.5410, 71.9180),
            ),
            ChangeRegion(
                region_id=2,
                x=210,
                y=230,
                width=35,
                height=45,
                area_pixels=1500,
                relative_area=0.0057,
                centroid=(27.5360, 71.9120),
            ),
        ],
        confidence_score=0.84,
        confidence_breakdown={
            "signal_contrast": 0.35,
            "spatial_coherence": 0.29,
            "alignment_penalty": 0.0,
            "quality_penalty": 0.0,
        },
    )


def test_manifest_generation(sample_evidence, sample_change_result):
    """Test A: Manifest generation and completeness of required machine-readable fields."""
    manifest = generate_manifest(sample_evidence, sample_change_result)

    assert manifest["export_version"] == "1.1.0"
    assert manifest["problem_statement_id"] == "SIH26227"
    assert manifest["analysis_id"] == "EVID_PHASE11_BHADLA_001"
    assert manifest["location_id"] == "LOC_TEST_BHADLA"
    assert manifest["location_name"] == "Bhadla Solar Park"
    assert manifest["number_of_detected_clusters"] == 2
    assert manifest["changed_pixel_count"] == 4500
    assert manifest["change_area"]["ha"] == 45.0
    assert manifest["change_area"]["m2"] == 450000
    assert manifest["analyst_status"] == "CONFIRMED"
    assert "manifest.json" in manifest["included_artifacts"]
    assert "provenance.json" in manifest["included_artifacts"]
    assert "change_clusters.geojson" in manifest["included_artifacts"]
    assert "README.md" in manifest["included_artifacts"]


def test_provenance_generation(sample_evidence, sample_change_result):
    """Test B: Structured auditable provenance generated without blockchain/crypto claims."""
    prov = generate_provenance(sample_evidence, sample_change_result)

    assert prov["provenance_id"] == "TR_PHASE11_1234"
    assert prov["lineage_standard"] == "TerraLens Structured Auditable Lineage"

    # Strictly verify NO claims of blockchain or cryptographic provenance
    prov_str = json.dumps(prov).lower()
    assert "blockchain" not in prov_str
    assert "cryptographic" not in prov_str

    # Verify input bands and processing documentation
    assert "B04" in prov["inputs"]["input_bands_used"]
    assert "B08" in prov["inputs"]["input_bands_used"]
    assert "SCL" in prov["inputs"]["input_bands_used"]
    assert len(prov["processing"]["scl_classes_suppressed"]) == 7
    assert 3 in prov["processing"]["scl_classes_suppressed"]  # Cloud shadows
    assert 8 in prov["processing"]["scl_classes_suppressed"]  # Medium cloud
    assert 9 in prov["processing"]["scl_classes_suppressed"]  # High cloud
    assert 10 in prov["processing"]["scl_classes_suppressed"]  # Cirrus
    assert 11 in prov["processing"]["scl_classes_suppressed"]  # Snow/ice


def test_geojson_validity(sample_evidence, sample_change_result):
    """Test C: GeoJSON FeatureCollection conforms to RFC 7946 with closed rings."""
    geojson = generate_geojson(sample_evidence, sample_change_result)

    assert geojson["type"] == "FeatureCollection"
    assert len(geojson["features"]) == 2

    for feature in geojson["features"]:
        assert feature["type"] == "Feature"
        geom = feature["geometry"]
        assert geom["type"] == "Polygon"
        ring = geom["coordinates"][0]
        assert len(ring) >= 4
        # Closed polygon check: first point == last point
        assert ring[0] == ring[-1]
        for lon, lat in ring:
            assert -180.0 <= lon <= 180.0
            assert -90.0 <= lat <= 90.0


def test_cluster_metadata_preservation(sample_evidence, sample_change_result):
    """Test D: Cluster attributes, classifications, areas, and confidence preserved."""
    geojson = generate_geojson(sample_evidence, sample_change_result)
    f0 = geojson["features"][0]
    props = f0["properties"]

    assert props["cluster_id"] == "CLUST_001"
    assert props["classification"] == "BUILT_UP_CONSTRUCTION"
    assert props["confidence"] == 0.84
    assert props["area_m2"] == 300000
    assert props["area_ha"] == 30.0
    assert props["analyst_decision"] == "CONFIRMED"
    assert "solar panel" in props["analyst_notes"]
    assert "delta_ndvi" in props
    assert "delta_red" in props


def test_t1_t2_metadata_preservation(sample_evidence, sample_change_result):
    """Test E: Multi-temporal scene IDs, acquisition dates, and sensor preserved."""
    manifest = generate_manifest(sample_evidence, sample_change_result)

    assert "2023-04-05" in manifest["t1_acquisition_timestamp"]
    assert "2025-03-12" in manifest["t2_acquisition_timestamp"]
    assert manifest["t1_sensor_platform"] == "Sentinel-2 MSI"
    assert manifest["t2_sensor_platform"] == "Sentinel-2 MSI"


def test_threshold_preservation(sample_evidence, sample_change_result):
    """Test F: Threshold invariant (mean + 1.8*std, clamped [0.15, 0.45]) preserved."""
    manifest = generate_manifest(sample_evidence, sample_change_result)
    th = manifest["threshold"]

    assert th["formula"] == "mean + 1.8 * std"
    assert th["clamp_range"] == [0.15, 0.45]
    assert 0.15 <= th["value"] <= 0.45
    # Strictly ensure NO Otsu thresholding
    assert "otsu" not in json.dumps(manifest).lower()


def test_confidence_semantics(sample_evidence, sample_change_result):
    """Test G: Confidence is an analytical score, not a calibrated probability."""
    manifest = generate_manifest(sample_evidence, sample_change_result)
    conf = manifest["confidence_summary"]

    assert conf["metric_type"] == "deterministic_heuristic_score_not_probability"
    assert 0.20 <= conf["mean_confidence"] <= 0.98

    analysis = generate_analysis_json(sample_evidence, sample_change_result)
    assert "NOT calibrated probabilities" in analysis["scientific_disclosure"]
    assert "lack manually labelled polygon ground truth" in analysis["scientific_disclosure"]


def test_analyst_status_preservation(sample_evidence, sample_change_result):
    """Test H: Analyst verdict and commentary preserved."""
    manifest = generate_manifest(sample_evidence, sample_change_result)
    prov = generate_provenance(sample_evidence, sample_change_result)

    assert manifest["analyst_status"] == "CONFIRMED"
    assert prov["analyst_actions"]["overall_status"] == "CONFIRMED"
    assert prov["analyst_actions"]["global_notes"] == "Verified new solar panel mounting structures and service roads."


def test_export_bundle_completeness(sample_evidence, sample_change_result):
    """Test I: Full export bundle contains all 5 required artifacts and optional zip packaging."""
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "test_bundle.zip")
        bundle = assemble_export_bundle(sample_evidence, sample_change_result, export_zip=True, zip_path=zip_path)

        assert "manifest" in bundle
        assert "provenance" in bundle
        assert "change_clusters_geojson" in bundle
        assert "analysis" in bundle
        assert "readme_md" in bundle
        assert os.path.exists(zip_path)
        assert os.path.getsize(zip_path) > 500

        import zipfile
        with zipfile.ZipFile(zip_path, "r") as zf:
            namelist = zf.namelist()
            assert "manifest.json" in namelist
            assert "provenance.json" in namelist
            assert "change_clusters.geojson" in namelist
            assert "analysis.json" in namelist
            assert "README.md" in namelist


def test_secret_exclusion_and_sanitization():
    """Test J: Security tokens, credentials, and SAS tokens sanitized from exports."""
    dirty_url = "https://planetarycomputer.microsoft.com/api/preview.png?item=S2A_TEST&token=SECRET_12345&sig=FORBIDDEN_HASH"
    cleaned = sanitize_url(dirty_url)

    assert "SECRET_12345" not in cleaned
    assert "FORBIDDEN_HASH" not in cleaned
    assert "item=S2A_TEST" in cleaned

    pure_url = "https://planetarycomputer.microsoft.com/api/preview.png"
    assert sanitize_url(pure_url) == pure_url
