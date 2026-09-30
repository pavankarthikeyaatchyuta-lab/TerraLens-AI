"""TerraLens AI Evaluation Framework: retrieval, change detection, robustness, and performance metrics."""

from terralens.app.evaluation.retrieval_metrics import (
    recall_at_k,
    precision_at_k,
    reciprocal_rank,
    evaluate_single_query,
    aggregate_retrieval_metrics,
)
from terralens.app.evaluation.change_metrics import (
    compute_confusion_matrix,
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
from terralens.app.evaluation.benchmark import BenchmarkRunner
from terralens.app.evaluation.report import (
    generate_markdown_report,
    save_evaluation_artifacts,
)

__all__ = [
    "recall_at_k",
    "precision_at_k",
    "reciprocal_rank",
    "evaluate_single_query",
    "aggregate_retrieval_metrics",
    "compute_confusion_matrix",
    "evaluate_change_mask",
    "aggregate_change_metrics",
    "RobustnessSuite",
    "get_environment_info",
    "measure_retrieval_performance",
    "measure_change_detection_performance",
    "measure_index_storage_metrics",
    "BenchmarkRunner",
    "generate_markdown_report",
    "save_evaluation_artifacts",
]
