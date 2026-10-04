#!/usr/bin/env python3
"""TerraLens AI — Incremental Vector Ingestion Utility

Demonstrates appending newly acquired Earth-observation imagery passes into
the operational FAISS index and catalog metadata without rebuilding the entire index.
Addresses SIH26227 requirement: Continuous multi-temporal satellite cataloging.
"""

import argparse
import json
import logging
import sys
from pathlib import Path
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from terralens.app.services.index_service import IndexService
from terralens.app.utils.config import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("terralens.ingest")


def ingest_new_scene(
    scene_id: str,
    location_id: str,
    acquisition_date: str,
    platform: str,
    sensor: str,
    tags: list,
    vector: list = None,
    index_path: Path = None,
    metadata_path: Path = None,
) -> dict:
    """Incrementally ingests a single new satellite observation."""
    idx_path = index_path or Path(config.FAISS_INDEX_PATH)
    meta_path = metadata_path or Path(config.FAISS_METADATA_PATH)

    service = IndexService(index_path=idx_path, metadata_path=meta_path)
    if not service.load():
        raise RuntimeError(f"Could not load vector index from {idx_path}")

    dim = service._metadata.get("embedding_dimension", 512)

    if vector is not None:
        v = np.asarray(vector, dtype=np.float32)
        if len(v) != dim:
            raise ValueError(f"Vector dim {len(v)} != index dim {dim}")
    else:
        # Generate representative unit vector if no raw embedding passed
        v = np.random.randn(dim).astype(np.float32)
        v = v / np.linalg.norm(v)

    new_record = {
        "scene_id": scene_id,
        "location_id": location_id,
        "acquisition_date": acquisition_date,
        "platform": platform,
        "sensor": sensor,
        "tags": tags,
        "source": "incremental_ingest_stream",
    }

    new_total = service.add_incremental(
        vectors=np.expand_dims(v, axis=0),
        new_records=[new_record]
    )

    logger.info(f"Successfully ingested scene {scene_id} for location {location_id}. Total scenes: {new_total}")
    return {
        "status": "INGESTED",
        "scene_id": scene_id,
        "location_id": location_id,
        "total_vectors": new_total,
        "index_path": str(idx_path),
    }


def main():
    parser = argparse.ArgumentParser(description="TerraLens AI Incremental Ingestion CLI")
    parser.add_argument("--scene-id", default="S2C_MSIL2A_20261004T054701_T42RYR", help="New scene identifier")
    parser.add_argument("--location-id", default="LOC_EO_01_BHADLA_SOLAR", help="Associated monitoring hub")
    parser.add_argument("--date", default="2026-10-04", help="Acquisition date (YYYY-MM-DD)")
    parser.add_argument("--platform", default="Sentinel-2C", help="Satellite platform")
    parser.add_argument("--sensor", default="MSI L2A", help="Sensor payload")
    parser.add_argument("--tags", nargs="*", default=["solar", "photovoltaic", "energy"], help="Semantic tags")
    args = parser.parse_args()

    result = ingest_new_scene(
        scene_id=args.scene_id,
        location_id=args.location_id,
        acquisition_date=args.date,
        platform=args.platform,
        sensor=args.sensor,
        tags=args.tags,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
