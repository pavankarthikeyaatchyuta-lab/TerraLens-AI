import sys
import json
import shutil
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))

import numpy as np
import faiss

from terralens.app.services.metadata_service import MetadataService
from terralens.app.services.dataset_service import DatasetService
from terralens.app.services.temporal_service import TemporalAnalysisService
from terralens.app.services.change_detector import DeterministicBiTemporalChangeDetector
from terralens.app.services.embedding_service import CLIPEmbeddingModel


def main():
    root = Path(__file__).resolve().parent.parent
    web_dir = root / "web"
    public_dir = web_dir / "public"
    public_data_dir = public_dir / "data"
    public_samples_dir = public_dir / "samples"
    public_change_masks_dir = public_dir / "outputs" / "change_masks"

    for d in [public_data_dir, public_samples_dir, public_change_masks_dir]:
        d.mkdir(parents=True, exist_ok=True)

    print("Step 1: Copying sample satellite scenes...")
    samples_src = root / "data" / "samples"
    img_count = 0
    for loc_dir in samples_src.iterdir():
        if loc_dir.is_dir():
            dest = public_samples_dir / loc_dir.name
            dest.mkdir(parents=True, exist_ok=True)
            for img in loc_dir.glob("*"):
                if img.is_file():
                    shutil.copy2(img, dest / img.name)
                    img_count += 1
    print(f"  Copied {img_count} sample images into {public_samples_dir}.")

    print("Step 2: Copying change detection artifacts...")
    masks_src = root / "data" / "outputs" / "change_masks"
    count = 0
    for mask_file in masks_src.glob("*"):
        if mask_file.is_file() and not mask_file.name.startswith("."):
            shutil.copy2(mask_file, public_change_masks_dir / mask_file.name)
            count += 1
    print(f"  Copied {count} change mask artifacts.")

    print("Step 3: Copying evaluation results and locations catalog...")
    shutil.copy2(root / "evaluation_results.json", public_data_dir / "evaluation_results.json")
    shutil.copy2(root / "data" / "metadata" / "locations.json", public_data_dir / "locations.json")

    print("Step 4: Extracting 512-dim scene vectors from FAISS index...")
    faiss_index_path = root / "indexes" / "satellite_embeddings.index"
    faiss_meta_path = root / "indexes" / "satellite_embeddings_metadata.json"

    with open(faiss_meta_path, "r", encoding="utf-8") as f:
        meta_data = json.load(f)

    index = faiss.read_index(str(faiss_index_path))
    scene_embeddings = []
    for item in meta_data.get("records", []):
        idx = item["vector_id"]
        scene_id = item["scene_id"]
        vec = index.reconstruct(idx).tolist()
        scene_embeddings.append({
            "vector_id": idx,
            "scene_id": scene_id,
            "location_id": item.get("location_id"),
            "acquisition_date": item.get("acquisition_date"),
            "cloud_percentage": item.get("cloud_percentage"),
            "sensor": item.get("sensor"),
            "platform": item.get("platform"),
            "tags": item.get("tags", []),
            "image_path": item.get("image_path"),
            "vector": vec,
        })

    with open(public_data_dir / "scene_embeddings.json", "w", encoding="utf-8") as f:
        json.dump({
            "dimension": index.d,
            "metric": "cosine_similarity (IndexFlatIP)",
            "total_scenes": len(scene_embeddings),
            "scenes": scene_embeddings,
        }, f, indent=2)
    print(f"  Serialized {len(scene_embeddings)} scene vectors to scene_embeddings.json")

    print("Step 5: Pre-computing CLIP embeddings for benchmark queries...")
    clip_model = CLIPEmbeddingModel()
    
    preset_queries = [
        # Official benchmark queries
        "urban expansion and new construction near river",
        "water reservoir shoreline drying and lake shrinkage",
        "forest road clearing corridor and tree removal",
        "coastal port reclamation and ocean harbor pier",
        "solar panel farm photovoltaic arrays in desert terrain",
        # Quick UI chip queries
        "rapid urban expansion near water",
        "reservoir shoreline retreat",
        "linear forest clearance corridor",
        "coastal land reclamation port",
        "photovoltaic solar park in desert",
        # Additional natural queries
        "deforestation and road construction",
        "water body drought and drying",
        "industrial port expansion",
        "desert solar energy facility",
        "urban buildings and roads",
        "forest canopy loss",
        "lake water reduction",
        "harbor shipping terminal",
        "solar energy field",
        "high density city construction",
    ]

    query_embeddings = {}
    for q in preset_queries:
        emb = clip_model.embed_text(q).tolist()
        query_embeddings[q.lower().strip()] = emb

    with open(public_data_dir / "query_embeddings.json", "w", encoding="utf-8") as f:
        json.dump({
            "dimension": 512,
            "model": "openai/clip-vit-base-patch32",
            "queries": query_embeddings,
        }, f, indent=2)
    print(f"  Serialized {len(query_embeddings)} query embeddings to query_embeddings.json")

    print("Step 6: Pre-computing change detection analysis results...")
    ms = MetadataService()
    ds = DatasetService(metadata_service=ms)
    detector = DeterministicBiTemporalChangeDetector(output_dir=str(masks_src))
    tas = TemporalAnalysisService(metadata_service=ms, dataset_service=ds, change_detector=detector)

    analysis_cache = {}
    for loc in ms.get_all_locations():
        pair = tas.load_temporal_pair(loc)
        res = tas.analyze_pair(pair)
        analysis_cache[loc.location_id] = res.model_dump()

    with open(public_data_dir / "change_analysis_cache.json", "w", encoding="utf-8") as f:
        json.dump(analysis_cache, f, indent=2)
    print(f"  Serialized change analysis results for {len(analysis_cache)} locations.")

    print("\n[SUCCESS] Web assets and serialized vectors ready in web/public!")


if __name__ == "__main__":
    main()
