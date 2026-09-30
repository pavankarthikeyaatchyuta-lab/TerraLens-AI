"""End-to-end integration test covering the entire user journey in TerraLens AI.

Workflow:
1. Natural language query
2. Semantic vector retrieval (CLIP baseline + FAISS IndexFlatIP)
3. Location selection
4. Similar location discovery
5. Temporal scene pair selection
6. Image quality check & spatial alignment
7. Multi-temporal change detection & false-alarm filtering
8. Measurable confidence calculation
9. Artifact persistence (Mask, Difference Heatmap, Overlay)
10. Evidence dossier generation
11. Human-in-the-loop analyst adjudication
12. Auditable provenance verification
13. Operational report export (JSON & Markdown)
"""

import os
from pathlib import Path
from PIL import Image

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.index_service import IndexService
from terralens.app.services.embedding_service import get_embedding_model
from terralens.app.services.retrieval_service import SemanticEmbeddingRetrievalService
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.services.provenance_service import ProvenanceService
from terralens.app.utils.export_utils import export_evidence_json, export_evidence_markdown


def test_complete_end_to_end_user_journey(tmp_path):
    """Executes the full 13-stage TerraLens intelligence lifecycle and verifies every component."""
    # Step 1: Initialize services
    meta_service = MetadataService()
    data_service = DatasetService(metadata_service=meta_service)
    index_service = IndexService()
    embed_model = get_embedding_model()

    retrieval_service = SemanticEmbeddingRetrievalService(
        metadata_service=meta_service,
        dataset_service=data_service,
        index_service=index_service,
        embedding_model=embed_model,
    )
    temporal_service = TemporalAnalysisService(metadata_service=meta_service, dataset_service=data_service)
    prov_service = ProvenanceService()

    # Step 2: Natural Language Query & Semantic Retrieval
    query_text = "urban expansion and new construction near river"
    candidates = retrieval_service.search(query=query_text, top_k=3)
    assert len(candidates) > 0

    top_candidate = candidates[0]
    assert top_candidate.location is not None
    assert top_candidate.similarity_score is not None

    # Step 3: Location Selection
    selected_loc = top_candidate.location
    assert selected_loc.location_id is not None
    assert selected_loc.name is not None

    # Step 4: Similar Location Discovery
    similar_locs = retrieval_service.find_similar_locations(
        target_location_id=selected_loc.location_id,
        top_k=2
    )
    assert len(similar_locs) > 0
    # Similar locations must not include target itself
    assert all(c.location.location_id != selected_loc.location_id for c in similar_locs)

    # Step 5: Temporal Scene Selection & Pairing
    pair = temporal_service.load_temporal_pair(selected_loc)
    assert pair.is_complete is True
    assert pair.before_image is not None
    assert pair.after_image is not None
    assert pair.before_scene is not None
    assert pair.after_scene is not None

    # Step 6 & 7: Quality Assessment, Alignment, and Change Detection
    change_res = temporal_service.analyze_pair(
        pair=pair,
        difference_threshold=30,
        min_region_size_pixels=25,
    )

    # Step 8: Change Metrics and Analytical Confidence Verification
    assert change_res.status in ["CHANGE_DETECTED", "NO_SIGNIFICANT_CHANGE"]
    assert change_res.total_pixels > 0
    assert change_res.confidence_score is not None
    assert 0.05 <= change_res.confidence_score <= 0.98
    assert "signal_strength" in change_res.confidence_breakdown
    assert "spatial_coherence" in change_res.confidence_breakdown

    # Step 9: Artifact Persistence
    assert change_res.change_mask_path is not None
    assert os.path.exists(change_res.change_mask_path)
    assert change_res.difference_image_path is not None
    assert os.path.exists(change_res.difference_image_path)
    assert change_res.overlay_image_path is not None
    assert os.path.exists(change_res.overlay_image_path)

    # Step 10: Evidence Dossier Generation
    evidence = prov_service.create_evidence_dossier(
        location=selected_loc,
        before_scene=pair.before_scene,
        after_scene=pair.after_scene,
        query=query_text,
        retrieval_method="Semantic Vector Search",
        embedding_model="CLIP baseline",
        similarity_score=top_candidate.similarity_score,
        change_result=change_res,
    )

    assert evidence.evidence_id.startswith(f"EVID_{selected_loc.location_id}")
    assert evidence.processing_status == "ANALYZED_READY_FOR_REVIEW"
    assert evidence.change_confidence == change_res.confidence_score
    assert evidence.changed_pixels == change_res.changed_pixels

    # Step 11: Human Analyst Adjudication
    prov_service.update_analyst_decision(
        evidence_id=evidence.evidence_id,
        decision="CONFIRMED_GROUND_CHANGE",
        notes="Automated change verified: peri-urban building expansion confirmed."
    )
    assert evidence.analyst_decision == "CONFIRMED_GROUND_CHANGE"
    assert "peri-urban building expansion confirmed" in evidence.analyst_notes

    # Step 12: Provenance Trace Audit
    assert evidence.provenance is not None
    assert len(evidence.provenance.steps) >= 8
    step_names = [s.step_name for s in evidence.provenance.steps]
    expected_order = [
        "QUERY",
        "EMBEDDING",
        "VECTOR_SEARCH",
        "RETRIEVED_LOCATION",
        "SOURCE_IMAGES",
        "PREPROCESSING_ALIGNMENT",
        "TEMPORAL_CHANGE_DETECTION",
        "FALSE_ALARM_FILTERING",
        "CONFIDENCE_EVALUATION",
        "ANALYST_ADJUDICATION",
    ]
    for expected in expected_order:
        assert expected in step_names

    # Step 13: Operational Export (JSON & Markdown)
    json_export = export_evidence_json(evidence)
    assert len(json_export) > 50
    assert "CONFIRMED_GROUND_CHANGE" in json_export

    md_export = export_evidence_markdown(evidence, change_res)
    assert len(md_export) > 100
    assert "# TERRALENS AI" in md_export
    assert evidence.evidence_id in md_export
    assert "CONFIRMED_GROUND_CHANGE" in md_export
