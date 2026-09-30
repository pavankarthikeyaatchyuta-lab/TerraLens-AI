"""Temporal analysis and multi-temporal image comparison component."""

from typing import Optional, Dict
import streamlit as st
from PIL import Image

from terralens.app.models.location import Location
from terralens.app.models.change import ChangeDetectionResult
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.components.image_viewer import display_satellite_image
from terralens.app.utils.geo_utils import format_coordinates


def render_temporal_view(
    location: Optional[Location],
    temporal_service: TemporalAnalysisService,
    temporal_results: Optional[Dict[str, ChangeDetectionResult]] = None,
) -> None:
    """Renders the multi-temporal satellite comparison, change detection, and false-alarm filtering interface."""
    st.markdown("## Multi-Temporal Satellite Comparison & Change Detection")
    st.markdown(
        "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
        "Deterministic bi-temporal change detection, false-alarm reduction, and measurable confidence evaluation."
        "</p>",
        unsafe_allow_html=True,
    )

    if not location:
        st.info("Please select a location from 'Search & Discovery' or the 'Interactive Map' to perform temporal comparison.")
        return

    if temporal_results is None:
        if "temporal_results" not in st.session_state:
            st.session_state.temporal_results = {}
        temporal_results = st.session_state.temporal_results

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
        return

    # Detection & False-Alarm Reduction Controls
    with st.expander("⚙️ Change Detection & False-Alarm Filtering Parameters", expanded=False):
        c_param1, c_param2, c_param3 = st.columns(3)
        with c_param1:
            diff_thresh = st.slider(
                "Difference Threshold",
                min_value=10,
                max_value=90,
                value=30,
                step=2,
                help="Absolute radiometric luminance difference required to register a candidate change.",
            )
        with c_param2:
            min_region_px = st.slider(
                "Min Cluster Size (Pixels)",
                min_value=5,
                max_value=200,
                value=25,
                step=5,
                help="Morphological false-alarm filter: removes scattered isolated pixel noise smaller than this cluster size.",
            )
        with c_param3:
            overlay_alpha = st.slider(
                "Overlay Transparency",
                min_value=0.2,
                max_value=0.8,
                value=0.45,
                step=0.05,
                help="Alpha blending transparency for the change highlight layer over the monitoring scene.",
            )

    # Run Analysis Action Bar
    btn_col1, btn_col2 = st.columns([1, 3])
    with btn_col1:
        run_analysis = st.button("▶ Run Multi-Temporal Analysis", type="primary", use_container_width=True)

    with btn_col2:
        st.caption("Executes spatial alignment, radiometric illumination matching, morphological filtering, and measurable confidence scoring.")

    # Check or execute analysis
    active_result: Optional[ChangeDetectionResult] = temporal_results.get(location.location_id)

    if run_analysis:
        with st.spinner(f"Analyzing bi-temporal scenes for {location.name}..."):
            active_result = temporal_service.analyze_pair(
                pair=pair,
                difference_threshold=diff_thresh,
                min_region_size_pixels=min_region_px,
                overlay_alpha=overlay_alpha,
            )
            temporal_results[location.location_id] = active_result
            st.session_state.temporal_results = temporal_results
            st.success(f"Analysis completed: {active_result.status} ({active_result.changed_pixels:,} pixels changed)")

    # Visualization Mode Selector
    view_mode_options = ["Side-by-Side (Before & After)"]
    if active_result and active_result.status != "NOT_IMPLEMENTED":
        view_mode_options.extend([
            "Highlight Overlay (Detected Changes)",
            "Difference Heatmap",
            "Binary Change Mask",
        ])

    view_mode = st.radio(
        "Display Mode",
        options=view_mode_options,
        horizontal=True,
    )

    before_date = pair.before_scene.acquisition_date if pair.before_scene else "Date Unavailable"
    platform_before = pair.before_scene.platform if pair.before_scene else "Sensor"
    cloud_before = f"{pair.before_scene.cloud_percentage}% cloud" if (pair.before_scene and pair.before_scene.cloud_percentage is not None) else "Clear"

    after_date = pair.after_scene.acquisition_date if pair.after_scene else "Date Unavailable"
    platform_after = pair.after_scene.platform if pair.after_scene else "Sensor"
    cloud_after = f"{pair.after_scene.cloud_percentage}% cloud" if (pair.after_scene and pair.after_scene.cloud_percentage is not None) else "Clear"

    if view_mode == "Side-by-Side (Before & After)":
        col_before, col_after = st.columns(2)
        with col_before:
            st.markdown(
                f"""
                <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none; display: flex; justify-content: space-between;">
                    <span style="font-weight: 600; color: #60a5fa;">◀ BASELINE (BEFORE)</span>
                    <span style="font-size: 0.85rem; color: #94a3b8;">{before_date} | {platform_before} ({cloud_before})</span>
                </div>
                """,
                unsafe_allow_html=True
            )
            display_satellite_image(pair.before_path, caption=f"Baseline Acquisition: {before_date}")

        with col_after:
            st.markdown(
                f"""
                <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none; display: flex; justify-content: space-between;">
                    <span style="font-weight: 600; color: #f87171;">MONITORING (AFTER) ▶</span>
                    <span style="font-size: 0.85rem; color: #94a3b8;">{after_date} | {platform_after} ({cloud_after})</span>
                </div>
                """,
                unsafe_allow_html=True
            )
            display_satellite_image(pair.after_path, caption=f"Monitoring Acquisition: {after_date}")

    elif view_mode == "Highlight Overlay (Detected Changes)" and active_result and active_result.overlay_image_path:
        col_ov1, col_ov2 = st.columns([3, 1])
        with col_ov1:
            st.markdown(
                f"""
                <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none;">
                    <span style="font-weight: 600; color: #f59e0b;">🔍 CHANGE OVERLAY & BOUNDING BOXES</span>
                    <span style="font-size: 0.85rem; color: #94a3b8; margin-left: 12px;">Monitoring scene overlaid with filtered change clusters</span>
                </div>
                """,
                unsafe_allow_html=True
            )
            try:
                ov_img = Image.open(active_result.overlay_image_path)
                st.image(ov_img, use_container_width=True, caption=f"Overlay Map ({len(active_result.change_regions)} clusters identified)")
            except Exception as e:
                st.error(f"Could not load overlay image: {e}")
        with col_ov2:
            st.markdown("#### Overlay Legend")
            st.markdown(
                """
                - 🟥 **Red Highlighted Pixels:** Detected structural or surface changes exceeding radiometric threshold.
                - 🟩 **Green Bounding Boxes:** Contiguous change components passing morphological noise suppression.
                - 🎯 **Green Dot:** Centroid of each distinct change cluster.
                """
            )

    elif view_mode == "Difference Heatmap" and active_result and active_result.difference_image_path:
        st.markdown(
            f"""
            <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none;">
                <span style="font-weight: 600; color: #38bdf8;">🔥 RADIOMETRIC DIFFERENCE HEATMAP</span>
                <span style="font-size: 0.85rem; color: #94a3b8; margin-left: 12px;">Pixel-wise absolute difference magnitude normalized across color spectrum</span>
            </div>
            """,
            unsafe_allow_html=True
        )
        try:
            diff_img = Image.open(active_result.difference_image_path)
            st.image(diff_img, use_container_width=True, caption="Normalized Absolute Radiometric Difference")
        except Exception as e:
            st.error(f"Could not load difference heatmap: {e}")

    elif view_mode == "Binary Change Mask" and active_result and active_result.change_mask_path:
        st.markdown(
            f"""
            <div style="background: #1e293b; padding: 8px 12px; border-radius: 6px 6px 0 0; border: 1px solid #334155; border-bottom: none;">
                <span style="font-weight: 600; color: #4ade80;">⬛⬜ POST-FILTERED BINARY CHANGE MASK</span>
                <span style="font-size: 0.85rem; color: #94a3b8; margin-left: 12px;">Morphologically cleaned raster mask (White = Change, Black = Background)</span>
            </div>
            """,
            unsafe_allow_html=True
        )
        try:
            mask_img = Image.open(active_result.change_mask_path)
            st.image(mask_img, use_container_width=True, caption=f"Binary Mask ({active_result.changed_pixels:,} positive pixels)")
        except Exception as e:
            st.error(f"Could not load binary mask: {e}")

    st.markdown("---")

    # Change Detection Metrics Cards
    if active_result and active_result.status != "NOT_IMPLEMENTED":
        st.markdown("### Analysis Results & Honest Confidence Breakdown")
        st.caption("ℹ️ *Cloud / shadow mask not available for this scene — morphological noise suppression applied.*")

        m1, m2, m3, m4 = st.columns(4)
        status_color = "#4ade80" if active_result.status == "CHANGE_DETECTED" else "#94a3b8"

        with m1:
            st.markdown(
                f"""
                <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.78rem; color: #94a3b8;">Detection Verdict</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: {status_color}; margin-top: 4px;">
                        {active_result.status}
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">{active_result.detector_label}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        with m2:
            st.markdown(
                f"""
                <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.78rem; color: #94a3b8;">Changed Area Ratio</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: #38bdf8; margin-top: 4px;">
                        {active_result.change_ratio * 100:.2f}%
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">{active_result.changed_pixels:,} of {active_result.total_pixels:,} px</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        with m3:
            st.markdown(
                f"""
                <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.78rem; color: #94a3b8;">Detected Clusters</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: #f59e0b; margin-top: 4px;">
                        {len(active_result.change_regions)} Components
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Suppressed noise &lt; {active_result.diagnostics.get('min_region_size_pixels', 25)} px</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        with m4:
            conf_val = active_result.confidence_score or 0.0
            st.markdown(
                f"""
                <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 12px;">
                    <div style="font-size: 0.78rem; color: #94a3b8;">Measurable Confidence</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: #a855f7; margin-top: 4px;">
                        {conf_val * 100:.1f}%
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">Model-derived analytical score (not probability)</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        # False-Alarm Warnings
        if active_result.warnings:
            for w in active_result.warnings:
                st.warning(f"⚠️ **False-Alarm Advisory:** {w}")

        # Expandable Confidence Breakdown
        with st.expander("📊 Transparent Confidence Score Formulation", expanded=False):
            bd = active_result.confidence_breakdown
            c_f1, c_f2 = st.columns([1, 1])
            with c_f1:
                st.markdown(
                    f"""
                    **Defensible Formulation:**
                    ```
                    Confidence = 0.45 * SignalStrength 
                               + 0.35 * SpatialCoherence 
                               + 0.20 * QualityScore 
                               - CrossSensorPenalty
                    ```
                    - **Signal Contrast Strength:** `{bd.get('signal_strength', 0.0):.3f}`
                    - **Spatial Coherence (Cluster Ratio):** `{bd.get('spatial_coherence', 0.0):.3f}`
                    - **Image Quality / Dynamic Range:** `{bd.get('quality_score', 0.0):.3f}`
                    - **Cross-Sensor Mismatch Penalty:** `-{bd.get('sensor_mismatch_penalty', 0.0):.3f}`
                    - **Final Evaluated Confidence:** `{(active_result.confidence_score or 0.0):.3f}`
                    """
                )
            with c_f2:
                st.markdown(
                    """
                    > **Honesty Principle:** Rather than generating an uncalibrated deep-learning probability on a small benchmark dataset, TerraLens measures verifiable geometric and radiometric parameters to protect analysts against false alarms.
                    """
                )

        # Extracted Regions Breakdown
        if active_result.change_regions:
            with st.expander(f"🗺️ Extracted Discrete Change Regions ({len(active_result.change_regions)} components)", expanded=False):
                region_data = [
                    {
                        "Region ID": f"#{r.region_id}",
                        "Area (Pixels)": f"{r.area_pixels:,} px",
                        "Scene Fraction": f"{r.relative_area * 100:.2f}%",
                        "Centroid (X, Y)": f"({r.centroid[0]:.0f}, {r.centroid[1]:.0f})",
                        "Bounding Box (X, Y, W, H)": f"({r.x}, {r.y}, {r.width}x{r.height})",
                    }
                    for r in active_result.change_regions[:20]
                ]
                st.dataframe(region_data, use_container_width=True)

    else:
        # Pre-execution diagnostics overview
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
                        1. <b>Spatial Alignment:</b> Resampling & Affine Dimension Check<br/>
                        2. <b>Radiometric Illumination Calibration:</b> Mean matching & contrast dynamic range assessment<br/>
                        3. <b>Deterministic Difference Detector:</b> Luminance absolute difference calculation<br/>
                        4. <b>False-Alarm Mitigation:</b> Morphological opening/closing noise suppression & connected component filtering<br/>
                        5. <b>Measurable Confidence:</b> Signal strength, spatial coherence, and cross-sensor penalty computation
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        with d_col2:
            st.metric(label="Change Detection Status", value="READY_TO_RUN")
            st.caption("Click **▶ Run Multi-Temporal Analysis** above to execute the pipeline.")

    # Action to compile or navigate to evidence dossier
    st.markdown("---")
    c_btn1, c_btn2 = st.columns([1, 4])
    with c_btn1:
        if st.button("📋 Open Evidence Dossier", type="primary", use_container_width=True):
            st.session_state.active_nav = "Evidence & Lineage"
            st.rerun()
    with c_btn2:
        st.caption("Inspect audit lineage, sensor metadata provenance, and record analyst adjudication.")
