"""Unit tests for the TerraLens AI evaluation metrics framework."""

import numpy as np
import pytest

from terralens.app.evaluation.retrieval_metrics import (
    recall_at_k,
    precision_at_k,
    reciprocal_rank,
    aggregate_retrieval_metrics,
)
from terralens.app.evaluation.change_metrics import (
    compute_confusion_matrix,
    evaluate_change_mask,
    aggregate_change_metrics,
)


def test_recall_at_k():
    """Tests Recall@K across multiple rank cutoffs."""
    relevant = {"scene_A", "scene_B"}

    assert recall_at_k(["scene_A", "scene_C", "scene_D"], relevant, 1) == 0.5
    assert recall_at_k(["scene_A", "scene_B", "scene_D"], relevant, 2) == 1.0
    assert recall_at_k(["scene_C", "scene_D"], relevant, 2) == 0.0
    assert recall_at_k([], relevant, 3) == 0.0
    assert recall_at_k(["scene_A"], set(), 1) == 0.0


def test_precision_at_k():
    """Tests Precision@K across multiple rank cutoffs."""
    relevant = {"scene_A", "scene_B"}

    assert precision_at_k(["scene_A", "scene_C", "scene_D"], relevant, 1) == 1.0
    assert precision_at_k(["scene_A", "scene_C", "scene_D"], relevant, 3) == 1.0 / 3.0
    assert precision_at_k(["scene_C", "scene_D"], relevant, 2) == 0.0


def test_reciprocal_rank():
    """Tests Mean Reciprocal Rank scoring."""
    relevant = {"scene_target"}

    assert reciprocal_rank(["scene_target", "other_1"], relevant) == 1.0
    assert reciprocal_rank(["other_1", "scene_target"], relevant) == 0.5
    assert reciprocal_rank(["other_1", "other_2", "scene_target"], relevant) == 1.0 / 3.0
    assert reciprocal_rank(["other_1", "other_2"], relevant) == 0.0


def test_change_confusion_matrix():
    """Tests pixel-level confusion matrix calculation."""
    # 2x2 grid
    # pred: [[1, 0], [1, 0]]
    # gt:   [[1, 1], [0, 0]]
    # (0,0): pred=1, gt=1 -> TP
    # (0,1): pred=0, gt=1 -> FN
    # (1,0): pred=1, gt=0 -> FP
    # (1,1): pred=0, gt=0 -> TN
    pred = np.array([[1, 0], [1, 0]], dtype=np.uint8)
    gt = np.array([[1, 1], [0, 0]], dtype=np.uint8)

    cm = compute_confusion_matrix(pred, gt)
    assert cm["tp"] == 1
    assert cm["fn"] == 1
    assert cm["fp"] == 1
    assert cm["tn"] == 1


def test_change_metrics_with_ground_truth():
    """Tests Precision, Recall, F1, IoU, and FPR on annotated synthetic mask."""
    # Ground truth: 100x100 with a 20x20 positive block = 400 positive pixels
    gt = np.zeros((100, 100), dtype=np.uint8)
    gt[10:30, 10:30] = 1

    # Prediction matches exactly
    res_exact = evaluate_change_mask(gt, gt, pair_id="TEST_EXACT")
    assert res_exact["ground_truth_available"] is True
    assert res_exact["metrics"]["precision"] == 1.0
    assert res_exact["metrics"]["recall"] == 1.0
    assert res_exact["metrics"]["f1"] == 1.0
    assert res_exact["metrics"]["iou"] == 1.0
    assert res_exact["metrics"]["false_positive_rate"] == 0.0

    # Prediction with partial overlap (half true, half false positive)
    pred_partial = np.zeros((100, 100), dtype=np.uint8)
    pred_partial[10:30, 20:40] = 1  # 20x20 block: 10 columns overlap with gt, 10 columns outside
    # Overlap is [10:30, 20:30] = 20x10 = 200 pixels
    # FP is [10:30, 30:40] = 20x10 = 200 pixels
    # FN is [10:30, 10:20] = 20x10 = 200 pixels
    res_part = evaluate_change_mask(pred_partial, gt, pair_id="TEST_PARTIAL")
    assert res_part["metrics"]["precision"] == 0.5
    assert res_part["metrics"]["recall"] == 0.5
    assert res_part["metrics"]["f1"] == 0.5
    # IoU: TP / (TP + FP + FN) = 200 / (200 + 200 + 200) = 200 / 600 = 1/3
    assert abs(res_part["metrics"]["iou"] - (1.0 / 3.0)) < 1e-4


def test_change_metrics_without_ground_truth():
    """Tests that unannotated real scenes report metrics as unavailable without fabrication."""
    pred = np.zeros((100, 100), dtype=np.uint8)
    res = evaluate_change_mask(pred_binary_mask=pred, gt_binary_mask=None, pair_id="UNANNOTATED_SCENE")

    assert res["ground_truth_available"] is False
    assert "Ground truth unavailable" in res["message"]
    assert res["metrics"]["precision"] is None
    assert res["metrics"]["recall"] is None
    assert res["metrics"]["f1"] is None
    assert res["metrics"]["iou"] is None
    assert res["confusion_matrix"] is None


def test_aggregate_metrics():
    """Tests aggregation of change metrics across annotated and unannotated benchmarks."""
    gt = np.ones((10, 10), dtype=np.uint8)
    eval1 = evaluate_change_mask(gt, gt, "P1")
    eval2 = evaluate_change_mask(gt, None, "P2")

    agg = aggregate_change_metrics([eval1, eval2])
    assert agg["total_pairs_considered"] == 2
    assert agg["pairs_with_ground_truth"] == 1
    assert agg["pairs_without_ground_truth"] == 1
    assert agg["mean_metrics_on_annotated_benchmark"]["mean_precision"] == 1.0


def test_aggregate_retrieval_metrics_latency_decomposition():
    """Tests that aggregate_retrieval_metrics decomposes cold-start and warm retrieval latencies."""
    qr1 = {
        "recalls": {"recall@1": 1.0, "recall@3": 1.0, "recall@5": 1.0},
        "precisions": {"precision@1": 1.0, "precision@3": 0.333, "precision@5": 0.2},
        "mrr": 1.0,
        "latency_ms": 2500.0,
        "location_hit_at_1": True,
    }
    qr2 = {
        "recalls": {"recall@1": 0.0, "recall@3": 0.5, "recall@5": 0.5},
        "precisions": {"precision@1": 0.0, "precision@3": 0.333, "precision@5": 0.2},
        "mrr": 0.5,
        "latency_ms": 16.0,
        "location_hit_at_1": True,
    }
    qr3 = {
        "recalls": {"recall@1": 1.0, "recall@3": 1.0, "recall@5": 1.0},
        "precisions": {"precision@1": 1.0, "precision@3": 0.333, "precision@5": 0.2},
        "mrr": 1.0,
        "latency_ms": 18.0,
        "location_hit_at_1": True,
    }

    res = aggregate_retrieval_metrics([qr1, qr2, qr3], cold_start_model_init_ms=2450.0)
    assert res["total_queries_evaluated"] == 3
    assert res["cold_start_model_init_ms"] == 2450.0
    assert res["first_query_latency_ms"] == 2500.0
    assert res["warm_retrieval_mean_latency_ms"] == 17.0
    assert res["mean_latency_ms"] == 17.0

