"""Search component for querying satellite intelligence archives via semantic retrieval."""

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
) -> Tuple[Optional[Location], Optional[str], Optional[float]]:
    """Renders the satellite intelligence search interface, filter bar, and ranked candidate cards."""
    st.markdown("## Search Satellite Intelligence")
    st.markdown(
        "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
        "Semantic cross-modal retrieval across multi-temporal satellite archives using natural language queries or reference imagery."
        "</p>",
        unsafe_allow_html=True,
    )

    # Check for "similar locations" mode
    is_similar_mode = st.session_state.get("similar_mode_target") is not None
    if is_similar_mode:
        target_id = st.session_state.similar_mode_target
        target_loc = next((l for l in all_locations if l.location_id == target_id), None)
        target_name = target_loc.name if target_loc else target_id

        st.info(f"🔎 **Similar Location Discovery Mode Active**: Finding visual & semantic matches for **{target_name}** (`{target_id}`).")
        if st.button("← Back to Standard Search", key="btn_exit_similar"):
            st.session_state.similar_mode_target = None
            st.rerun()

    # Search bar & Quick Prompts (only if not in similar mode)
    query_text = ""
    ref_img_pil = None

    if not is_similar_mode:
        col_input, col_btn = st.columns([5, 1])
        with col_input:
            query_text = st.text_input(
                "Natural Language Satellite Query",
                placeholder="e.g. new buildings near a river, reservoir water retreat, forest clearing...",
                key="search_query_input",
                label_visibility="collapsed"
            )
        with col_btn:
            st.button("🔍 Search", type="primary", use_container_width=True)

        # Preset quick query chips
        st.markdown("<span style='font-size: 0.8rem; color: #64748b;'>Suggested queries:</span>", unsafe_allow_html=True)
        c1, c2, c3, c4, c5 = st.columns(5)
        with c1:
            if st.button("🏢 Urban Expansion", key="q1", use_container_width=True):
                st.session_state.search_query_input = "new buildings near a river"
                st.rerun()
        with c2:
            if st.button("💧 Reservoir Retreat", key="q2", use_container_width=True):
                st.session_state.search_query_input = "reservoir water lake drought"
                st.rerun()
        with c3:
            if st.button("🌲 Forest Corridor", key="q3", use_container_width=True):
                st.session_state.search_query_input = "forest clearance corridor road"
                st.rerun()
        with c4:
            if st.button("🚢 Coastal Port", key="q4", use_container_width=True):
                st.session_state.search_query_input = "coastal port reclamation ocean"
                st.rerun()
        with c5:
            if st.button("☀️ Solar Farm", key="q5", use_container_width=True):
                st.session_state.search_query_input = "solar energy panels desert"
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
                "Upload Reference Satellite Image (Image-to-Image Search)",
                type=["png", "jpg", "jpeg", "tif", "tiff"],
                help="Stage a visual patch to discover structurally similar scenes across the archive."
            )

            if uploaded_ref_image:
                ref_img_pil = Image.open(uploaded_ref_image)
                st.image(ref_img_pil, caption="Uploaded Reference Scene (Activated for Vector Matching)", width=220)
                st.success("Image-to-image semantic retrieval active via CLIP vision encoder + FAISS IndexFlatIP.")

    # Execute Search or Similar Discovery
    if is_similar_mode:
        target_id = st.session_state.similar_mode_target
        candidates = retrieval_service.find_similar_locations(
            target_location_id=target_id,
            scene_type="after",
            top_k=5
        )
        engine_label = "Similar Location Discovery (Image Embedding + FAISS)"
    else:
        candidates = retrieval_service.search(
            query=query_text,
            reference_image=ref_img_pil,
            sensor_filter=selected_sensor if 'selected_sensor' in locals() and selected_sensor != "All Sensors" else None,
            tag_filter=selected_tag if 'selected_tag' in locals() and selected_tag != "All Tags" else None,
            max_cloud=float(max_cloud) if 'max_cloud' in locals() else None,
            top_k=5
        )
        engine_label = getattr(retrieval_service, "engine_name", "Retrieval Engine")

    st.markdown("---")

    # Header for results
    res_col1, res_col2 = st.columns([3, 2])
    with res_col1:
        title_prefix = "Similar Candidate Locations" if is_similar_mode else "Ranked Candidate Locations"
        st.markdown(f"### {title_prefix} ({len(candidates)})")
    with res_col2:
        st.markdown(
            f"<div style='text-align: right; font-size: 0.82rem; color: #94a3b8; padding-top: 8px;'>"
            f"Engine: <b>{engine_label}</b>"
            f"</div>",
            unsafe_allow_html=True
        )

    if not candidates:
        st.warning("No candidate locations match the selected search criteria and filters.")
        return selected_location, query_text, None

    # Render Candidate Cards
    new_selection = selected_location
    active_similarity = None

    for cand in candidates:
        loc = cand.location
        is_current = selected_location and (selected_location.location_id == loc.location_id)
        border_color = "#38bdf8" if is_current else "#334155"
        bg_color = "rgba(56, 189, 248, 0.05)" if is_current else "rgba(30, 41, 59, 0.4)"

        if is_current and cand.similarity_score is not None:
            active_similarity = cand.similarity_score

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
                # Title and Similarity Score Pill
                title_col, score_col = st.columns([3, 2])
                with title_col:
                    st.markdown(f"**{loc.name}** `[{loc.location_id}]`")
                with score_col:
                    if cand.similarity_score is not None:
                        st.markdown(
                            f"<div style='text-align: right;'>"
                            f"<span style='background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-weight: 600; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; border: 1px solid rgba(56, 189, 248, 0.3);'>"
                            f"{cand.similarity_label}: <b>{cand.similarity_score:.4f}</b>"
                            f"</span>"
                            f"</div>",
                            unsafe_allow_html=True
                        )

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
                st.caption("Embedding model: CLIP baseline (openai/clip-vit-base-patch32)")

            with c_action:
                if is_current:
                    st.success("✓ Active Scene")
                else:
                    if st.button("Select Scene", key=f"sel_{loc.location_id}", use_container_width=True):
                        new_selection = loc
                        st.rerun()

                # Find Similar Locations button
                if st.button("🔍 Find Similar", key=f"sim_{loc.location_id}", use_container_width=True):
                    st.session_state.similar_mode_target = loc.location_id
                    st.rerun()

                # Quick button to jump to temporal comparison
                if st.button("Compare Temporal", key=f"comp_{loc.location_id}", use_container_width=True):
                    new_selection = loc
                    st.session_state.active_nav = "Temporal Comparison"
                    st.rerun()

    return new_selection, query_text, active_similarity
