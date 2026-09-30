"""Benchmark runner script for executing TerraLens AI full evaluation.

Runs:
1. Semantic retrieval evaluation (Recall@K, Precision@K, MRR, score distributions, latency)
2. Multi-temporal change detection evaluation (Confusion matrix, Precision, Recall, F1, IoU, FPR)
3. Robustness stress tests (7 operational scenarios)
4. System performance and index storage measurements
5. Generates evaluation_results.json and evaluation_report.md
"""

import sys
from pathlib import Path

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


def main():
    print("=" * 70)
    print("TerraLens AI — Benchmark Runner & System Evaluation")
    print("SIH-2026: Problem Statement SIH26227")
    print("=" * 70)

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

    print("\n2. Executing comprehensive evaluation suite...")
    runner = BenchmarkRunner(
        retrieval_service=retrieval_service,
        temporal_service=temporal_service,
        metadata_service=meta_service,
        index_service=index_service,
    )

    results = runner.run_all()

    print("\n3. Evaluation Completed. Summary Results:")
    ret = results.get("retrieval", {})
    cd = results.get("change_detection", {})
    rob = results.get("robustness", {})
    perf = results.get("system_performance", {})

    print(f"   - Retrieval Mean Recall@1:         {ret.get('mean_recalls', {}).get('recall@1', 'N/A')}")
    print(f"   - Retrieval Mean Recall@3:         {ret.get('mean_recalls', {}).get('recall@3', 'N/A')}")
    print(f"   - Retrieval Mean Latency:          {ret.get('mean_latency_ms', 'N/A')} ms")
    
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

    json_path = PROJECT_ROOT / "evaluation_results.json"
    md_path = PROJECT_ROOT / "evaluation_report.md"

    print(f"\n4. Persisting evaluation artifacts...")
    save_evaluation_artifacts(results, json_path, md_path)
    print(f"   - Machine-readable results saved: {json_path}")
    print(f"   - Human-readable report saved:   {md_path}")
    print("=" * 70)
    print("Benchmark run finished successfully.\n")


if __name__ == "__main__":
    main()
