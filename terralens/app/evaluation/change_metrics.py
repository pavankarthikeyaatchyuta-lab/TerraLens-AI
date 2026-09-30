"""Multi-temporal change detection evaluation metrics: TP, FP, TN, FN, Precision, Recall, F1, IoU, FPR."""

from typing import Dict, Any, Optional
import numpy as np


def compute_confusion_matrix(
    pred_binary_mask: np.ndarray,
    gt_binary_mask: np.ndarray
) -> Dict[str, int]:
    """Computes pixel-level True Positives, False Positives, True Negatives, and False Negatives."""
    # Ensure binary arrays (0 and 1)
    p = (pred_binary_mask > 0).astype(np.uint8)
    g = (gt_binary_mask > 0).astype(np.uint8)

    # Reconcile spatial shape if needed
    if p.shape != g.shape:
        raise ValueError(f"Shape mismatch between prediction {p.shape} and ground truth {g.shape}")

    tp = int(np.count_nonzero((p == 1) & (g == 1)))
    fp = int(np.count_nonzero((p == 1) & (g == 0)))
    fn = int(np.count_nonzero((p == 0) & (g == 1)))
    tn = int(np.count_nonzero((p == 0) & (g == 0)))

    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn}


def evaluate_change_mask(
    pred_binary_mask: Optional[np.ndarray],
    gt_binary_mask: Optional[np.ndarray],
    pair_id: str = "PAIR_GENERIC",
) -> Dict[str, Any]:
    """Calculates pixel-level metrics if ground truth is available; reports honestly if unavailable."""
    if gt_binary_mask is None:
        return {
            "pair_id": pair_id,
            "ground_truth_available": False,
            "message": "Ground truth unavailable — metric not computed.",
            "metrics": {
                "precision": None,
                "recall": None,
                "f1": None,
                "iou": None,
                "false_positive_rate": None,
            },
            "confusion_matrix": None,
        }

    if pred_binary_mask is None:
        pred_binary_mask = np.zeros_like(gt_binary_mask, dtype=np.uint8)

    cm = compute_confusion_matrix(pred_binary_mask, gt_binary_mask)
    tp, fp, fn, tn = cm["tp"], cm["fp"], cm["fn"], cm["tn"]

    # Precision: TP / (TP + FP)
    precision = (tp / float(tp + fp)) if (tp + fp) > 0 else (1.0 if (fn == 0) else 0.0)

    # Recall: TP / (TP + FN)
    recall = (tp / float(tp + fn)) if (tp + fn) > 0 else (1.0 if (fp == 0) else 0.0)

    # F1 Score: 2 * Precision * Recall / (Precision + Recall)
    f1 = (2.0 * precision * recall / float(precision + recall)) if (precision + recall) > 0 else 0.0

    # IoU (Jaccard Index): TP / (TP + FP + FN)
    iou = (tp / float(tp + fp + fn)) if (tp + fp + fn) > 0 else (1.0 if (fp == 0 and fn == 0) else 0.0)

    # False Positive Rate (FPR): FP / (FP + TN)
    fpr = (fp / float(fp + tn)) if (fp + tn) > 0 else 0.0

    total_pixels = tp + fp + fn + tn
    gt_changed_pixels = tp + fn
    pred_changed_pixels = tp + fp

    return {
        "pair_id": pair_id,
        "ground_truth_available": True,
        "message": "Metrics successfully computed against ground truth mask.",
        "metrics": {
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1": round(float(f1), 4),
            "iou": round(float(iou), 4),
            "false_positive_rate": round(float(fpr), 6),
        },
        "pixel_counts": {
            "total_pixels": total_pixels,
            "ground_truth_changed_pixels": gt_changed_pixels,
            "predicted_changed_pixels": pred_changed_pixels,
            "ground_truth_change_ratio": round(float(gt_changed_pixels) / float(total_pixels), 5) if total_pixels > 0 else 0.0,
            "predicted_change_ratio": round(float(pred_changed_pixels) / float(total_pixels), 5) if total_pixels > 0 else 0.0,
        },
        "confusion_matrix": cm,
    }


def aggregate_change_metrics(evaluation_records: list) -> Dict[str, Any]:
    """Summarizes change detection evaluations across benchmark pairs."""
    evaluated_with_gt = [r for r in evaluation_records if r.get("ground_truth_available", False)]
    unavailable = [r for r in evaluation_records if not r.get("ground_truth_available", False)]

    summary: Dict[str, Any] = {
        "total_pairs_considered": len(evaluation_records),
        "pairs_with_ground_truth": len(evaluated_with_gt),
        "pairs_without_ground_truth": len(unavailable),
        "ground_truth_coverage_ratio": round(len(evaluated_with_gt) / float(len(evaluation_records)), 3) if evaluation_records else 0.0,
    }

    if evaluated_with_gt:
        summary["mean_metrics_on_annotated_benchmark"] = {
            "mean_precision": round(float(np.mean([r["metrics"]["precision"] for r in evaluated_with_gt])), 4),
            "mean_recall": round(float(np.mean([r["metrics"]["recall"] for r in evaluated_with_gt])), 4),
            "mean_f1": round(float(np.mean([r["metrics"]["f1"] for r in evaluated_with_gt])), 4),
            "mean_iou": round(float(np.mean([r["metrics"]["iou"] for r in evaluated_with_gt])), 4),
            "mean_fpr": round(float(np.mean([r["metrics"]["false_positive_rate"] for r in evaluated_with_gt])), 6),
        }
    else:
        summary["mean_metrics_on_annotated_benchmark"] = "Ground truth unavailable across benchmark pairs."

    summary["detailed_results"] = evaluation_records
    return summary
