"""Tests for provenance trace construction and analyst evidence dossier."""

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.provenance_service import ProvenanceService


def test_provenance_dossier_creation():
    """Verify evidence packet is constructed with complete audit steps."""
    meta_service = MetadataService()
    provenance_service = ProvenanceService()

    loc = meta_service.get_location_by_id("LOC_001_HYDERABAD_URBAN")
    before_scene = meta_service.get_scene_by_id(loc.before_scene_id)
    after_scene = meta_service.get_scene_by_id(loc.after_scene_id)

    evidence = provenance_service.create_evidence_dossier(
        location=loc,
        before_scene=before_scene,
        after_scene=after_scene,
        query="new buildings near a river"
    )

    assert evidence.evidence_id.startswith("EVID_LOC_001_HYDERABAD_URBAN_")
    assert evidence.coordinates is not None
    assert evidence.change_type is None
    assert evidence.change_confidence is None

    # Verify audit steps sequence
    step_names = [s.step_name for s in evidence.provenance.steps]
    expected_steps = [
        "QUERY",
        "RETRIEVED_LOCATION",
        "SOURCE_IMAGES",
        "PREPROCESSING",
        "TEMPORAL_COMPARISON",
        "CONFIDENCE_EVALUATION",
        "ANALYST_DECISION",
    ]
    for step in expected_steps:
        assert step in step_names


def test_analyst_decision_update():
    """Verify human analyst adjudication updates the evidence and appends to audit trace."""
    meta_service = MetadataService()
    provenance_service = ProvenanceService()

    loc = meta_service.get_location_by_id("LOC_002_GODAVARI_RESERVOIR")
    evidence = provenance_service.create_evidence_dossier(location=loc)

    updated = provenance_service.update_analyst_decision(
        evidence_id=evidence.evidence_id,
        decision="CONFIRMED_GROUND_CHANGE",
        notes="Reservoir water extent dropped significantly between 2023 and 2025 baseline."
    )

    assert updated is not None
    assert updated.analyst_decision == "CONFIRMED_GROUND_CHANGE"
    assert "Reservoir water" in updated.analyst_notes

    # Verify that adjudication was logged into provenance steps
    step_names = [s.step_name for s in updated.provenance.steps]
    assert "ANALYST_ADJUDICATION" in step_names
