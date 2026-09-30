"""Builds the FAISS vector similarity index from satellite scene imagery.

Smart India Hackathon 2026 - Problem Statement SIH26227
"""

import sys
import logging
from pathlib import Path
import numpy as np

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from terralens.app.utils.config import config
from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.embedding_service import get_embedding_model
from terralens.app.services.index_service import IndexService
from terralens.app.utils.image_utils import load_image_safely

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("terralens.build_index")


def build_semantic_index(use_mock: bool = False) -> None:
    """Discovers imagery scenes, generates embeddings, and constructs the FAISS vector index."""
    print("=" * 60)
    print("TerraLens AI — Semantic Satellite Vector Index Builder")
    print("=" * 60)

    # 1. Initialize services
    meta_service = MetadataService()
    dataset_service = DatasetService(meta_service)
    index_service = IndexService()

    scenes = list(meta_service.scenes.values())
    print(f"\n1. Discovered {len(scenes)} scenes in metadata catalog.")

    # 2. Initialize embedding model
    print("\n2. Initializing Embedding Model...")
    embed_model = get_embedding_model(use_mock=use_mock)
    dim = embed_model.get_dimension()
    print(f"   Model Name:          {embed_model.model_name}")
    print(f"   Model Label:         {embed_model.model_label}")
    print(f"   Embedding Dimension: {dim}")

    # 3. Generate embeddings
    print("\n3. Generating image embeddings across archive...")
    vectors: list[np.ndarray] = []
    records: list[dict] = []

    for idx, scene in enumerate(scenes):
        img_path = dataset_service.resolve_image_path(scene.image_path)
        if not img_path.exists():
            print(f"   [{idx + 1}/{len(scenes)}] ⚠️ Missing image for scene {scene.scene_id}: {img_path}")
            continue

        img = load_image_safely(img_path)
        if img is None:
            print(f"   [{idx + 1}/{len(scenes)}] ⚠️ Corrupt image for scene {scene.scene_id}: {img_path}")
            continue

        # Compute normalized image embedding
        vec = embed_model.embed_image(img)
        vectors.append(vec)

        records.append({
            "vector_id": len(records),
            "location_id": scene.location_id,
            "scene_id": scene.scene_id,
            "acquisition_date": scene.acquisition_date,
            "sensor": scene.sensor,
            "platform": scene.platform,
            "image_path": scene.image_path,
            "cloud_percentage": scene.cloud_percentage,
            "tags": scene.tags,
            "resolution_meters": scene.resolution_meters,
        })
        print(f"   [{idx + 1}/{len(scenes)}] Indexed {scene.scene_id} ({scene.acquisition_date})")

    if not vectors:
        print("\n❌ Error: No valid image scenes found to index.")
        sys.exit(1)

    # 4. Construct FAISS index
    print(f"\n4. Building FAISS IndexFlatIP (Cosine Similarity) with {len(vectors)} vectors...")
    vectors_arr = np.array(vectors, dtype=np.float32)
    index_service.build_and_save(
        vectors=vectors_arr,
        records=records,
        model_name=embed_model.model_label,
        dimension=dim,
    )

    # 5. Validation check
    is_valid, msg = index_service.validate_index_files()
    print("\n5. Index Validation:")
    print(f"   Status:    {'[OK] VALID' if is_valid else '[FAIL] INVALID'}")
    print(f"   Details:   {msg}")

    print("\n" + "=" * 60)
    print("Semantic Index Build Complete!")
    print(f" - Index File:    {index_service.index_path}")
    print(f" - Metadata File: {index_service.metadata_path}")
    print(f" - Total Vectors: {len(vectors)}")
    print(f" - Metric:        Cosine Similarity (Inner Product on L2 Normalized Vectors)")
    print("=" * 60 + "\n")


if __name__ == "__main__":
    use_mock_flag = "--mock" in sys.argv
    build_semantic_index(use_mock=use_mock_flag)
