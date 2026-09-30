"""Evaluation & benchmark component for inspecting model metrics and robustness."""

import json
from pathlib import Path
import streamlit as st

from terralens.app.utils.config import config
from terralens.app.evaluation.benchmark import BenchmarkRunner
from terralens.app.evaluation.report import generate_markdown_report, save_evaluation_artifacts


def render_evaluation_view(
    retrieval_service,
    temporal_service,
    metadata_service,
    index_service,
) -> None:
    """Renders the comprehensive benchmark evaluation dashboard."""
    st.markdown("## Model Evaluation & Robustness Benchmarks")
    st.markdown(
        "<p style='color: #94a3b8; font-size: 0.95rem; margin-top: -8px;'>"
        "Empirical performance metrics, ground-truth change validation, and stress robustness testing."
        "</p>",
        unsafe_allow_html=True,
    )

    json_path = config.PROJECT_ROOT / "evaluation_results.json"
    md_path = config.PROJECT_ROOT / "evaluation_report.md"

    # Action bar to run live benchmark
    btn_col1, btn_col2 = st.columns([1, 3])
    with btn_col1:
        run_live = st.button("⚡ Run Full Benchmark Suite", type="primary", use_container_width=True)
    with btn_col2:
        st.caption("Executes retrieval queries, change ground-truth comparison, 7 robustness stress tests, and timing measurements.")

    results = None
    if run_live:
        with st.spinner("Executing benchmark suite across retrieval, change detection, and robustness..."):
            runner = BenchmarkRunner(
                retrieval_service=retrieval_service,
                temporal_service=temporal_service,
                metadata_service=metadata_service,
                index_service=index_service,
            )
            results = runner.run_all()
            save_evaluation_artifacts(results, json_path, md_path)
            st.success("Benchmark suite executed and artifacts saved successfully!")
    elif json_path.exists():
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                results = json.load(f)
        except Exception:
            results = None

    if not results:
        st.info("No benchmark results found. Click **⚡ Run Full Benchmark Suite** to evaluate the system.")
        return

    ret = results.get("retrieval", {})
    cd = results.get("change_detection", {})
    rob = results.get("robustness", {})
    perf = results.get("system_performance", {})

    # Pillar 1 & 2 Metrics Grid
    st.markdown("### 1. Semantic Retrieval Performance (Stage 1: DISCOVER)")
    r1, r2, r3, r4, r5 = st.columns(5)
    recalls = ret.get("mean_recalls", {})
    with r1:
        st.metric("Recall @ 1", f"{recalls.get('recall@1', 0.0) * 100:.1f}%")
    with r2:
        st.metric("Recall @ 3", f"{recalls.get('recall@3', 0.0) * 100:.1f}%")
    with r3:
        st.metric("Recall @ 5", f"{recalls.get('recall@5', 0.0) * 100:.1f}%")
    with r4:
        st.metric("Mean MRR", f"{ret.get('mean_mrr', 0.0):.3f}")
    with r5:
        st.metric("Mean Latency", f"{ret.get('mean_latency_ms', 0.0):.1f} ms")

    st.markdown("---")

    # Pillar 3 Metrics Grid
    st.markdown("### 2. Multi-Temporal Change Detection Metrics (Stage 2: ANALYZE)")
    cd_summary = cd.get("mean_metrics_on_annotated_benchmark", {})
    if isinstance(cd_summary, dict):
        c1, c2, c3, c4, c5 = st.columns(5)
        with c1:
            st.metric("Precision (GT)", f"{cd_summary.get('mean_precision', 0.0) * 100:.1f}%")
        with c2:
            st.metric("Recall (GT)", f"{cd_summary.get('mean_recall', 0.0) * 100:.1f}%")
        with c3:
            st.metric("F1-Score (GT)", f"{cd_summary.get('mean_f1', 0.0) * 100:.1f}%")
        with c4:
            st.metric("IoU (Jaccard)", f"{cd_summary.get('mean_iou', 0.0) * 100:.1f}%")
        with c5:
            st.metric("False Pos. Rate", f"{cd_summary.get('mean_fpr', 0.0):.5f}")
    else:
        st.info("Ground truth unavailable for this benchmark subset — metrics not fabricated.")

    st.caption(
        "> **Scientific Transparency:** Change metrics are computed exclusively on pairs with verified ground-truth masks. For unannotated real scenes, metrics are honestly reported as unavailable."
    )

    st.markdown("---")

    # Pillar 4 Robustness Grid
    st.markdown("### 3. Robustness Stress Scenarios (7 Controlled Conditions)")
    scenarios = rob.get("scenarios", {})
    rob_cols = st.columns(len(scenarios) if scenarios else 1)
    for col, (sc_id, sc_info) in zip(rob_cols, scenarios.items()):
        with col:
            passed = sc_info.get("passed", False)
            color = "#4ade80" if passed else "#f87171"
            status_text = "PASS" if passed else "FAIL"
            st.markdown(
                f"""
                <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 6px; padding: 10px; text-align: center;">
                    <div style="font-size: 0.72rem; color: #94a3b8; height: 32px; overflow: hidden;">{sc_info.get('scenario', sc_id)}</div>
                    <div style="font-size: 1.1rem; font-weight: 700; color: {color}; margin-top: 4px;">{status_text}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

    st.markdown("---")

    # Report Preview and Downloads
    st.markdown("### 4. Official Evaluation Report & Downloads")
    d_col1, d_col2 = st.columns(2)
    with d_col1:
        st.download_button(
            label="📄 Download Evaluation Results (JSON)",
            data=json.dumps(results, indent=2),
            file_name="evaluation_results.json",
            mime="application/json",
            use_container_width=True,
        )
    with d_col2:
        report_md_str = generate_markdown_report(results)
        st.download_button(
            label="📑 Download Evaluation Report (Markdown)",
            data=report_md_str,
            file_name="evaluation_report.md",
            mime="text/markdown",
            use_container_width=True,
        )

    with st.expander("📖 View Full Human-Readable Evaluation Report (Markdown)", expanded=False):
        st.markdown(report_md_str)
