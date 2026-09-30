"""Search component for querying satellite intelligence archives."""

from typing import List, Optional, Tuple
import streamlit as st
from PIL import Image

from terralens.app.models.location import Location
from terralens.app.services.retrieval_service import (
    BaseRetrievalService,
    RetrievalCandidate,
)
from terralens.app.services.dataset_service import DatasetService
from terralens.app.utils.geo_utils import format_coordinates
from terralens.app.utils.image_utils import generate_thumbnail


def render_search_panel(
    retrieval_service: BaseRetrievalService,
    dataset_service: DatasetService,
    all_locations: List[Location],
    selected_location: Optional[Location]
) -> Tuple[Optional[Location], Optional[str]]:
    """Renders the satellite intelligence search interface, filter bar, and ranked candidate cards."""
    st.markdown("## Search Satellite Intelligence")
    st.markdown(
        "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
        "Query candidate observation zones across multi-temporal satellite archives using semantic descriptions or reference imagery."
        "</p>",
        unsafe_allow_html=True,
    )

    # Search bar & Quick Prompts
    col_input, col_btn = st.columns([5, 1])
    with col_input:
        query_text = st.text_input(
            "Natural Language Satellite Query",
            placeholder="e.g. new buildings near a river, reservoir water retreat, forest clearing...",
            key="search_query_input",
            label_visibility="collapsed"
        )
    with col_btn:
        search_clicked = st.button("🔍 Search", type="primary", use_container_width=True)

    # Preset quick query chips
    st.markdown("<span style='font-size: 0.8rem; color: #64748b;'>Suggested queries:</span>", unsafe_allow_html=True)
    c1, c2, c3, c4, c5 = st.columns(5)
    with c1:
        if st.button("🏢 Urban Expansion", key="q1", use_container_width=True):
            query_text = "new buildings near a river"
            st.session_state.search_query_input = query_text
            st.rerun()
    with c2:
        if st.button("💧 Reservoir Retreat", key="q2", use_container_width=True):
            query_text = "reservoir water lake drought"
            st.session_state.search_query_input = query_text
            st.rerun()
    with c3:
        if st.button("🌲 Forest Corridor", key="q3", use_container_width=True):
            query_text = "forest clearance corridor road"
            st.session_state.search_query_input = query_text
            st.rerun()
    with c4:
        if st.button("🚢 Coastal Port", key="q4", use_container_width=True):
            query_text = "coastal port reclamation ocean"
            st.session_state.search_query_input = query_text
            st.rerun()
    with c5:
        if st.button("☀️ Solar Farm", key="q5", use_container_width=True):
            query_text = "solar energy panels desert"
            st.session_state.search_query_input = query_text
            st.rerun()

    # Search Filters & Reference Image
    with st.expander("🛠️ Advanced Search Filters & Reference Imagery", expanded=False):
        f_col1, f_col2, f_col3 = st.columns(3)
        with f_col1:
            sensor_options = ["All Sensors"] + sorted(list({l.primary_sensor for l in all_locations}))
            selected_sensor = st.selectbox("Sensor Family", options=sensor_options)

        with f_col2:
            all_tags = sorted(list({t for l in all_locations for t in l.tags}))
            tag_options = ["All Tags"] + all_tags
            selected_tag = st.selectbox("Thematic Category / Tag", options=tag_options)

        with f_col3:
            max_cloud = st.slider("Max Cloud Cover (%)", min_value=0, max_value=100, value=20)

        uploaded_ref_image = st.file_uploader(
            "Upload Reference Satellite Image (Feature Matching)",
            type=["png", "jpg", "jpeg", "tif", "tiff"],
            help="Stage a visual patch to discover structurally similar scenes across the archive."
        )

        ref_img_pil = None
        if uploaded_ref_image:
            ref_img_pil = Image.open(uploaded_ref_image)
            st.image(ref_img_pil, caption="Uploaded Reference Scene (Staged for Phase 2 Feature Matching)", width=200)
            st.info("ℹ️ Visual feature matching is scheduled for Phase 2 (FAISS/CLIP). Currently aligning via metadata and semantic attributes.")

    # Execute Search
    candidates = retrieval_service.search(
        query=query_text,
        reference_image=ref_img_pil,
        sensor_filter=selected_sensor if selected_sensor != "All Sensors" else None,
        tag_filter=selected_tag if selected_tag != "All Tags" else None,
        max_cloud=float(max_cloud)
    )

    st.markdown("---")

    # Header for results
    res_col1, res_col2 = st.columns([3, 1])
    with res_col1:
        st.markdown(f"### Candidate Locations ({len(candidates)})")
    with res_col2:
        st.markdown(
            "<div style='text-align: right; font-size: 0.82rem; color: #94a3b8; padding-top: 8px;'>"
            "Retrieval engine: <b>Prototype (Metadata & Lexical)</b>"
            "</div>",
            unsafe_allow_html=True
        )

    if not candidates:
        st.warning("No candidate locations match the selected search criteria and filters.")
        return selected_location, query_text

    # Render Cards
    new_selection = selected_location
    for cand in candidates:
        loc = cand.location
        is_current = selected_location and (selected_location.location_id == loc.location_id)
        border_color = "#38bdf8" if is_current else "#334155"
        bg_color = "rgba(56, 189, 248, 0.05)" if is_current else "rgba(30, 41, 59, 0.4)"

        paths = dataset_service.get_location_imagery_paths(loc)
        thumb_path = paths.get("after") or paths.get("before")

        with st.container():
            st.markdown(
                f"""
                <div style="border: 1px solid {border_color}; background: {bg_color}; border-radius: 8px; padding: 12px; margin-bottom: 12px;">
                </div>
                """,
                unsafe_allow_html=True,
            )
            c_thumb, c_info, c_action = st.columns([1.5, 4, 1.5])

            with c_thumb:
                if thumb_path and thumb_path.exists():
                    thumb = generate_thumbnail(thumb_path, max_size=(180, 180))
                    if thumb:
                        st.image(thumb, use_container_width=True)
                else:
                    st.caption("No thumbnail available")

            with c_info:
                st.markdown(f"**{loc.name}** `[{loc.location_id}]`")
                st.markdown(f"<span style='font-size: 0.85rem; color: #cbd5e1;'>{loc.description}</span>", unsafe_allow_html=True)
                st.markdown(
                    f"<div style='font-size: 0.8rem; color: #94a3b8; margin-top: 4px;'>"
                    f"📍 <b>Coords:</b> {format_coordinates(loc.latitude, loc.longitude)} | "
                    f"🛰️ <b>Sensor:</b> {loc.primary_sensor} | "
                    f"📅 <b>Temporal Coverage:</b> {', '.join(loc.available_dates)}"
                    f"</div>",
                    unsafe_allow_html=True
                )
                # Show honest match explanation
                st.markdown(
                    f"<div style='font-size: 0.78rem; color: #38bdf8; margin-top: 4px;'>"
                    f"<b>Match rationale:</b> {cand.match_reason}"
                    f"</div>",
                    unsafe_allow_html=True
                )

            with c_action:
                if is_current:
                    st.success("✓ Active Scene")
                else:
                    if st.button("Select Scene", key=f"sel_{loc.location_id}", use_container_width=True):
                        new_selection = loc
                        st.rerun()

                # Quick button to jump to temporal comparison
                if st.button("Compare Temporal", key=f"comp_{loc.location_id}", use_container_width=True):
                    new_selection = loc
                    st.session_state.active_nav = "Temporal Comparison"
                    st.rerun()

    return new_selection, query_text
