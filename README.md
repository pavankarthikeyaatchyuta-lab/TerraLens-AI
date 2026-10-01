# TerraLens AI: Semantic Satellite Intelligence for Multi-Temporal Change Analysis

**Smart India Hackathon 2026 (SIH 2026)**  
**Problem Statement ID:** SIH26227  
**Operational Status:** Phase 4 Complete (Evaluation, End-to-End Hardening & Hackathon Demo Readiness)

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
COMPARE (Multi-temporal satellite imagery alignment & dimension normalization)
   ↓
ANALYZE (Deterministic change detection + morphological false-alarm mitigation)
   ↓
VERIFY (Measurable confidence scoring + provenance audit + analyst adjudication)
   ↓
EVALUATE & EXPORT (Precision/Recall/IoU verification + JSON dossier + Markdown report)
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
│   │   ├── temporal_view.py        # Multi-temporal comparison, change detection & mask display
│   │   ├── evidence_panel.py       # Evidence dossier, audit trail, export buttons & review
│   │   ├── evaluation_view.py      # Dedicated evaluation & benchmark dashboard tab
│   │   ├── sidebar.py              # Navigation and live FAISS/CLIP/Temporal system status
│   │   └── image_viewer.py         # Resilient image rendering & placeholder fallbacks
│   ├── services/
│   │   ├── change_detector.py      # BaseChangeDetector & DeterministicBiTemporalChangeDetector
│   │   ├── alignment_service.py    # Spatial alignment, shape check & dimension normalization
│   │   ├── temporal_service.py     # Temporal pairing, analyze_pair pipeline & diagnostics
│   │   ├── embedding_service.py    # BaseEmbeddingModel, CLIP baseline & Mock model
│   │   ├── index_service.py        # FAISS IndexFlatIP cosine similarity manager
│   │   ├── retrieval_service.py    # SemanticEmbeddingRetrievalService & Metadata fallback
│   │   ├── dataset_service.py      # Archive scanner, integrity checks & path resolver
│   │   ├── metadata_service.py     # Schema validation and metadata query filters
│   │   └── provenance_service.py   # Audit step construction & evidence dossier builder
│   ├── evaluation/
│   │   ├── retrieval_metrics.py    # Recall@K, Precision@K, MRR, latency calculation
│   │   ├── change_metrics.py       # Pixel confusion matrix, Precision, Recall, F1, IoU
│   │   ├── robustness.py           # 7-scenario robustness & stress testing suite
│   │   ├── system_metrics.py       # Latency, memory, index storage & platform profiling
│   │   ├── benchmark.py            # Comprehensive BenchmarkRunner orchestrator
│   │   └── report.py               # Markdown and JSON benchmark report generators
│   ├── models/
│   │   ├── change.py               # Pydantic ChangeRegion & ChangeDetectionResult schemas
│   │   ├── scene.py                # Pydantic Scene schema (sensor, date, cloud, path)
│   │   ├── location.py             # Pydantic Location and BoundingBox schemas
│   │   └── evidence.py             # Pydantic Evidence, ProvenanceStep, and Trace schemas
│   └── utils/
│       ├── export_utils.py         # JSON dossier & Markdown intelligence report exporters
│       ├── config.py               # Environment configuration & path manager
│       ├── image_utils.py          # Safe loaders, thumbnail generators, placeholders
│       └── geo_utils.py            # Coordinate formatting, haversine & bounding checks
├── data/
│   ├── metadata/
│   │   └── locations.json          # Validated satellite catalog
│   ├── evaluation/
│   │   ├── retrieval_queries.json  # 5 benchmark queries across domains with ground-truth
│   │   ├── change_benchmark_pairs.json # Benchmark pairs manifest (GT-annotated + unannotated)
│   │   └── change_ground_truth/    # Controlled synthetic pixel-level ground truth masks
│   ├── samples/                    # Realistic multi-temporal benchmark scenes (2023 vs 2025)
│   │   ├── LOC_001_HYDERABAD_URBAN/
│   │   ├── LOC_002_GODAVARI_RESERVOIR/
│   │   ├── LOC_003_WESTERN_GHATS_FOREST/
│   │   ├── LOC_004_CHENNAI_COASTAL/
│   │   └── LOC_005_THAR_SOLAR_PARK/
│   └── outputs/
│       └── change_masks/           # Persisted change masks, difference heatmaps & overlays
├── indexes/
│   ├── satellite_embeddings.index          # Real FAISS IndexFlatIP vector index
│   ├── satellite_embeddings_metadata.json  # Vector ID to scene metadata mapping
│   └── README.md                           # Index architecture & validation guide
├── tests/
│   ├── test_e2e_workflow.py        # 13-stage end-to-end integration workflow test
│   ├── test_evaluation.py          # Retrieval & change detection metric validation tests
│   ├── test_robustness.py          # 7 stress scenarios & suite execution tests
│   ├── test_export.py              # JSON & Markdown dossier export tests
│   ├── test_change_detection.py    # Multi-temporal change detection & false-alarm tests
│   ├── test_semantic_retrieval.py  # CLIP embedding, text search, similar image tests
│   ├── test_index.py               # FAISS index creation, persistence & validation tests
│   ├── test_metadata.py            # Pydantic validation & catalog query tests
│   ├── test_dataset.py             # Archive discovery & image loader tests
│   ├── test_retrieval.py           # Lexical & filter retrieval tests
│   ├── test_temporal.py            # Temporal pairing & alignment tests
│   └── test_provenance.py          # Lineage trace & adjudication tests
├── scripts/
│   ├── run_evaluation.py           # Standalone benchmark runner (JSON & Markdown outputs)
│   ├── build_embedding_index.py    # Builds & saves FAISS vector index from archive
│   └── generate_sample_dataset.py  # Benchmark dataset generator
├── evaluation_report.md            # Benchmark report artifact
├── evaluation_results.json         # Raw benchmark metrics JSON artifact
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Implemented Capabilities vs. Roadmap

To uphold scientific and engineering integrity, TerraLens AI strictly distinguishes between **implemented capabilities** and **planned future deep learning extensions**:

### ✅ IMPLEMENTED (Phases 1, 2, 3, and 4)

#### Phase 1: Modular Foundation & Data Layer
- [x] **Pydantic Strict Data Models:** `Scene`, `Location`, `BoundingBox`, `Evidence`, `ProvenanceStep`, `ProvenanceTrace`.
- [x] **Catalog & Archive Services:** `MetadataService` and `DatasetService` with filesystem validation.
- [x] **Interactive Geospatial Dashboard:** Streamlit UI with Folium satellite layers and dynamic navigation.

#### Phase 2: Real Semantic Retrieval + Vector Index
- [x] **Real Vision-Language Embeddings:** `openai/clip-vit-base-patch32` (*CLIP baseline*) generating 512-dimensional normalized vector embeddings for text and satellite imagery.
- [x] **FAISS Vector Indexing:** Real `faiss.IndexFlatIP` structure computing sub-second exact cosine similarity scores.
- [x] **Cross-Modal Text Search:** Natural language search (e.g., *"new buildings near a river"*, *"reservoir water retreat"*) ranked by real cosine similarity without hardcoded scores.
- [x] **Image-to-Image Search & Discovery:** Visual embedding search and neighbor discovery across geographic locations.
- [x] **Resilient Fallback Mode:** Automatic fallback to `PrototypeMetadataRetrievalService` if vector index is missing or model fails to load.

#### Phase 3: Multi-Temporal Change Detection & False-Alarm Reduction
- [x] **Deterministic Bi-Temporal Change Detector:** `DeterministicBiTemporalChangeDetector` computing luminance deltas without fake uncalibrated neural claims on tiny benchmark datasets.
- [x] **Spatial Alignment & Dimension Normalization:** `ImageAlignmentService` checking spatial dimensions and resizing monitoring scenes to baseline space.
- [x] **Radiometric Illumination Matching:** Top-of-atmosphere gain and offset matching to normalize solar angle and atmospheric differences.
- [x] **Morphological False-Alarm Mitigation:** Opening (erodes isolated salt-and-pepper pixel noise) + Closing (bridges contiguous infrastructure boundaries) with configurable kernel sizes.
- [x] **Connected Component Analysis & Region Extraction:** Clusters changed pixels into discrete `ChangeRegion` components, filtering out noise smaller than minimum area thresholds.
- [x] **Transparent Measurable Confidence Formulation:**
  $$\text{Confidence} = 0.45 \times \text{SignalStrength} + 0.35 \times \text{SpatialCoherence} + 0.20 \times \text{QualityScore} - \text{Penalty}$$
  Directly derived from signal contrast, cluster coherence, dynamic range, and sensor mismatch penalties.
- [x] **Raster Artifact Persistence:** Automatically generates and persists binary masks, colorized difference heatmaps, and highlight overlay PNGs in `data/outputs/change_masks/`.
- [x] **End-to-End Audit Lineage:** Complete trace recorded in `Evidence` dossier (`PREPROCESSING_ALIGNMENT`, `TEMPORAL_CHANGE_DETECTION`, `FALSE_ALARM_FILTERING`, `CONFIDENCE_EVALUATION`, `ANALYST_ADJUDICATION`).

#### Phase 4: Evaluation, End-to-End Hardening & Hackathon Demo Readiness
- [x] **Modular Evaluation Framework (`terralens/app/evaluation/`):** Standalone engine computing Recall@K, Precision@K, MRR, latency, pixel confusion matrices, F1, IoU, and false-positive rates.
- [x] **Honest Ground-Truth Separation:** Controlled synthetic pixel masks for exact mathematical evaluation; real catalog scenes explicitly report `"Ground truth unavailable — metric not computed."` rather than fabricating synthetic scores.
- [x] **7-Scenario Robustness Testing Suite:** Automated stress tests for no-change, verified change, degraded image quality, extreme illumination shifts (+40 brightness), seasonal phenology, spatial dimension mismatch, and cross-sensor comparison.
- [x] **Exportable Intelligence Dossiers:** Downloadable audit dossiers in structured JSON and executive Markdown formats, complete with analyst adjudication status and provenance steps.
- [x] **Interactive Evaluation Tab:** Live in-dashboard benchmark runner displaying retrieval recall bars, pixel metrics, robustness pass/fail badges, and downloadable reports.
- [x] **End-to-End Integration Verification:** Automated 13-stage test asserting full user journey from query to export.
- [x] **Comprehensive Test Suite:** **44 unit, integration, and end-to-end tests passing** across all modules with 100% pass rate.

### ⏳ PLANNED (Future Extension Roadmap)
- [ ] **Remote Sensing Fine-Tuned Model:** Upgrading from generic *CLIP baseline* to specialized Earth Observation vision-language models (e.g. RemoteCLIP / GeoRSCLIP).
- [ ] **Pluggable Deep Change Detection:** ChangeFormer / Siamese UNet implementations implementing `BaseChangeDetector` once large-scale pre-training datasets are indexed.
- [ ] **Deep Cloud & Shadow Masking:** Integration of s2cloudless or Fmask for multi-spectral cloud probability masks.

---

## 5. Multi-Temporal Change Detection Pipeline

```
Baseline Scene (T1) + Monitoring Scene (T2)
                     ↓
        Image Validation & Dynamic Range Check
                     ↓
        Spatial Alignment & Dimension Normalization
                     ↓
        Radiometric Illumination Calibration (Mean & Std matching)
                     ↓
        Absolute Luminance Pixel Difference (|T2_norm - T1|)
                     ↓
        Sensitivity Thresholding (diff >= threshold)
                     ↓
        Morphological Noise Suppression (Opening + Closing)
                     ↓
        Connected Component Analysis (Min area cluster filter)
                     ↓
        Measurable Confidence Scoring & Cross-Sensor Advisory
                     ↓
        Artifact Generation (Binary Mask, Difference Heatmap, Overlay)
                     ↓
        Provenance Dossier & Analyst Adjudication Review
```

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

### 4. Run the Evaluation Suite & Benchmark Runner
```bash
python scripts/run_evaluation.py
```
This executes the automated benchmark suite across retrieval, change detection, robustness (7 stress scenarios), and system timing, writing structured results to:
- `evaluation_results.json`: Machine-readable performance metrics.
- `evaluation_report.md`: Human-readable benchmark and audit report.

### 5. Run the Complete Test Suite
```bash
python -m pytest -v
```
*Expected: 44 passed in ~12s (100% pass rate).*

### 6. Launch the Python Research Prototype (Streamlit)
```bash
streamlit run terralens/app/main.py
```
Open `http://localhost:8501` in your browser. This runs the full scientific Python environment (PyTorch, CLIP ViT-B/32, FAISS IndexFlatIP, and OpenCV).

---

## 8. Dual-Track Deployment Architecture

TerraLens AI supports two deployment targets tailored for research rigor and public hackathon evaluation:

```
                    TERRALENS AI
                         |
             +-----------+-----------+
             |                       |
      RESEARCH TRACK           PUBLIC DEMO
             |                       |
         Streamlit             Next.js / React
             |                       |
     PyTorch + CLIP + FAISS        Vercel
             |                       |
       Full scientific         Lightweight APIs
          pipeline                  |
                               Static benchmark
                                  assets
```

### Track A: Research Prototype (Local / Server Target)
- **Framework:** Streamlit (`terralens/app/main.py`)
- **Backend:** Python 3.13, PyTorch, HuggingFace Transformers, CLIP ViT-B/32, FAISS C++ IndexFlatIP, OpenCV.
- **Purpose:** Full algorithmic experimentation, live embedding generation, automated evaluation harness, and 45-test regression verification.
- **Run Command:** `streamlit run terralens/app/main.py`

### Track B: Public Demo (Vercel Production Target)
- **Framework:** Next.js 14, React 18, TypeScript, Tailwind CSS (`web/`)
- **Runtime:** Vercel Serverless Edge & Node.js Runtime (zero-cold-start, $<20\text{ ms}$ response).
- **Positioning:** *Controlled Benchmark Demo* — evaluates supported benchmark queries using pre-indexed 512-dimensional normalized vectors and pre-computed bitemporal change artifacts.
- **No Heavy ML Dependencies:** Completely excludes PyTorch, Transformers, and FAISS from serverless bundles, ensuring high operational reliability and avoiding out-of-memory crashes.
- **Run Command Locally:**
  ```bash
  cd web
  npm install
  npm run dev
  ```
- **Deployment Guide:** See [VERCEL_DEPLOYMENT.md](file:///c:/Users/pavan/OneDrive/Pictures/Desktop/TerraLens%20AI/VERCEL_DEPLOYMENT.md) for full configuration.

---

## 9. Evaluation & Benchmark Summary

Results from automated benchmark run (`scripts/run_evaluation.py`):

| Evaluation Category | Metric | Measured Value | Mathematical Definition / Standard |
|:---|:---|:---|:---|
| **Semantic Retrieval** | Mean Recall@1 | **0.20** | Fraction of relevant benchmark items retrieved in top 1 result |
| **Semantic Retrieval** | Mean Recall@3 | **0.50** | Fraction of relevant benchmark items retrieved in top 3 results |
| **Semantic Retrieval** | Mean Recall@5 | **0.50** | Fraction of relevant benchmark items retrieved in top 5 results |
| **Semantic Retrieval** | Mean Reciprocal Rank (MRR) | **0.667** | Mean Reciprocal Rank over benchmark queries |
| **Semantic Retrieval** | Warm Mean Query Latency | **21.47 ms** | Steady-state search latency over FAISS index |
| **Semantic Retrieval** | Cold-Start Model Initialization | **~2.5 s** | One-time CLIP model weight loading into memory |
| **Change Detection (Controlled Synthetic GT)** | Precision | **1.0000** | Zero false alarm rate on controlled synthetic GT |
| **Change Detection (Controlled Synthetic GT)** | Recall | **0.9985** | Complete change boundary capture |
| **Change Detection (Controlled Synthetic GT)** | F1-Score | **0.9992** | Balanced change segmentation |
| **Change Detection (Controlled Synthetic GT)** | Intersection over Union (IoU) | **0.9985** | High-fidelity spatial overlap |
| **Robustness Suite** | Pass Rate | **7 / 7 (100%)** | All 7 stress scenarios passed |
| **Inference Latency** | Bi-Temporal Change Detection | **32.64 ms** | Sub-100ms real-time analysis |

*Important Scientific Disclosures:*
- **Benchmark Limitation:** The 5-query semantic retrieval set is a small manually defined benchmark; results indicate prototype behavior and are not a production-scale accuracy estimate.
- **Controlled Synthetic Benchmark Notice:** Change metrics (Precision, Recall, F1, IoU) are measured on controlled synthetic verification pairs to mathematically validate detector algorithms. They **do not represent performance on independently annotated real satellite imagery**, where ground truth is unannotated and metrics are honestly reported as unavailable.
- **Invariant Scene Convention:** When both prediction and ground truth contain zero changed pixels, Precision, Recall, F1, and IoU are defined as 1.0 (empty set agreement convention for non-events), and FPR is 0.0.

---

## 9. Current Limitations & Scientific Notes
- **Dataset Scale:** Current prototype archive contains 10 benchmark scenes across 5 monitored locations.
- **CLIP Baseline:** Uses `openai/clip-vit-base-patch32` (*CLIP baseline*), a general vision-language model, rather than a domain-specific satellite foundation model.
- **Deterministic Baseline Detector:** The Phase 3/4 change detector uses deterministic radiometric difference and morphological filtering. While robust and defensible on small datasets, it does not perform semantic change classification (e.g., distinguishing urban construction from agricultural harvesting without contextual prompts).
- **Ground-Truth Annotation:** Unannotated catalog scenes do not have pixel-level ground truth masks; only controlled synthetic pairs have mathematical pixel annotations.
- **Provenance Trace Lineage:** The system records up to 10 granular chronological steps across query ingestion, embedding generation, FAISS vector search, candidate location retrieval, source image loading, spatial alignment, change detection, morphological false-alarm filtering, confidence evaluation, and human analyst adjudication.
- **Index Mode:** The current FAISS index uses `IndexFlatIP` (exact search). For scaling to millions of tiles, `IndexIVFFlat` or `IndexHNSW` is recommended.