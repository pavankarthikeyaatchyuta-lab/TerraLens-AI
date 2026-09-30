"""Provenance service for tracking intelligence lineage and assembling audit evidence."""

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from terralens.app.models.evidence import Evidence, ProvenanceTrace, ProvenanceStep
from terralens.app.models.location import Location
from terralens.app.models.scene import Scene
from terralens.app.utils.geo_utils import format_coordinates


class ProvenanceService:
    """Constructs auditable provenance traces and packages analyst evidence."""

    def __init__(self):
        # In-memory store for session evidence dossiers
        self._evidence_store: Dict[str, Evidence] = {}

    def create_evidence_dossier(
        self,
        location: Location,
        before_scene: Optional[Scene] = None,
        after_scene: Optional[Scene] = None,
        query: Optional[str] = None,
        retrieval_method: str = "Semantic Vector Search",
        embedding_model: Optional[str] = "CLIP baseline",
        index_name: Optional[str] = "satellite_embeddings.index",
        similarity_score: Optional[float] = None,
    ) -> Evidence:
        """Assembles a formal evidence packet for a given location and search context."""
        trace_id = str(uuid.uuid4())[:8]
        now_iso = datetime.now(timezone.utc).isoformat()

        # Build chronological audit steps
        is_semantic = "semantic" in retrieval_method.lower() or "vector" in retrieval_method.lower()

        steps = [
            ProvenanceStep(
                step_name="QUERY",
                timestamp=now_iso,
                status="COMPLETED" if query else "SKIPPED",
                details={"query_text": query or "Direct catalog navigation"},
            ),
        ]

        if is_semantic and query:
            steps.extend([
                ProvenanceStep(
                    step_name="EMBEDDING",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={
                        "model": embedding_model or "CLIP baseline",
                        "modality": "Text Query to 512-dim Normalized Vector",
                    },
                ),
                ProvenanceStep(
                    step_name="VECTOR_SEARCH",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={
                        "index": index_name or "satellite_embeddings.index",
                        "metric": "Cosine Similarity (FAISS IndexFlatIP)",
                        "similarity_score": similarity_score if similarity_score is not None else "N/A",
                    },
                ),
            ])

        steps.extend([
            ProvenanceStep(
                step_name="RETRIEVED_LOCATION",
                timestamp=now_iso,
                status="COMPLETED",
                details={
                    "location_id": location.location_id,
                    "name": location.name,
                    "coordinates": f"{location.latitude}, {location.longitude}",
                    "method": retrieval_method,
                },
            ),
            ProvenanceStep(
                step_name="SOURCE_IMAGES",
                timestamp=now_iso,
                status="COMPLETED" if (before_scene and after_scene) else "PARTIAL",
                details={
                    "before_scene_id": before_scene.scene_id if before_scene else "None",
                    "after_scene_id": after_scene.scene_id if after_scene else "None",
                    "sensor": location.primary_sensor,
                    "source": location.source,
                },
            ),
            ProvenanceStep(
                step_name="PREPROCESSING",
                timestamp=now_iso,
                status="COMPLETED",
                details={"alignment": "Identity/Dimension Check", "normalization": "Pending Phase 3"},
            ),
            ProvenanceStep(
                step_name="TEMPORAL_COMPARISON",
                timestamp=now_iso,
                status="PENDING_MODEL",
                details={"model": "Scheduled for Phase 3", "change_mask": "Not generated"},
            ),
            ProvenanceStep(
                step_name="CONFIDENCE_EVALUATION",
                timestamp=now_iso,
                status="NOT_CALCULATED",
                details={"score": None, "note": "Change confidence deferred to Phase 3"},
            ),
            ProvenanceStep(
                step_name="ANALYST_DECISION",
                timestamp=now_iso,
                status="PENDING_REVIEW",
                details={"analyst": "Human Reviewer", "decision": "Pending"},
            ),
        ])

        trace = ProvenanceTrace(
            trace_id=trace_id,
            created_at=now_iso,
            query=query,
            location_id=location.location_id,
            steps=steps,
        )

        evidence = Evidence(
            evidence_id=f"EVID_{location.location_id}_{trace_id}",
            location_id=location.location_id,
            location_name=location.name,
            coordinates=format_coordinates(location.latitude, location.longitude),
            sensor=location.primary_sensor,
            before_date=before_scene.acquisition_date if before_scene else "Unknown",
            after_date=after_scene.acquisition_date if after_scene else "Unknown",
            source=location.source,
            processing_status="STAGED_FOR_ANALYST",
            retrieval_method=retrieval_method,
            embedding_model=embedding_model,
            index_name=index_name,
            similarity_score=similarity_score,
            change_type=None,
            change_confidence=None,
            change_mask_path=None,
            provenance=trace,
            analyst_decision="PENDING_REVIEW",
            analyst_notes="",
        )

        self._evidence_store[evidence.evidence_id] = evidence
        return evidence

    def update_analyst_decision(
        self,
        evidence_id: str,
        decision: str,
        notes: str
    ) -> Optional[Evidence]:
        """Updates analyst adjudication and commentary on the evidence dossier."""
        evidence = self._evidence_store.get(evidence_id)
        if evidence:
            evidence.analyst_decision = decision
            evidence.analyst_notes = notes
            if evidence.provenance:
                evidence.provenance.steps.append(
                    ProvenanceStep(
                        step_name="ANALYST_ADJUDICATION",
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        status="COMPLETED",
                        details={"decision": decision, "notes": notes},
                    )
                )
        return evidence
