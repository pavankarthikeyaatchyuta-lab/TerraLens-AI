"""Provenance service for tracking intelligence lineage and assembling audit evidence."""

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict

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
    ) -> Evidence:
        """Assembles a formal evidence packet for a given location and search context."""
        trace_id = str(uuid.uuid4())[:8]
        now_iso = datetime.now(timezone.utc).isoformat()

        # Build chronological audit steps
        steps = [
            ProvenanceStep(
                step_name="QUERY",
                timestamp=now_iso,
                status="COMPLETED" if query else "SKIPPED",
                details={"query_text": query or "Direct catalog navigation"},
            ),
            ProvenanceStep(
                step_name="RETRIEVED_LOCATION",
                timestamp=now_iso,
                status="COMPLETED",
                details={
                    "location_id": location.location_id,
                    "name": location.name,
                    "coordinates": f"{location.latitude}, {location.longitude}",
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
                details={"alignment": "Identity/Dimension Check", "normalization": "Pending Phase 2"},
            ),
            ProvenanceStep(
                step_name="TEMPORAL_COMPARISON",
                timestamp=now_iso,
                status="PENDING_MODEL",
                details={"model": "Scheduled for Phase 2", "change_mask": "Not generated"},
            ),
            ProvenanceStep(
                step_name="CONFIDENCE_EVALUATION",
                timestamp=now_iso,
                status="NOT_CALCULATED",
                details={"score": None, "note": "No synthetic scores generated in Phase 1"},
            ),
            ProvenanceStep(
                step_name="ANALYST_DECISION",
                timestamp=now_iso,
                status="PENDING_REVIEW",
                details={"analyst": "Human Reviewer", "decision": "Pending"},
            ),
        ]

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
            change_type=None,  # Strictly None / Not yet calculated
            change_confidence=None,  # Strictly None / Not yet calculated
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
            # Append audit step to trace
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
