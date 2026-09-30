"""TerraLens AI - Main Streamlit Application Entrypoint.

Smart India Hackathon 2026 - Problem Statement SIH26227
"Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery"
"""

import logging
import sys
from pathlib import Path
import streamlit as st

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from terralens.app.utils.config import config
from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.retrieval_service import PrototypeMetadataRetrievalService
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.services.provenance_service import ProvenanceService

from terralens.app.components.sidebar import render_sidebar
from terralens.app.components.search import render_search_panel
from terralens.app.components.map_view import render_map_view
from terralens.app.components.temporal_view import render_temporal_view
from terralens.app.components.evidence_panel import render_evidence_panel

# Configure Logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("terralens.main")

# Page Configuration
st.set_page_config(
    page_title="TerraLens AI | Satellite Intelligence",
    page_icon="🛰️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Professional CSS Injection
st.markdown(
    """
    <style>
        /* General Theme Adjustments */
        .stApp {
            background-color: #0b0f19;
            color: #e2e8f0;
        }
        
        /* Headers */
        h1, h2, h3, h4 {
            color: #f8fafc !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-weight: 600;
        }
        
        /* Card aesthetics */
        div[data-testid="stMetricValue"] {
            font-size: 1.35rem !important;
            color: #38bdf8 !important;
        }
        
        /* Buttons */
        .stButton > button {
            border-radius: 6px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        /* Badges and pills */
        .tag-pill {
            display: inline-block;
            background: #1e293b;
            color: #94a3b8;
            border: 1px solid #334155;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            margin-right: 4px;
        }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_resource
def initialize_services():
    """Initializes and caches backend services."""
    logger.info("Initializing TerraLens core services...")
    meta_service = MetadataService()
    data_service = DatasetService(metadata_service=meta_service)
    retrieval_service = PrototypeMetadataRetrievalService(metadata_service=meta_service)
    temporal_service = TemporalAnalysisService(metadata_service=meta_service, dataset_service=data_service)
    provenance_service = ProvenanceService()

    return meta_service, data_service, retrieval_service, temporal_service, provenance_service


def main():
    meta_service, data_service, retrieval_service, temporal_service, provenance_service = initialize_services()

    # Get dataset summary
    dataset_summary = data_service.get_dataset_summary()
    all_locations = meta_service.get_all_locations()

    # Session State defaults
    if "selected_location_id" not in st.session_state:
        st.session_state.selected_location_id = all_locations[0].location_id if all_locations else None
    if "active_query" not in st.session_state:
        st.session_state.active_query = ""

    # Current selected location
    selected_loc = meta_service.get_location_by_id(st.session_state.selected_location_id) if st.session_state.selected_location_id else None

    # Render Sidebar
    active_nav = render_sidebar(dataset_summary)

    # Top App Header
    header_col1, header_col2 = st.columns([4, 1])
    with header_col1:
        st.markdown(
            """
            <div style="display: flex; align-items: baseline; gap: 12px;">
                <h1 style="margin: 0; font-size: 2.1rem; font-weight: 800; letter-spacing: -0.5px;">
                    TerraLens <span style="color: #38bdf8;">AI</span>
                </h1>
                <div style="font-size: 1.05rem; color: #94a3b8; font-weight: 500;">
                    Semantic Satellite Intelligence
                </div>
                <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.12); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">
                    <span style="color: #38bdf8; font-size: 0.75rem;">●</span>
                    <span style="font-size: 0.72rem; font-weight: 600; color: #e2e8f0; letter-spacing: 0.5px;">LOCAL PROTOTYPE</span>
                </div>
            </div>
            <div style="font-size: 0.88rem; color: #64748b; margin-top: 2px;">
                Semantic Retrieval + Multi-Temporal Change Analysis (SIH-2026: PS SIH26227)
            </div>
            """,
            unsafe_allow_html=True,
        )

    with header_col2:
        if selected_loc:
            st.markdown(
                f"""
                <div style="text-align: right; background: #1e293b; padding: 6px 12px; border-radius: 6px; border: 1px solid #334155;">
                    <div style="font-size: 0.72rem; color: #94a3b8;">ACTIVE AOI</div>
                    <div style="font-size: 0.88rem; font-weight: 600; color: #38bdf8;">{selected_loc.location_id}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("<hr style='border: none; border-bottom: 1px solid #1e293b; margin: 12px 0 20px 0;'/>", unsafe_allow_html=True)

    # Dispatch to Active View
    if active_nav == "Search & Discovery":
        new_loc, query_text = render_search_panel(
            retrieval_service=retrieval_service,
            dataset_service=data_service,
            all_locations=all_locations,
            selected_location=selected_loc,
        )
        if new_loc and new_loc.location_id != st.session_state.selected_location_id:
            st.session_state.selected_location_id = new_loc.location_id
        if query_text:
            st.session_state.active_query = query_text

    elif active_nav == "Interactive Map":
        st.markdown("## Geospatial Intelligence Map")
        st.markdown(
            "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
            "Geographic distribution of monitored areas of interest (AOIs). Click any scene marker to inspect temporal baselines."
            "</p>",
            unsafe_allow_html=True,
        )

        clicked_id = render_map_view(
            locations=all_locations,
            selected_location=selected_loc,
            height=580,
        )

        if clicked_id and clicked_id != st.session_state.selected_location_id:
            st.session_state.selected_location_id = clicked_id
            st.success(f"Selected location updated from map: {clicked_id}")
            st.rerun()

        if selected_loc:
            c1, c2 = st.columns([1, 4])
            with c1:
                if st.button("📊 Open Temporal Comparison", type="primary", use_container_width=True):
                    st.session_state.active_nav = "Temporal Comparison"
                    st.rerun()
            with c2:
                st.caption(f"Currently active: **{selected_loc.name}** ({selected_loc.location_id})")

    elif active_nav == "Temporal Comparison":
        render_temporal_view(
            location=selected_loc,
            temporal_service=temporal_service,
        )

    elif active_nav == "Evidence & Lineage":
        render_evidence_panel(
            location=selected_loc,
            provenance_service=provenance_service,
            metadata_service=meta_service,
            active_query=st.session_state.active_query,
        )

    elif active_nav == "System Diagnostics":
        st.markdown("## System Diagnostics & Architecture Matrix")
        st.markdown(
            "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
            "Technical status, data layer integrity, and Phase 1 vs. Phase 2 roadmap alignment."
            "</p>",
            unsafe_allow_html=True,
        )

        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Locations", dataset_summary["total_locations"])
        with col2:
            st.metric("Total Scenes", dataset_summary["total_scenes"])
        with col3:
            st.metric("Disk Images Verified", dataset_summary["valid_scenes_on_disk"])
        with col4:
            st.metric("Missing Images", dataset_summary["missing_scenes_count"])

        st.markdown("---")
        st.markdown("### Architecture Pipeline Matrix")

        st.markdown(
            """
            | Pipeline Stage | Implementation Status | Technical Engine / Method | Phase |
            | :--- | :--- | :--- | :--- |
            | **UI & Dashboard** | **IMPLEMENTED** | Streamlit, Folium interactive mapping, HUD styling | Phase 1 |
            | **Data Schema & Catalog** | **IMPLEMENTED** | Pydantic strict schemas (`Scene`, `Location`, `Evidence`) | Phase 1 |
            | **Archive Discovery** | **IMPLEMENTED** | `DatasetService` with integrity check and image loaders | Phase 1 |
            | **Search Engine** | **IMPLEMENTED (Prototype)** | `PrototypeMetadataRetrievalService` (Lexical & Filter) | Phase 1 |
            | **Temporal Inspection** | **IMPLEMENTED** | Side-by-side multi-temporal baseline vs monitoring display | Phase 1 |
            | **Lineage & Provenance** | **IMPLEMENTED** | End-to-end `ProvenanceTrace` & human analyst adjudication | Phase 1 |
            | **Vector Embeddings** | *PLANNED* | Multi-modal Remote Sensing CLIP (Vision-Language model) | Phase 2 |
            | **Semantic Indexing** | *PLANNED* | FAISS Indexing for sub-second nearest neighbor search | Phase 2 |
            | **Automated Change Detection** | *PLANNED* | Bi-Temporal Siamese UNet / ChangeFormer | Phase 2 |
            | **False-Alarm Mitigation** | *PLANNED* | Cloud/shadow masking + seasonal phenology filtering | Phase 2 |
            | **Raster Change Masking** | *PLANNED* | Pixel-level binary & categorical change heatmaps | Phase 2 |
            """
        )

        st.markdown("---")
        st.markdown("### Dataset Audit Details")
        st.json(dataset_summary)


if __name__ == "__main__":
    main()
