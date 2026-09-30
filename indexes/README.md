# TerraLens AI - Index Directory

This directory stores vector indexes and embedding caches for semantic satellite imagery retrieval.

## Operational Architecture (Phase 2)

1. **FAISS Index (`satellite_embeddings.index`)**:
   - High-performance vector similarity search structure utilizing `faiss.IndexFlatIP`.
   - Dimension: **512** (float32).
   - Metric: **Cosine Similarity** (achieved via L2 unit-normalized vectors + inner product).
   - Stores dense multi-modal embeddings generated from satellite image tiles using `openai/clip-vit-base-patch32` (CLIP baseline).

2. **Embedding Metadata Mapping (`satellite_embeddings_metadata.json`)**:
   - Direct positional mapping between FAISS vector IDs (`0..N-1`) and satellite catalog entities:
     - `location_id`
     - `scene_id`
     - `acquisition_date`
     - `sensor`
     - `platform`
     - `image_path`
     - `cloud_percentage`
     - `tags`

## Building and Rebuilding the Index

To regenerate the vector index across the satellite archive:

```bash
python scripts/build_embedding_index.py
```

## Validation Protocol

The `IndexService` automatically validates before querying:
- Binary index existence and accessibility.
- JSON metadata mapping integrity.
- Exact match between vector count in FAISS (`ntotal`) and metadata `total_vectors`.
- Dimensional compatibility (512-dim).
- Referenced imagery existence on disk.
