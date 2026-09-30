"""Temporal analysis and multi-temporal image comparison component."""

from typing import Optional
import streamlit as st

from terralens.app.models.location import Location
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.components.image_viewer import display_satellite_image
from terralens.app.utils.geo_utils import format_coordinates


def render_temporal_view(
    location: Optional[Location],
    temporal_service: TemporalAnalysisService
) -> None:
    """Renders the side-by-side multi-temporal satellite comparison interface."""
    st.markdown("## Multi-Temporal Satellite Comparison")

    if not location:
        st.info("Please select a location from 'Search & Discovery' or the 'Interactive Map' to perform temporal comparison.")
        return

    # Location Overview Card
    st.markdown(
        f"""
        <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                <div>
                    <h3 style="margin: 0; font-size: 1.2rem; color: #f8fafc;">{location.name}</h3>
                    <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;">{location.description}</div>
                </div>
                <div style="background: #0f172a; padding: 4px 10px; border-radius: 4px; border: 1px solid #1e293b; font-size: 0.8rem; font-family: monospace; color: #38bdf8;">
                    {location.location_id}
                </div>
            </div>
            <div style="display: flex; gap: 24px; margin-top: 12px; font-size: 0.85rem; color: #cbd5e1; flex-wrap: wrap;">
                <div>📍 <b>Coordinates:</b> {format_coordinates(location.latitude, location.longitude)}</div>
                <div>🛰️ <b>Sensor:</b> {location.primary_sensor}</div>
                <div>📅 <b>Dates:</b> {', '.join(location.available_dates)}</div>
                <div>📦 <b>Source:</b> {location.source}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    # Load Temporal Pair
    pair = temporal_service.load_temporal_pair(location)

    if not pair.is_complete:
        st.warning(
            f"Temporal imagery pair is incomplete for {location.location_id}. "
            f"Before image: {'Found' if pair.before_image else 'Missing'}, "
            f"After image: {'Found' if pair.after_image else 'Missing'}."
        )

    # Side-by-side Temporal Viewer
    col_before, col_after = st.columns(2)

    with col_before:
        before_date = pair.before_scene.acquisition_date if pair.before_scene else "Date Unavailable"
        platform_before = pair.before_scene.platform if pair.before_scene else "Sensor"
        cloud_before = f"{pair.before_scene.cloud_percentage}% cloud" if (pair.before_scene and pair.before_scene.cloud_percentage is not None) else "Clear"

        st.markdown(
            f"""
            <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none; display: flex; justify-content: space-between;">
                <span style="font-weight: 600; color: #60a5fa;">◀ BASELINE (BEFORE)</span>
                <span style="font-size: 0.85rem; color: #94a3b8;">{before_date} | {platform_before} ({cloud_before})</span>
            </div>
            """,
            unsafe_allow_html=True
        )
        display_satellite_image(
            pair.before_path,
            caption=f"Baseline Acquisition: {before_date}"
        )

    with col_after:
        after_date = pair.after_scene.acquisition_date if pair.after_scene else "Date Unavailable"
        platform_after = pair.after_scene.platform if pair.after_scene else "Sensor"
        cloud_after = f"{pair.after_scene.cloud_percentage}% cloud" if (pair.after_scene and pair.after_scene.cloud_percentage is not None) else "Clear"

        st.markdown(
            f"""
            <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none; display: flex; justify-content: space-between;">
                <span style="font-weight: 600; color: #f87171;">MONITORING (AFTER) ▶</span>
                <span style="font-size: 0.85rem; color: #94a3b8;">{after_date} | {platform_after} ({cloud_after})</span>
            </div>
            """,
            unsafe_allow_html=True
        )
        display_satellite_image(
            pair.after_path,
            caption=f"Monitoring Acquisition: {after_date}"
        )

    st.markdown("---")

    # Temporal Engine Inspection & Honest Status
    st.markdown("### Change Detection Diagnostics")
    d_col1, d_col2 = st.columns([2, 1])

    with d_col1:
        st.markdown(
            """
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid #334155; border-radius: 6px; padding: 14px;">
                <div style="font-size: 0.9rem; font-weight: 600; color: #e2e8f0; margin-bottom: 6px;">
                    Multi-Temporal Processing Pipeline Architecture:
                </div>
                <div style="font-size: 0.82rem; color: #94a3b8; line-height: 1.6;">
                    1. <b>Spatial Alignment:</b> Resampling & Affine Transformation (Native Coordinate Check: OK)<br/>
                    2. <b>Radiometric Calibration:</b> Top-of-Atmosphere (TOA) & Surface Reflectance Normalization (Scheduled for Phase 2)<br/>
                    3. <b>Change Vector / Siamese Detection:</b> Bi-temporal difference mapping & cloud masking (Scheduled for Phase 2)<br/>
                    4. <b>False-Alarm Mitigation:</b> Seasonal phenology filtering & shadow rejection (Scheduled for Phase 2)
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

    with d_col2:
        change_eval = temporal_service.detect_change(pair.before_image, pair.after_image)
        st.metric(label="Change Detection Status", value=change_eval.status)
        st.caption(f"**Engine Note:** {change_eval.message}")

    # Action to compile evidence dossier
    st.markdown("---")
    c_btn1, c_btn2 = st.columns([1, 4])
    with c_btn1:
        if st.button("📋 Open Evidence Dossier", type="primary", use_container_width=True):
            st.session_state.active_nav = "Evidence & Lineage"
            st.rerun()
    with c_btn2:
        st.caption("Inspect audit lineage, sensor metadata provenance, and record analyst adjudication.")
