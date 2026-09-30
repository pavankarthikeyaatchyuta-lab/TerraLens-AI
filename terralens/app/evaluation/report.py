"""Evaluation report generator: creates machine-readable JSON and human-readable Markdown reports."""

import json
from pathlib import Path
from typing import Dict, Any


def generate_markdown_report(results: Dict[str, Any]) -> str:
    """Formats the evaluation results dictionary into a structured Markdown document."""
    meta = results.get("metadata", {})
    env = results.get("environment", {})
    ret = results.get("retrieval", {})
    cd = results.get("change_detection", {})
    rob = results.get("robustness", {})
    sys_perf = results.get("system_performance", {})

    # Retrieval section
    recalls = ret.get("mean_recalls", {})
    precisions = ret.get("mean_precisions", {})

    retrieval_lines = [
        f"- **Recall@1:** {recalls.get('recall@1', 'N/A')}",
        f"- **Recall@3:** {recalls.get('recall@3', 'N/A')}",
        f"- **Recall@5:** {recalls.get('recall@5', 'N/A')}",
        f"- **Precision@1:** {precisions.get('precision@1', 'N/A')}",
        f"- **Mean Reciprocal Rank (MRR):** {ret.get('mean_mrr', 'N/A')}",
        f"- **Target Location Accuracy@1:** {ret.get('location_accuracy_at_1', 'N/A')}",
        f"- **Mean Query Latency:** {ret.get('mean_latency_ms', 'N/A')} ms",
    ]

    # Change Detection section
    annotated_summary = cd.get("mean_metrics_on_annotated_benchmark", {})
    if isinstance(annotated_summary, dict):
        change_lines = [
            f"- **Benchmark Pairs Evaluated:** {cd.get('total_pairs_considered', 0)} ({cd.get('pairs_with_ground_truth', 0)} with ground truth, {cd.get('pairs_without_ground_truth', 0)} unannotated)",
            f"- **Precision:** {annotated_summary.get('mean_precision', 'N/A')}",
            f"- **Recall:** {annotated_summary.get('mean_recall', 'N/A')}",
            f"- **F1-Score:** {annotated_summary.get('mean_f1', 'N/A')}",
            f"- **IoU (Jaccard Index):** {annotated_summary.get('mean_iou', 'N/A')}",
            f"- **False Positive Rate (FPR):** {annotated_summary.get('mean_fpr', 'N/A')}",
            "",
            "> **Honesty Principle:** Metrics are computed strictly on benchmark pairs where explicit pixel-level ground truth exists. For unannotated catalog pairs, metrics are marked as *'Ground truth unavailable — metric not computed'*, preserving scientific defensibility.",
        ]
    else:
        change_lines = [
            f"- **Status:** {annotated_summary}",
            "> Ground truth unavailable — metric not computed.",
        ]

    # Robustness section
    rob_scenarios = rob.get("scenarios", {})
    rob_rows = []
    for k, s in rob_scenarios.items():
        status_icon = "PASSED" if s.get("passed", False) else "FAILED"
        name = s.get("scenario", k)
        notes = s.get("notes", "")
        rob_rows.append(f"| {name} | **{status_icon}** | {notes} |")
    rob_table = "\n".join(rob_rows)

    # System Performance
    ret_timing = sys_perf.get("retrieval_timing", {})
    cd_timing = sys_perf.get("change_detection_timing", {})
    idx_storage = sys_perf.get("index_storage", {})

    report_md = f"""# TERRALENS AI EVALUATION REPORT

**Smart India Hackathon 2026**  
**Problem Statement ID:** SIH26227  
**Benchmark Suite:** {meta.get('benchmark_name', 'TerraLens Evaluation Suite')} v{meta.get('version', '1.0.0')}  

---

## 1. Benchmark & Environment Summary

- **Total Monitored Locations:** {meta.get('total_locations', 0)}
- **Total Satellite Scenes:** {meta.get('total_scenes', 0)}
- **Retrieval Queries in Suite:** {ret.get('total_queries_evaluated', 0)}
- **Change Analysis Pairs in Suite:** {cd.get('total_pairs_considered', 0)}
- **Operating System:** {env.get('operating_system', 'Unknown')}
- **Python Version:** {env.get('python_version', 'Unknown')} ({env.get('architecture', 'Unknown')})
- **Processor:** {env.get('processor', 'Unknown')}
- **Logical CPU Cores:** {env.get('cpu_cores_logical', 'N/A')}

---

## 2. Semantic Retrieval Evaluation

Cross-modal semantic search using normalized 512-dimensional CLIP baseline embeddings against a FAISS `IndexFlatIP` cosine similarity index:

{chr(10).join(retrieval_lines)}

### Individual Query Performance
| Query ID / Text | Relevant Scenes | Retrieved @ 1 | Latency | R@1 | R@3 | R@5 | MRR |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""

    for qd in ret.get("query_details", []):
        q_text = qd.get("query_text", "")
        top1 = qd.get("retrieved_scene_ids", ["None"])[0] if qd.get("retrieved_scene_ids") else "None"
        lat = qd.get("latency_ms", 0.0)
        r1 = qd.get("recalls", {}).get("recall@1", 0.0)
        r3 = qd.get("recalls", {}).get("recall@3", 0.0)
        r5 = qd.get("recalls", {}).get("recall@5", 0.0)
        mrr_val = qd.get("mrr", 0.0)
        report_md += f"| *\"{q_text}\"* | {qd.get('relevant_scenes_count', 0)} | `{top1}` | {lat:.1f}ms | {r1:.2f} | {r3:.2f} | {r5:.2f} | {mrr_val:.2f} |\n"

    report_md += f"""
---

## 3. Multi-Temporal Change Detection Evaluation

Deterministic bi-temporal change detection with morphological noise reduction and minimum region filtering:

{chr(10).join(change_lines)}

### Pair-by-Pair Ground Truth Adjudication
| Pair ID | Scenario Name | Ground Truth | Verdict | Status / IoU |
| :--- | :--- | :--- | :--- | :--- |
"""

    for pr in cd.get("detailed_results", []):
        p_id = pr.get("pair_id", "")
        p_name = pr.get("name", p_id)
        gt_avail = "Available" if pr.get("ground_truth_available", False) else "Unavailable"
        det_status = pr.get("detected_status", "N/A")
        iou_val = pr.get("metrics", {}).get("iou")
        iou_str = f"IoU: {iou_val:.4f}" if iou_val is not None else "Metric not computed"
        report_md += f"| `{p_id}` | {p_name} | {gt_avail} | {det_status} | {iou_str} |\n"

    report_md += f"""
---

## 4. Robustness & Stress Scenarios

Evaluation across 7 controlled operational stress and perturbation conditions:

| Scenario | Verdict | Behavior & Mitigation Notes |
| :--- | :--- | :--- |
{rob_table}

---

## 5. System Performance & Storage

Actual measured execution times using `time.perf_counter()`:

- **FAISS Index File Size:** {idx_storage.get('index_file_kb', 0.0)} KB ({idx_storage.get('total_vectors', 0)} vectors, dim={idx_storage.get('dimension', 512)})
- **FAISS Metadata File Size:** {idx_storage.get('metadata_file_kb', 0.0)} KB
- **Semantic Retrieval Latency (Mean):** {ret_timing.get('mean_latency_ms', 0.0)} ms (Min: {ret_timing.get('min_latency_ms', 0.0)} ms, Max: {ret_timing.get('max_latency_ms', 0.0)} ms)
- **Temporal Analysis Latency (Mean):** {cd_timing.get('mean_latency_ms', 0.0)} ms (Shape: {cd_timing.get('scene_dimensions', 'N/A')}, Min: {cd_timing.get('min_latency_ms', 0.0)} ms, Max: {cd_timing.get('max_latency_ms', 0.0)} ms)

---

## 6. Technical Limitations & Scientific Disclosures

1. **Benchmark Scale:** The current benchmark contains 10 scenes across 5 monitored locations. It is designed to demonstrate architectural soundness and workflow reproducibility at prototype scale, not global planetary scale.
2. **Generic Vision-Language Model:** Embeddings are produced by `openai/clip-vit-base-patch32` (*CLIP baseline*). While effective for generic semantic retrieval, fine-tuning on multispectral remote-sensing bands (e.g. RemoteCLIP) is planned for future phases.
3. **Ground-Truth Availability:** Full pixel-level ground truth masks are provided for synthetic controlled verification pairs. For complex real satellite scenes, ground truth is marked as unavailable to avoid unverified synthetic metric fabrication.
4. **Deterministic Change Detector:** The Phase 3 detector detects radiometric and structural changes using difference magnitudes and morphological filtering. It does not perform autonomous semantic classification (e.g., distinguishing urban construction from agricultural land clearing without contextual prompts).
5. **Image Alignment vs. Geodetic Co-Registration:** The current `ImageAlignmentService` performs spatial dimension validation and resolution resizing to a common comparison space. It does not claim rigorous sub-pixel geodetic bundle adjustment.
6. **Model-Derived Analytical Confidence:** Confidence scores are computed directly from contrast dynamic range, spatial cluster coherence, and sensor mismatch penalties. They represent an engineered analytical confidence score, not a calibrated Bayesian posterior probability.
"""

    return report_md


def save_evaluation_artifacts(
    results: Dict[str, Any],
    json_path: Path,
    md_path: Path,
) -> None:
    """Persists evaluation results to JSON and Markdown destinations."""
    json_path.parent.mkdir(parents=True, exist_ok=True)
    md_path.parent.mkdir(parents=True, exist_ok=True)

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    md_content = generate_markdown_report(results)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
