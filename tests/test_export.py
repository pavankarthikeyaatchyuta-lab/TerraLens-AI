"""Unit tests for evidence package serialization and markdown report generation."""

import json
from terralens.app.models.evidence import Evidence, ProvenanceTrace, ProvenanceStep
from terralens.app.models.change import ChangeRegion, ChangeDetectionResult
from terralens.app.utils.export_utils import export_evidence_json, export_evidence_markdown


def test_export_evidence_json():
    """Verifies valid JSON serialization of an evidence record."""
    trace = ProvenanceTrace(
        trace_id="TR_1234",
        created_at="2026-09-30T12:00:00Z",
        query="urban expansion near river",
        location_id="LOC_TEST",
        steps=[
            ProvenanceStep(step_name="QUERY", timestamp="2026-09-30T12:00:00Z", status="COMPLETED")
        ],
    )

    ev = Evidence(
        evidence_id="EVID_TEST_1234",
        location_id="LOC_TEST",
        location_name="Test Location",
        coordinates="17.4483° N, 78.3742° E",
        sensor="Sentinel-2 MSI",
        before_date="2023-03-15",
        after_date="2025-02-20",
        source="prototype_dataset",
        change_type="Detected Change",
        change_confidence=0.82,
        changed_pixels=1500,
        total_pixels=65536,
        change_ratio=0.0229,
        detected_regions_count=2,
        quality_score=0.75,
        warnings=["Low contrast warning"],
        provenance=trace,
        analyst_decision="CONFIRMED_GROUND_CHANGE",
        analyst_notes="Verified new road construction.",
    )

    json_str = export_evidence_json(ev)
    assert isinstance(json_str, str)
    data = json.loads(json_str)
    assert data["evidence_id"] == "EVID_TEST_1234"
    assert data["change_confidence"] == 0.82
    assert data["analyst_decision"] == "CONFIRMED_GROUND_CHANGE"


def test_export_evidence_markdown():
    """Verifies that generated markdown report includes all required sections and data."""
    trace = ProvenanceTrace(
        trace_id="TR_5678",
        created_at="2026-09-30T12:00:00Z",
        query="reservoir water drying",
        location_id="LOC_WATER",
        steps=[
            ProvenanceStep(step_name="QUERY", timestamp="2026-09-30T12:00:00Z", status="COMPLETED"),
            ProvenanceStep(step_name="TEMPORAL_CHANGE_DETECTION", timestamp="2026-09-30T12:00:01Z", status="COMPLETED"),
        ],
    )

    ev = Evidence(
        evidence_id="EVID_WATER_5678",
        location_id="LOC_WATER",
        location_name="Godavari Reservoir",
        coordinates="18.9647° N, 78.3283° E",
        sensor="Sentinel-2 MSI",
        before_date="2023-01-10",
        after_date="2025-01-25",
        source="prototype_dataset",
        change_type="Detected Change",
        change_confidence=0.78,
        changed_pixels=4200,
        total_pixels=65536,
        change_ratio=0.0641,
        detected_regions_count=1,
        quality_score=0.80,
        warnings=[],
        provenance=trace,
        analyst_decision="CONFIRMED_GROUND_CHANGE",
        analyst_notes="Severe shoreline retreat observed.",
    )

    cr = ChangeDetectionResult(
        status="CHANGE_DETECTED",
        change_type="Detected Change",
        changed_pixels=4200,
        total_pixels=65536,
        change_ratio=0.0641,
        change_regions=[
            ChangeRegion(
                region_id=1,
                x=30,
                y=40,
                width=50,
                height=60,
                area_pixels=4200,
                relative_area=0.0641,
                centroid=(55.0, 70.0),
            )
        ],
        confidence_score=0.78,
        quality_score=0.80,
    )

    md_str = export_evidence_markdown(ev, cr)
    assert "# TERRALENS AI" in md_str
    assert "EVID_WATER_5678" in md_str
    assert "Godavari Reservoir" in md_str
    assert "78.0%" in md_str
    assert "Region #1" in md_str
    assert "CONFIRMED_GROUND_CHANGE" in md_str
    assert "Severe shoreline retreat observed." in md_str
    assert "TEMPORAL_CHANGE_DETECTION" in md_str
