"""Sidebar component for TerraLens AI navigation and system status."""

import streamlit as st
from typing import Dict, Any
from terralens.app.utils.config import config


def render_sidebar(dataset_summary: Dict[str, Any]) -> str:
    """Renders the professional satellite intelligence sidebar."""
    with st.sidebar:
        # Brand & Status Header
        st.markdown(
            """
            <div style="border-bottom: 1px solid #2d3748; padding-bottom: 12px; margin-bottom: 16px;">
                <h2 style="margin: 0; font-size: 1.45rem; font-weight: 700; letter-spacing: -0.5px; color: #f8fafc;">
                    🛰️ TerraLens <span style="color: #38bdf8;">AI</span>
                </h2>
                <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 2px;">
                    Semantic Satellite Intelligence
                </div>
                <div style="margin-top: 8px; display: inline-flex; align-items: center; gap: 6px; background: rgba(56, 189, 248, 0.12); padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">
                    <span style="color: #38bdf8; font-size: 0.75rem;">●</span>
                    <span style="font-size: 0.72rem; font-weight: 600; color: #e2e8f0; letter-spacing: 0.5px;">LOCAL PROTOTYPE</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.caption(f"**Dataset:** {config.DATASET_LABEL}")

        # Primary Navigation
        st.markdown("### Navigation")
        nav_options = [
            "Search & Discovery",
            "Interactive Map",
            "Temporal Comparison",
            "Evidence & Lineage",
            "System Diagnostics",
        ]

        # Use session state for navigation
        if "active_nav" not in st.session_state:
            st.session_state.active_nav = nav_options[0]

        selected_nav = st.radio(
            "Select Module",
            options=nav_options,
            index=nav_options.index(st.session_state.active_nav) if st.session_state.active_nav in nav_options else 0,
            label_visibility="collapsed"
        )
        st.session_state.active_nav = selected_nav

        st.markdown("---")

        # System Architecture & Status Matrix (Honest, accurate state)
        st.markdown("### System Status")

        # Dataset Status
        if dataset_summary["status"] == "Healthy":
            st.markdown(
                f"""
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 0.8rem; color: #94a3b8;">Dataset Status</div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: #4ade80;">
                        ● Loaded ({dataset_summary['total_locations']} Locations, {dataset_summary['total_scenes']} Scenes)
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                f"""
                <div style="margin-bottom: 8px;">
                    <div style="font-size: 0.8rem; color: #94a3b8;">Dataset Status</div>
                    <div style="font-size: 0.85rem; font-weight: 600; color: #f87171;">
                        ▲ {dataset_summary['status']} ({dataset_summary['missing_scenes_count']} missing)
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        # Semantic Embedding Index (Phase 2 honest status)
        st.markdown(
            """
            <div style="margin-bottom: 8px;">
                <div style="font-size: 0.8rem; color: #94a3b8;">Semantic Index (FAISS)</div>
                <div style="font-size: 0.85rem; font-weight: 600; color: #94a3b8;">
                    ○ Not initialized (Phase 2)
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # Temporal Engine Status
        st.markdown(
            """
            <div style="margin-bottom: 8px;">
                <div style="font-size: 0.8rem; color: #94a3b8;">Temporal Engine</div>
                <div style="font-size: 0.85rem; font-weight: 600; color: #38bdf8;">
                    ● Prototype (Display & Inspect)
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        # Evidence Engine Status
        st.markdown(
            """
            <div style="margin-bottom: 8px;">
                <div style="font-size: 0.8rem; color: #94a3b8;">Evidence & Lineage</div>
                <div style="font-size: 0.85rem; font-weight: 600; color: #4ade80;">
                    ● Active
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown("---")
        st.caption(
            "**Smart India Hackathon 2026**\n"
            "Problem Statement: SIH26227\n"
            "Semantic Satellite Intelligence"
        )

    return st.session_state.active_nav
