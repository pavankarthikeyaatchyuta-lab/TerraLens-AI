"""Evidence panel component for intelligence verification, audit lineage, and analyst adjudication."""

from typing import Optional
import streamlit as st

from terralens.app.models.location import Location
from terralens.app.models.scene import Scene
from terralens.app.services.provenance_service import ProvenanceService
from terralens.app.services.metadata_service import MetadataService


def render_evidence_panel(
    location: Optional[Location],
    provenance_service: ProvenanceService,
    metadata_service: MetadataService,
    active_query: Optional[str] = None
) -> None:
    """Renders the intelligence verification evidence dossier and lineage trace."""
    st.markdown("## Evidence & Intelligence Verification")
    st.markdown(
        "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
        "Auditable chain of custody, sensor provenance, and human-in-the-loop analyst adjudication."
        "</p>",
        unsafe_allow_html=True,
    )

    if not location:
        st.info("Please select a location from 'Search & Discovery' or 'Interactive Map' to assemble its evidence dossier.")
        return

    before_scene: Optional[Scene] = metadata_service.get_scene_by_id(location.before_scene_id) if location.before_scene_id else None
    after_scene: Optional[Scene] = metadata_service.get_scene_by_id(location.after_scene_id) if location.after_scene_id else None

    # Assemble or retrieve existing evidence record for session
    evidence = provenance_service.create_evidence_dossier(
        location=location,
        before_scene=before_scene,
        after_scene=after_scene,
        query=active_query,
    )

    # Dossier Metadata Matrix
    st.markdown(
        f"""
        <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid #334155; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 10px; margin-bottom: 12px;">
                <span style="font-weight: 700; color: #f8fafc; font-size: 1.05rem;">Dossier ID: {evidence.evidence_id}</span>
                <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; border: 1px solid rgba(56, 189, 248, 0.3);">
                    STATUS: {evidence.processing_status}
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; font-size: 0.85rem;">
                <div><span style="color: #94a3b8;">Location:</span> <b style="color: #f1f5f9;">{evidence.location_name}</b></div>
                <div><span style="color: #94a3b8;">Coordinates:</span> <b style="color: #f1f5f9;">{evidence.coordinates}</b></div>
                <div><span style="color: #94a3b8;">Sensor Family:</span> <b style="color: #f1f5f9;">{evidence.sensor}</b></div>
                <div><span style="color: #94a3b8;">Baseline Date:</span> <b style="color: #60a5fa;">{evidence.before_date}</b></div>
                <div><span style="color: #94a3b8;">Monitoring Date:</span> <b style="color: #f87171;">{evidence.after_date}</b></div>
                <div><span style="color: #94a3b8;">Data Archive:</span> <b style="color: #f1f5f9;">{evidence.source}</b></div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Change Detection Evidence Fields (Strictly honest "Not yet calculated" display)
    st.markdown("### Change Detection Metrics")
    m_col1, m_col2, m_col3 = st.columns(3)

    with m_col1:
        st.markdown(
            """
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                <div style="font-size: 0.78rem; color: #94a3b8;">Change Classification</div>
                <div style="font-size: 1rem; font-weight: 600; color: #94a3b8; margin-top: 4px;">
                    Not yet calculated
                </div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Phase 2 Deep Semantic Classifier</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with m_col2:
        st.markdown(
            """
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                <div style="font-size: 0.78rem; color: #94a3b8;">Statistical Confidence</div>
                <div style="font-size: 1rem; font-weight: 600; color: #94a3b8; margin-top: 4px;">
                    Not yet calculated
                </div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Requires Bi-Temporal Model Inference</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with m_col3:
        st.markdown(
            """
            <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                <div style="font-size: 0.78rem; color: #94a3b8;">Raster Change Mask</div>
                <div style="font-size: 1rem; font-weight: 600; color: #94a3b8; margin-top: 4px;">
                    Not yet calculated
                </div>
                <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Pending Segmentation Mask Pipeline</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    st.markdown("---")

    # End-to-End Lineage & Provenance Flow
    st.markdown("### Provenance & Chain of Custody")
    st.markdown(
        "<p style='color: #94a3b8; font-size: 0.85rem; margin-top: -6px;'>"
        "The complete execution lineage guaranteeing full reproducibility and zero black-box drift."
        "</p>",
        unsafe_allow_html=True,
    )

    if evidence.provenance and evidence.provenance.steps:
        for idx, step in enumerate(evidence.provenance.steps):
            status_color = "#4ade80" if step.status == "COMPLETED" else ("#38bdf8" if step.status == "PARTIAL" else "#94a3b8")
            details_str = ", ".join(f"<b>{k}</b>: {v}" for k, v in step.details.items())
            st.markdown(
                f"""
                <div style="display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start;">
                    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 0.78rem; color: #e2e8f0; font-weight: 700; flex-shrink: 0;">
                        {idx + 1}
                    </div>
                    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 6px; padding: 8px 14px; width: 100%;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-weight: 600; font-size: 0.88rem; color: #f1f5f9;">{step.step_name}</span>
                            <span style="font-size: 0.75rem; color: {status_color}; font-weight: 600;">{step.status}</span>
                        </div>
                        <div style="font-size: 0.8rem; color: #cbd5e1; margin-top: 4px;">
                            {details_str}
                        </div>
                        <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">
                            UTC: {step.timestamp}
                        </div>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("---")

    # Analyst Review & Adjudication Form
    st.markdown("### Analyst Adjudication & Notes")
    st.caption("Record human analyst verification to provide ground-truth feedback.")

    adjudication_col1, adjudication_col2 = st.columns([1, 2])

    with adjudication_col1:
        decision_options = [
            "PENDING_REVIEW",
            "CONFIRMED_GROUND_CHANGE",
            "FALSE_ALARM (Phenology/Seasonal)",
            "FALSE_ALARM (Cloud/Shadow)",
            "ESCALATE_FOR_FURTHER_SURVEILLANCE",
        ]
        current_decision = st.selectbox(
            "Adjudication Decision",
            options=decision_options,
            index=0
        )

    with adjudication_col2:
        analyst_notes = st.text_area(
            "Operational Remarks & Technical Findings",
            placeholder="Record observed infrastructure, environmental impact, or false-alarm rationale...",
            height=100
        )

    if st.button("💾 Save Analyst Adjudication", type="primary"):
        provenance_service.update_analyst_decision(
            evidence_id=evidence.evidence_id,
            decision=current_decision,
            notes=analyst_notes
        )
        st.success(f"Adjudication recorded for Dossier {evidence.evidence_id}. Audit trail updated.")
