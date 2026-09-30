"""Retrieval evaluation metrics: Recall@K, Precision@K, MRR, latency, and score distributions."""

import time
from typing import List, Set, Dict, Any, Optional
import numpy as np


def recall_at_k(retrieved_scene_ids: List[str], relevant_scene_ids: Set[str], k: int) -> float:
    """Calculates Recall@K: fraction of relevant scenes retrieved in top-k positions."""
    if not relevant_scene_ids or k <= 0:
        return 0.0
    top_k = retrieved_scene_ids[:k]
    hits = len(set(top_k).intersection(relevant_scene_ids))
    return float(hits) / float(len(relevant_scene_ids))


def precision_at_k(retrieved_scene_ids: List[str], relevant_scene_ids: Set[str], k: int) -> float:
    """Calculates Precision@K: fraction of top-k retrieved scenes that are relevant."""
    if k <= 0:
        return 0.0
    top_k = retrieved_scene_ids[:k]
    hits = len(set(top_k).intersection(relevant_scene_ids))
    return float(hits) / float(k)


def reciprocal_rank(retrieved_scene_ids: List[str], relevant_scene_ids: Set[str]) -> float:
    """Calculates Reciprocal Rank of the first relevant scene in the retrieved list (1-indexed)."""
    for idx, sid in enumerate(retrieved_scene_ids):
        if sid in relevant_scene_ids:
            return 1.0 / float(idx + 1)
    return 0.0


def evaluate_single_query(
    retrieval_service: Any,
    query_text: str,
    relevant_scene_ids: List[str],
    target_location_ids: Optional[List[str]] = None,
    top_k_list: Optional[List[int]] = None,
) -> Dict[str, Any]:
    """Executes a single semantic query, measures latency, and calculates ranking metrics."""
    if top_k_list is None:
        top_k_list = [1, 3, 5]

    rel_set = set(relevant_scene_ids)
    max_k = max(top_k_list)

    t0 = time.perf_counter()
    candidates = retrieval_service.search(query=query_text, top_k=max_k)
    latency_ms = (time.perf_counter() - t0) * 1000.0

    retrieved_scenes = [c.matched_scene_id for c in candidates if getattr(c, "matched_scene_id", None)]
    retrieved_locations = [c.location.location_id for c in candidates if getattr(c, "location", None)]
    scores = [c.similarity_score for c in candidates if c.similarity_score is not None]

    recalls = {f"recall@{k}": round(recall_at_k(retrieved_scenes, rel_set, k), 4) for k in top_k_list}
    precisions = {f"precision@{k}": round(precision_at_k(retrieved_scenes, rel_set, k), 4) for k in top_k_list}
    mrr = round(reciprocal_rank(retrieved_scenes, rel_set), 4)

    # Location-level hit
    target_locs = set(target_location_ids or [])
    location_hit_at_1 = bool(retrieved_locations and retrieved_locations[0] in target_locs)

    score_dist = {
        "min": round(float(np.min(scores)), 4) if scores else None,
        "max": round(float(np.max(scores)), 4) if scores else None,
        "mean": round(float(np.mean(scores)), 4) if scores else None,
        "std": round(float(np.std(scores)), 4) if scores else None,
    }

    return {
        "query_text": query_text,
        "relevant_scenes_count": len(rel_set),
        "retrieved_scenes_count": len(retrieved_scenes),
        "retrieved_scene_ids": retrieved_scenes,
        "latency_ms": round(latency_ms, 2),
        "recalls": recalls,
        "precisions": precisions,
        "mrr": mrr,
        "location_hit_at_1": location_hit_at_1,
        "score_distribution": score_dist,
    }


def aggregate_retrieval_metrics(
    query_results: List[Dict[str, Any]],
    cold_start_model_init_ms: Optional[float] = None,
) -> Dict[str, Any]:
    """Computes mean Recall@K, Precision@K, MRR, and explicitly separates cold-start and warm retrieval latencies."""
    if not query_results:
        return {}

    n = len(query_results)
    keys_recalls = list(query_results[0]["recalls"].keys())
    keys_precisions = list(query_results[0]["precisions"].keys())

    mean_recalls = {
        k: round(float(np.mean([qr["recalls"][k] for qr in query_results])), 4)
        for k in keys_recalls
    }
    mean_precisions = {
        k: round(float(np.mean([qr["precisions"][k] for qr in query_results])), 4)
        for k in keys_precisions
    }
    mean_mrr = round(float(np.mean([qr["mrr"] for qr in query_results])), 4)

    # Latency decomposition: distinguish cold-start first query from subsequent warm retrieval
    first_query_lat = round(float(query_results[0]["latency_ms"]), 2)
    if n > 1:
        warm_lats = [float(qr["latency_ms"]) for qr in query_results[1:]]
        warm_mean_lat = round(float(np.mean(warm_lats)), 2)
        warm_min_lat = round(float(np.min(warm_lats)), 2)
        warm_max_lat = round(float(np.max(warm_lats)), 2)
    else:
        warm_mean_lat = first_query_lat
        warm_min_lat = first_query_lat
        warm_max_lat = first_query_lat

    loc_accuracy_at_1 = round(float(np.mean([1.0 if qr["location_hit_at_1"] else 0.0 for qr in query_results])), 4)

    return {
        "total_queries_evaluated": n,
        "cold_start_model_init_ms": round(cold_start_model_init_ms, 2) if cold_start_model_init_ms is not None else None,
        "first_query_latency_ms": first_query_lat,
        "warm_retrieval_mean_latency_ms": warm_mean_lat,
        "warm_retrieval_min_latency_ms": warm_min_lat,
        "warm_retrieval_max_latency_ms": warm_max_lat,
        "mean_latency_ms": warm_mean_lat,  # Default mean latency represents steady-state warm retrieval
        "mean_recalls": mean_recalls,
        "mean_precisions": mean_precisions,
        "mean_mrr": mean_mrr,
        "location_accuracy_at_1": loc_accuracy_at_1,
        "query_details": query_results,
    }
