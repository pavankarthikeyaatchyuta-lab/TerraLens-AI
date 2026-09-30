# TerraLens AI: Semantic Satellite Intelligence for Multi-Temporal Change Analysis

**Smart India Hackathon 2026 (SIH 2026)**  
**Problem Statement ID:** SIH26227  
**Operational Status:** Phase 2 Complete (Real Semantic Retrieval & FAISS Vector Index)

---

## 1. Problem Statement

Manual and coordinate-restricted analysis of multi-temporal satellite imagery presents significant bottlenecks for national monitoring agencies, defense bodies, environmental authorities, and urban planners:
- **Lexical/Coordinate Disconnect:** Analysts know *what* geospatial patterns they are searching for (e.g., *"new industrial construction near river beds"*, *"rapid reservoir shoreline retreat"*, *"illegal forest clearing corridors"*), but traditional GIS systems require manual tile selection or explicit bounding-box coordinates.
- **Temporal Comparison Overhead:** Comparing multi-temporal scenes across multiple years requires tedious manual registration, alignment, and radiometric calibration.
- **False-Alarm Vulnerability:** Naive pixel differencing generates thousands of false alarms due to seasonal vegetation cycles (phenology), atmospheric haze, sun angle variations, and cloud/shadow artifacts.
- **Black-Box AI Drift:** Modern deep-learning pipelines often fail to provide verifiable provenance, sensor auditability, or human-in-the-loop validation trails.

---

## 2. Solution: The TerraLens Workflow

TerraLens AI bridges natural language semantic retrieval and multi-temporal change verification through an end-to-end intelligence cycle:

```
SEARCH (Natural language query / reference image)
   ↓
DISCOVER (Semantic retrieval + similar candidate locations via FAISS)
   ↓
COMPARE (Multi-temporal satellite imagery registration)
   ↓
ANALYZE (Change detection + false-alarm mitigation)
   ↓
VERIFY (Confidence scoring + provenance audit + analyst adjudication)
```

---

## 3. System Architecture

```
terralens/
├── app/
│   ├── main.py                     # Streamlit application entrypoint with cached FAISS/CLIP
│   ├── components/
│   │   ├── search.py               # Semantic query bar, similar discovery, candidate cards
│   │   ├── map_view.py             # Interactive Folium map with satellite/topo layers
│   │   ├── temporal_view.py        # Side-by-side multi-temporal baseline vs. monitoring
│   │   ├── evidence_panel.py       # Evidence dossier, audit trail & analyst adjudication
│   │   ├── sidebar.py              # Navigation and live FAISS/CLIP system status
│   │   └── image_viewer.py         # Resilient image rendering & placeholder fallbacks
│   ├── services/
│   │   ├── embedding_service.py    # BaseEmbeddingModel, CLIP baseline & Mock model
│   │   ├── index_service.py        # FAISS IndexFlatIP cosine similarity manager
│   │   ├── retrieval_service.py    # SemanticEmbeddingRetrievalService & Metadata fallback
│   │   ├── dataset_service.py      # Archive scanner, integrity checks & path resolver
│   │   ├── metadata_service.py     # Schema validation and metadata query filters
│   │   ├── temporal_service.py     # Temporal pairing, alignment & change detector stubs
│   │   └── provenance_service.py   # Audit step construction & evidence dossier builder
│   ├── models/
│   │   ├── scene.py                # Pydantic Scene schema (sensor, date, cloud, path)
│   │   ├── location.py             # Pydantic Location and BoundingBox schemas
│   │   └── evidence.py             # Pydantic Evidence, ProvenanceStep, and Trace schemas
│   └── utils/
│       ├── config.py               # Environment configuration & path manager
│       ├── image_utils.py          # Safe loaders, thumbnail generators, placeholders
│       └── geo_utils.py            # Coordinate formatting, haversine & bounding checks
├── data/
│   ├── metadata/
│   │   └── locations.json          # Validated satellite catalog
│   └── samples/                    # Realistic multi-temporal benchmark scenes (2023 vs 2025)
│       ├── LOC_001_HYDERABAD_URBAN/
│       ├── LOC_002_GODAVARI_RESERVOIR/
│       ├── LOC_003_WESTERN_GHATS_FOREST/
│       ├── LOC_004_CHENNAI_COASTAL/
│       └── LOC_005_THAR_SOLAR_PARK/
├── indexes/
│   ├── satellite_embeddings.index          # Real FAISS IndexFlatIP vector index
│   ├── satellite_embeddings_metadata.json  # Vector ID to scene metadata mapping
│   └── README.md                           # Index architecture & validation guide
├── tests/
│   ├── test_semantic_retrieval.py  # CLIP embedding, text search, similar image tests
│   ├── test_index.py               # FAISS index creation, persistence & validation tests
│   ├── test_metadata.py            # Pydantic validation & catalog query tests
│   ├── test_dataset.py             # Archive discovery & image loader tests
│   ├── test_retrieval.py           # Lexical & filter retrieval tests
│   ├── test_temporal.py            # Temporal pairing & alignment tests
│   └── test_provenance.py          # Lineage trace & adjudication tests
├── scripts/
│   ├── build_embedding_index.py    # Builds & saves FAISS vector index from archive
│   └── generate_sample_dataset.py  # Benchmark dataset generator
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Phase 1 & 2 Capabilities vs. Roadmap

To uphold scientific and engineering integrity, TerraLens AI strictly distinguishes between **implemented capabilities** and **planned features**:

### ✅ IMPLEMENTED (Phases 1 & 2)
- [x] **Real Vision-Language Embeddings:** `openai/clip-vit-base-patch32` (*CLIP baseline*) generating 512-dimensional normalized vector embeddings for both text and satellite imagery.
- [x] **FAISS Vector Indexing:** Real `faiss.IndexFlatIP` structure storing dense image vectors and computing sub-second exact cosine similarity scores.
- [x] **Cross-Modal Text Search:** Natural language search (e.g., *"new buildings near a river"*, *"reservoir water retreat"*) ranked by real cosine similarity without hardcoded scores.
- [x] **Image-to-Image Search:** Reference satellite image upload embedding and similarity retrieval across the archive.
- [x] **Similar Location Discovery:** Clicking *"Find Similar"* on any location embeds its satellite observation, searches FAISS, excludes the target itself, and returns ranked similar geographic sites.
- [x] **Resilient Fallback Mode:** Automatic fallback to `PrototypeMetadataRetrievalService` if vector index is missing or model fails to load, with explicit UI status warnings.
- [x] **Retrieval Evidence & Provenance:** Audit trace recording `QUERY` → `EMBEDDING` → `VECTOR_SEARCH` → `RETRIEVED_LOCATION` → `SOURCE_IMAGES` with exact model names, index file references, and similarity values.
- [x] **Interactive Mapping & Temporal Viewer:** Folium map with satellite/topo layers, radar circles, and side-by-side baseline (2023) vs monitoring (2025) comparison.
- [x] **Comprehensive Test Suite:** 23 unit, integration, and end-to-end tests passing.

### ⏳ PLANNED (Phase 3 Roadmap)
- [ ] **Remote Sensing Fine-Tuned Model:** Upgrading from general *CLIP baseline* to specialized Earth Observation vision-language models (e.g. RemoteCLIP).
- [ ] **Automated Deep Change Detection:** Bi-temporal Siamese UNet / ChangeFormer architectures for automated change boundary extraction.
- [ ] **Pixel-Level Change Masks:** Generation of georeferenced GeoTIFF binary and categorical change heatmaps.
- [ ] **False-Alarm Mitigation Pipeline:** Deep cloud/cloud-shadow masking (Fmask/s2cloudless) and multi-seasonal phenology normalization.
- [ ] **Bayesian Confidence Calibration:** Statistical confidence scoring based on uncertainty estimation.

---

## 5. Semantic Retrieval Pipeline

```
Text Query ("new buildings near a river") OR Reference Satellite Image
                         ↓
         EmbeddingModel (CLIP baseline: 512-dim)
                         ↓
               L2 Vector Normalization
                         ↓
             FAISS IndexFlatIP Search
                         ↓
         Exact Cosine Similarities (Inner Product)
                         ↓
            Deduplication & Metadata Filtering
                         ↓
    Ranked Satellite Locations with Real Similarity Scores
```

> **Note on Model Type:** The current model is `openai/clip-vit-base-patch32` clearly designated as **"CLIP baseline"**. It is a generic vision-language model and has not yet been fine-tuned on multispectral satellite imagery.

---

## 6. Build or Rebuild the Semantic Index

To generate or rebuild the FAISS vector index across all satellite images in the archive:

```bash
python scripts/build_embedding_index.py
```

Output:
```text
============================================================
TerraLens AI — Semantic Satellite Vector Index Builder
============================================================
1. Discovered 10 scenes in metadata catalog.
2. Initializing Embedding Model...
   Model Name:          openai/clip-vit-base-patch32
   Model Label:         CLIP baseline
   Embedding Dimension: 512
3. Generating image embeddings across archive...
   [1/10] Indexed SCENE_LOC_001_HYDERABAD_URBAN_2023 (2023-03-15)
   ...
   [10/10] Indexed SCENE_LOC_005_THAR_SOLAR_PARK_2025 (2025-04-18)
4. Building FAISS IndexFlatIP (Cosine Similarity) with 10 vectors...
5. Index Validation:
   Status:    [OK] VALID
   Details:   Index and metadata verified successfully.
============================================================
```

---

## 7. Installation & Running Locally

### 1. Clone the Repository
```bash
git clone https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI.git
cd "TerraLens AI"
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Generate Benchmark Dataset & Vector Index
```bash
python scripts/generate_sample_dataset.py
python scripts/build_embedding_index.py
```

### 4. Run the Test Suite
```bash
python -m pytest -v
```

### 5. Launch the Dashboard
```bash
streamlit run terralens/app/main.py
```
Open `http://localhost:8501` in your browser.

---

## 8. Current Limitations
- **Dataset Size:** Current prototype archive contains 10 benchmark scenes across 5 locations.
- **Generic Vision-Language Model:** Uses `openai/clip-vit-base-patch32` (CLIP baseline), which is not yet fine-tuned for remote sensing spectral bands.
- **Temporal Change Detection:** Remains Phase 3 (automated change detection, cloud/shadow filtering, and raster change masking are not claimed to be implemented).
- **Global Indexing:** Current FAISS index is configured for local sandbox scale (`IndexFlatIP`). Large-scale deployment with millions of tiles will utilize `IndexIVFFlat` or `IndexHNSW`.