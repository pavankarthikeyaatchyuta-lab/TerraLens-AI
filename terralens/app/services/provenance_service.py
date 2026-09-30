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
        change_result: Optional[Any] = None,
    ) -> Evidence:
        """Assembles a formal evidence packet for a given location, search context, and optional change analysis."""
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
        ])

        if change_result and getattr(change_result, "status", None) not in ("NOT_IMPLEMENTED", "INCOMPLETE_DATA", None):
            # Phase 3 change detection pipeline steps
            steps.extend([
                ProvenanceStep(
                    step_name="PREPROCESSING_ALIGNMENT",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={
                        "steps": getattr(change_result, "preprocessing_steps", []),
                        "quality_score": getattr(change_result, "quality_score", None),
                    },
                ),
                ProvenanceStep(
                    step_name="TEMPORAL_CHANGE_DETECTION",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={
                        "detector": getattr(change_result, "detector_label", "Deterministic Bi-Temporal Baseline"),
                        "changed_pixels": getattr(change_result, "changed_pixels", 0),
                        "total_pixels": getattr(change_result, "total_pixels", 0),
                        "change_ratio_pct": f"{getattr(change_result, 'change_ratio', 0.0) * 100:.2f}%",
                    },
                ),
                ProvenanceStep(
                    step_name="FALSE_ALARM_FILTERING",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={
                        "morphological_filter": "Opening 3x3 + Closing 5x5",
                        "min_region_pixels": getattr(change_result, "diagnostics", {}).get("min_region_size_pixels", 25),
                        "retained_connected_regions": len(getattr(change_result, "change_regions", [])),
                        "warnings": getattr(change_result, "warnings", []),
                    },
                ),
                ProvenanceStep(
                    step_name="CONFIDENCE_EVALUATION",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={
                        "overall_confidence": getattr(change_result, "confidence_score", None),
                        "breakdown": getattr(change_result, "confidence_breakdown", {}),
                    },
                ),
            ])
        else:
            steps.extend([
                ProvenanceStep(
                    step_name="PREPROCESSING",
                    timestamp=now_iso,
                    status="COMPLETED",
                    details={"alignment": "Identity/Dimension Check", "normalization": "Pending Analysis"},
                ),
                ProvenanceStep(
                    step_name="TEMPORAL_COMPARISON",
                    timestamp=now_iso,
                    status="PENDING_ANALYSIS",
                    details={"model": "DeterministicBiTemporalChangeDetector ready to execute"},
                ),
                ProvenanceStep(
                    step_name="CONFIDENCE_EVALUATION",
                    timestamp=now_iso,
                    status="NOT_CALCULATED",
                    details={"score": None, "note": "Run temporal analysis to compute confidence"},
                ),
            ])

        steps.append(
            ProvenanceStep(
                step_name="ANALYST_DECISION",
                timestamp=now_iso,
                status="PENDING_REVIEW",
                details={"analyst": "Human Reviewer", "decision": "Pending"},
            )
        )

        trace = ProvenanceTrace(
            trace_id=trace_id,
            created_at=now_iso,
            query=query,
            location_id=location.location_id,
            steps=steps,
        )

        has_cr = change_result and getattr(change_result, "status", None) not in ("NOT_IMPLEMENTED", "INCOMPLETE_DATA", None)

        evidence = Evidence(
            evidence_id=f"EVID_{location.location_id}_{trace_id}",
            location_id=location.location_id,
            location_name=location.name,
            coordinates=format_coordinates(location.latitude, location.longitude),
            sensor=location.primary_sensor,
            before_date=before_scene.acquisition_date if before_scene else "Unknown",
            after_date=after_scene.acquisition_date if after_scene else "Unknown",
            source=location.source,
            processing_status="ANALYZED_READY_FOR_REVIEW" if has_cr else "STAGED_FOR_ANALYST",
            retrieval_method=retrieval_method,
            embedding_model=embedding_model,
            index_name=index_name,
            similarity_score=similarity_score,
            change_type=getattr(change_result, "change_type", None) if has_cr else None,
            change_confidence=getattr(change_result, "confidence_score", None) if has_cr else None,
            change_mask_path=getattr(change_result, "change_mask_path", None) if has_cr else None,
            difference_image_path=getattr(change_result, "difference_image_path", None) if has_cr else None,
            overlay_image_path=getattr(change_result, "overlay_image_path", None) if has_cr else None,
            changed_pixels=getattr(change_result, "changed_pixels", None) if has_cr else None,
            total_pixels=getattr(change_result, "total_pixels", None) if has_cr else None,
            change_ratio=getattr(change_result, "change_ratio", None) if has_cr else None,
            detected_regions_count=len(getattr(change_result, "change_regions", [])) if has_cr else None,
            quality_score=getattr(change_result, "quality_score", None) if has_cr else None,
            warnings=getattr(change_result, "warnings", []) if has_cr else [],
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
