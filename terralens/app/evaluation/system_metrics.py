"""System performance evaluation and environment diagnostics."""

import os
import platform
import sys
import time
from pathlib import Path
from typing import Dict, Any, Optional

from PIL import Image

from terralens.app.utils.config import config


def get_environment_info() -> Dict[str, Any]:
    """Captures runtime hardware and software platform details."""
    info: Dict[str, Any] = {
        "operating_system": f"{platform.system()} {platform.release()} ({platform.version()})",
        "platform": platform.platform(),
        "python_version": sys.version.split()[0],
        "python_implementation": platform.python_implementation(),
        "architecture": platform.machine(),
        "processor": platform.processor() or "Unknown CPU",
    }

    try:
        import psutil
        mem = psutil.virtual_memory()
        info["total_ram_gb"] = round(mem.total / (1024 ** 3), 2)
        info["available_ram_gb"] = round(mem.available / (1024 ** 3), 2)
        info["cpu_cores_logical"] = psutil.cpu_count(logical=True)
        info["cpu_cores_physical"] = psutil.cpu_count(logical=False)
    except ImportError:
        info["ram_note"] = "psutil not installed; memory metrics omitted."

    return info


def measure_retrieval_performance(
    retrieval_service: Any,
    sample_queries: Optional[list] = None,
    repetitions: int = 3,
) -> Dict[str, Any]:
    """Measures actual latency for semantic retrieval queries over multiple trials."""
    if sample_queries is None:
        sample_queries = [
            "urban expansion near river",
            "water reservoir shoreline drying",
            "solar panel farm in desert",
        ]

    latencies_ms = []

    # Warm-up run
    try:
        retrieval_service.search(query=sample_queries[0], top_k=3)
    except Exception:
        pass

    for q in sample_queries:
        for _ in range(repetitions):
            t0 = time.perf_counter()
            retrieval_service.search(query=q, top_k=5)
            dt = (time.perf_counter() - t0) * 1000.0
            latencies_ms.append(dt)

    return {
        "benchmark_queries_count": len(sample_queries),
        "trials_per_query": repetitions,
        "total_runs": len(latencies_ms),
        "mean_latency_ms": round(float(sum(latencies_ms) / len(latencies_ms)), 2) if latencies_ms else 0.0,
        "min_latency_ms": round(float(min(latencies_ms)), 2) if latencies_ms else 0.0,
        "max_latency_ms": round(float(max(latencies_ms)), 2) if latencies_ms else 0.0,
    }


def measure_change_detection_performance(
    temporal_service: Any,
    location_obj: Any,
    repetitions: int = 3,
) -> Dict[str, Any]:
    """Measures actual latency for multi-temporal change detection and artifact generation."""
    pair = temporal_service.load_temporal_pair(location_obj)
    if not pair.is_complete:
        return {"error": "Temporal imagery incomplete for performance benchmarking"}

    latencies_ms = []

    # Warm-up run
    temporal_service.analyze_pair(pair)

    for _ in range(repetitions):
        t0 = time.perf_counter()
        res = temporal_service.analyze_pair(pair)
        dt = (time.perf_counter() - t0) * 1000.0
        latencies_ms.append(dt)

    return {
        "location_id": location_obj.location_id,
        "scene_dimensions": f"{res.diagnostics.get('shape', ('Unknown', 'Unknown'))}",
        "repetitions": repetitions,
        "mean_latency_ms": round(float(sum(latencies_ms) / len(latencies_ms)), 2),
        "min_latency_ms": round(float(min(latencies_ms)), 2),
        "max_latency_ms": round(float(max(latencies_ms)), 2),
        "changed_pixels": res.changed_pixels,
        "regions_extracted": len(res.change_regions),
    }


def measure_index_storage_metrics(index_service: Any) -> Dict[str, Any]:
    """Measures FAISS index storage, vectors count, and memory footprint."""
    summary = index_service.get_summary()
    index_path = config.INDEX_DIR / "satellite_embeddings.index"
    meta_path = config.INDEX_DIR / "satellite_embeddings_metadata.json"

    idx_size_kb = round(index_path.stat().st_size / 1024.0, 2) if index_path.exists() else 0.0
    meta_size_kb = round(meta_path.stat().st_size / 1024.0, 2) if meta_path.exists() else 0.0

    return {
        "index_type": summary.get("index_type", "IndexFlatIP"),
        "total_vectors": summary.get("total_vectors", 0),
        "dimension": summary.get("dimension", 512),
        "index_file_kb": idx_size_kb,
        "metadata_file_kb": meta_size_kb,
        "is_valid": summary.get("is_valid", False),
    }
