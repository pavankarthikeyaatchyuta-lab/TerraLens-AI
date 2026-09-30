"""Benchmark orchestrator for executing retrieval, change detection, robustness, and system evaluations."""

import json
from pathlib import Path
from typing import Dict, Any, Optional

import numpy as np
from PIL import Image
import cv2

from terralens.app.utils.config import config
from terralens.app.evaluation.retrieval_metrics import (
    evaluate_single_query,
    aggregate_retrieval_metrics,
)
from terralens.app.evaluation.change_metrics import (
    evaluate_change_mask,
    aggregate_change_metrics,
)
from terralens.app.evaluation.robustness import RobustnessSuite
from terralens.app.evaluation.system_metrics import (
    get_environment_info,
    measure_retrieval_performance,
    measure_change_detection_performance,
    measure_index_storage_metrics,
)


class BenchmarkRunner:
    """Coordinates end-to-end evaluation across all four pillars of TerraLens AI."""

    def __init__(
        self,
        retrieval_service: Any,
        temporal_service: Any,
        metadata_service: Any,
        index_service: Any,
    ):
        self.retrieval_service = retrieval_service
        self.temporal_service = temporal_service
        self.metadata_service = metadata_service
        self.index_service = index_service

    def run_all(
        self,
        retrieval_queries_path: Optional[Path] = None,
        change_pairs_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """Executes full evaluation and returns unified results tree."""
        queries_path = retrieval_queries_path or (config.DATA_DIR / "evaluation" / "retrieval_queries.json")
        pairs_path = change_pairs_path or (config.DATA_DIR / "evaluation" / "change_benchmark_pairs.json")

        results: Dict[str, Any] = {
            "metadata": {
                "benchmark_name": "TerraLens AI Evaluation Suite",
                "version": "1.0.0",
                "total_locations": len(self.metadata_service.get_all_locations()),
                "total_scenes": len(self.metadata_service.get_all_scenes()),
            },
            "environment": get_environment_info(),
            "retrieval": self.evaluate_retrieval(queries_path),
            "change_detection": self.evaluate_change_detection(pairs_path),
            "robustness": self.evaluate_robustness(),
            "system_performance": self.evaluate_system_performance(),
        }

        return results

    def evaluate_retrieval(self, queries_path: Path) -> Dict[str, Any]:
        """Evaluates semantic retrieval across the benchmark query set."""
        if not queries_path.exists():
            return {"error": f"Retrieval queries benchmark file not found: {queries_path}"}

        with open(queries_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        queries = data.get("queries", [])
        eval_records = []

        for q in queries:
            rec = evaluate_single_query(
                retrieval_service=self.retrieval_service,
                query_text=q["query_text"],
                relevant_scene_ids=q.get("relevant_scene_ids", []),
                target_location_ids=q.get("target_location_ids", []),
                top_k_list=[1, 3, 5],
            )
            rec["domain"] = q.get("domain", "general")
            rec["rationale"] = q.get("rationale", "")
            eval_records.append(rec)

        embed_model = getattr(self.retrieval_service, "embedding_model", None)
        cold_start_ms = getattr(embed_model, "cold_start_time_ms", None)

        return aggregate_retrieval_metrics(eval_records, cold_start_model_init_ms=cold_start_ms)

    def evaluate_change_detection(self, pairs_path: Path) -> Dict[str, Any]:
        """Evaluates multi-temporal change detection against ground truth where available."""
        if not pairs_path.exists():
            return {"error": f"Change benchmark file not found: {pairs_path}"}

        with open(pairs_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        pairs = data.get("benchmark_pairs", [])
        eval_records = []

        detector = self.temporal_service.change_detector

        for p in pairs:
            pair_id = p["pair_id"]
            has_gt = p.get("has_ground_truth", False)
            gt_path = p.get("ground_truth_mask_path")

            b_path = Path(p["before_image_path"])
            a_path = Path(p["after_image_path"])

            if not b_path.exists() or not a_path.exists():
                eval_records.append({
                    "pair_id": pair_id,
                    "error": f"Missing input images for pair {pair_id}",
                    "ground_truth_available": False,
                })
                continue

            b_img = Image.open(b_path)
            a_img = Image.open(a_path)

            res = detector.detect(
                before_image=b_img,
                after_image=a_img,
                location_id=pair_id,
                difference_threshold=30,
                min_region_size_pixels=25,
            )

            # Load ground truth if exists
            gt_mask = None
            if has_gt and gt_path and Path(gt_path).exists():
                gt_raw = cv2.imread(str(gt_path), cv2.IMREAD_GRAYSCALE)
                gt_mask = (gt_raw > 127).astype(np.uint8)

            # Load predicted mask if exists
            pred_mask = None
            if res.change_mask_path and Path(res.change_mask_path).exists():
                pred_raw = cv2.imread(str(res.change_mask_path), cv2.IMREAD_GRAYSCALE)
                pred_mask = (pred_raw > 127).astype(np.uint8)

            record = evaluate_change_mask(
                pred_binary_mask=pred_mask,
                gt_binary_mask=gt_mask,
                pair_id=pair_id,
            )
            record["name"] = p.get("name", pair_id)
            record["detected_status"] = res.status
            record["expected_status"] = p.get("expected_status", "UNKNOWN")
            record["notes"] = p.get("notes", "")
            eval_records.append(record)

        return aggregate_change_metrics(eval_records)

    def evaluate_robustness(self) -> Dict[str, Any]:
        """Runs the 7-scenario robustness stress suite."""
        suite = RobustnessSuite(self.temporal_service.change_detector)
        return suite.run_all()

    def evaluate_system_performance(self) -> Dict[str, Any]:
        """Captures latency, storage, and throughput metrics."""
        perf: Dict[str, Any] = {
            "retrieval_timing": measure_retrieval_performance(self.retrieval_service, repetitions=3),
            "index_storage": measure_index_storage_metrics(self.index_service),
        }

        # Measure change detection on first catalog location
        locations = self.metadata_service.get_all_locations()
        if locations:
            perf["change_detection_timing"] = measure_change_detection_performance(
                self.temporal_service,
                locations[0],
                repetitions=3,
            )

        return perf
