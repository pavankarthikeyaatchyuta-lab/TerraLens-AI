# TerraLens AI - Index Directory

This directory stores vector indexes and embedding caches for semantic satellite imagery retrieval.

## Architecture (Phase 2 Roadmap)

1. **FAISS Index (`satellite_embeddings.index`)**:
   - Multi-modal embeddings generated from satellite image tiles and semantic captions using vision-language models (e.g., Remote Sensing CLIP / OpenCLIP).
   - Enables sub-second cosine/L2 nearest neighbor searches across tens of thousands of satellite scenes.

2. **Embedding Metadata Mapping (`index_metadata.json`)**:
   - Maps vector indices to `location_id`, `scene_id`, and bounding coordinates.

## Status in Phase 1
- **Status**: Not initialized (Phase 1 utilizes structured metadata & lexical filtering engine).
- **Future Integration**: The `RetrievalService` has been engineered with a pluggable interface to immediately swap in FAISS in Phase 2.
