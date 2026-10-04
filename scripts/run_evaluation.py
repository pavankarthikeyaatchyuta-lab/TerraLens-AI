"""Benchmark runner script for executing TerraLens AI full evaluation.

Supports:
1. Internal Controlled Synthetic Benchmark evaluation (default)
2. External / Held-out evaluation input via --queries, --pairs, or --sih-heldout-dir
3. Clear status reporting: PASS, PARTIAL, or BLOCKED BY EXTERNAL INPUT
4. Generates evaluation_results.json and evaluation_report.md
"""

import sys
import json
import argparse
import logging
from pathlib import Path
from datetime import datetime, timezone

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.index_service import IndexService
from terralens.app.services.embedding_service import get_embedding_model
from terralens.app.services.retrieval_service import (
    SemanticEmbeddingRetrievalService,
    PrototypeMetadataRetrievalService,
)
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.evaluation.benchmark import BenchmarkRunner
from terralens.app.evaluation.report import save_evaluation_artifacts

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("terralens.run_evaluation")


def main():
    parser = argparse.ArgumentParser(
        description="TerraLens AI — Benchmark Runner & System Evaluation (SIH26227)"
    )
    parser.add_argument(
        "--queries",
        type=str,
        default=None,
        help="Path to retrieval queries JSON file with relevance ground truth",
    )
    parser.add_argument(
        "--pairs",
        type=str,
        default=None,
        help="Path to change detection pairs JSON file with ground truth masks",
    )
    parser.add_argument(
        "--sih-heldout-dir",
        type=str,
        default=None,
        help="Path to directory containing SIH organizer-held-out evaluation data",
    )
    parser.add_argument(
        "--output-json",
        type=str,
        default=None,
        help="Output path for machine-readable JSON results (default: evaluation_results.json)",
    )
    parser.add_argument(
        "--output-md",
        type=str,
        default=None,
        help="Output path for human-readable Markdown report (default: evaluation_report.md)",
    )

    args = parser.parse_args()

    print("=" * 70)
    print("TerraLens AI — Benchmark Runner & System Evaluation")
    print("SIH-2026: Problem Statement SIH26227")
    print("=" * 70)

    # Check for SIH held-out directory evaluation mode
    if args.sih_heldout_dir:
        heldout_path = Path(args.sih_heldout_dir)
        print(f"\n[MODE] External SIH Held-Out Evaluation requested: {heldout_path}")
        
        has_heldout_data = heldout_path.exists() and any(heldout_path.iterdir())
        if not has_heldout_data:
            print("\n" + "!" * 70)
            print("STATUS: BLOCKED BY EXTERNAL INPUT — organiser-held-out evaluation data is not present in the repository.")
            print("!" * 70)
            print("\nTerraLens AI is fully architected to ingest and evaluate held-out data:")
            print("  1. Place organizer scenes in the configured directory.")
            print("  2. Run 'python scripts/stage_local_dataset.py --source-dir <dir>' to generate manifest.")
            print("  3. Re-run this evaluation harness with --queries and --pairs manifests.")
            print("=" * 70)

            # Persist clean diagnostic record
            blocked_record = {
                "evaluation_mode": "SIH_HELDOUT_EXTERNAL",
                "status": "BLOCKED BY EXTERNAL INPUT — organiser-held-out evaluation data is not present in the repository.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "problem_statement": "SIH26227",
                "target_directory": str(heldout_path),
                "guidance": "Provide official SIH26227 held-out evaluation dataset to run external evaluation.",
            }
            json_out = Path(args.output_json) if args.output_json else (PROJECT_ROOT / "evaluation_results.json")
            with open(json_out, "w", encoding="utf-8") as f:
                json.dump(blocked_record, f, indent=2)
            print(f"Recorded status to {json_out}\n")
            return

    queries_path = Path(args.queries) if args.queries else None
    pairs_path = Path(args.pairs) if args.pairs else None

    print("\n1. Initializing core services...")
    meta_service = MetadataService()
    data_service = DatasetService(metadata_service=meta_service)
    index_service = IndexService()

    try:
        embed_model = get_embedding_model()
        retrieval_service = SemanticEmbeddingRetrievalService(
            metadata_service=meta_service,
            dataset_service=data_service,
            index_service=index_service,
            embedding_model=embed_model,
        )
        print("   Semantic Retrieval Service: ONLINE (CLIP baseline + FAISS IndexFlatIP)")
    except Exception as e:
        print(f"   [WARN] Falling back to metadata retrieval: {e}")
        retrieval_service = PrototypeMetadataRetrievalService(metadata_service=meta_service)

    temporal_service = TemporalAnalysisService(metadata_service=meta_service, dataset_service=data_service)
    print("   Temporal Analysis Service: ONLINE (DeterministicBiTemporalChangeDetector)")

    print("\n2. Executing evaluation suite...")
    runner = BenchmarkRunner(
        retrieval_service=retrieval_service,
        temporal_service=temporal_service,
        metadata_service=meta_service,
        index_service=index_service,
    )

    results = runner.run_all(
        retrieval_queries_path=queries_path,
        change_pairs_path=pairs_path,
    )

    print("\n3. Evaluation Completed. Summary Results:")
    ret = results.get("retrieval", {})
    cd = results.get("change_detection", {})
    rob = results.get("robustness", {})
    perf = results.get("system_performance", {})

    cold_ms = ret.get('cold_start_model_init_ms')
    cold_str = f"{cold_ms:.1f} ms (~{cold_ms / 1000.0:.2f} s)" if cold_ms is not None else f"{ret.get('first_query_latency_ms', 'N/A')} ms"
    warm_lat = ret.get('warm_retrieval_mean_latency_ms', ret.get('mean_latency_ms', 'N/A'))

    print(f"   - Retrieval Mean Recall@1:         {ret.get('mean_recalls', {}).get('recall@1', 'N/A')}")
    print(f"   - Retrieval Mean Recall@3:         {ret.get('mean_recalls', {}).get('recall@3', 'N/A')}")
    print(f"   - Cold-Start Model Initialization: {cold_str}")
    print(f"   - Warm Semantic Retrieval Latency: {warm_lat} ms")
    
    cd_metrics = cd.get("mean_metrics_on_annotated_benchmark", {})
    if isinstance(cd_metrics, dict):
        print(f"   - Change Detection Precision (GT): {cd_metrics.get('mean_precision', 'N/A')}")
        print(f"   - Change Detection Recall (GT):    {cd_metrics.get('mean_recall', 'N/A')}")
        print(f"   - Change Detection F1-Score (GT):  {cd_metrics.get('mean_f1', 'N/A')}")
        print(f"   - Change Detection IoU (GT):       {cd_metrics.get('mean_iou', 'N/A')}")
    else:
        print(f"   - Change Detection Status:         {cd_metrics}")

    print(f"   - Robustness Suite Passed:         {rob.get('passed_scenarios', 0)} / {rob.get('total_scenarios', 0)} scenarios")
    print(f"   - Change Analysis Latency:         {perf.get('change_detection_timing', {}).get('mean_latency_ms', 'N/A')} ms")

    json_path = Path(args.output_json) if args.output_json else (PROJECT_ROOT / "evaluation_results.json")
    md_path = Path(args.output_md) if args.output_md else (PROJECT_ROOT / "evaluation_report.md")

    print(f"\n4. Persisting evaluation artifacts...")
    save_evaluation_artifacts(results, json_path, md_path)
    print(f"   - Machine-readable results saved: {json_path}")
    print(f"   - Human-readable report saved:   {md_path}")
    print("=" * 70)
    print("Benchmark run finished successfully.\n")


if __name__ == "__main__":
    main()
