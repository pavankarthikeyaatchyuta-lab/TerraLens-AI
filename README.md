# TerraLens AI: Semantic Satellite Intelligence for Multi-Temporal Change Analysis

**Smart India Hackathon 2026 (SIH 2026)**  
**Problem Statement ID:** SIH26227  
**Team Name:** The Limit Breakers  
**Operational Status:** Phase 6 Complete (SIH 2026 Final Demo & Submission Hardening)  
**Live Public Demo:** [https://terra-lens-ai.vercel.app/](https://terra-lens-ai.vercel.app/)  
**Automated Tests:** 126/126 Passing (100% Pass Rate) | Next.js 17/17 Production Routes Compiled  
**Official SIH Submission:** [SUBMISSION.md](SUBMISSION.md)

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
├── web/                            # Production Web Application (Next.js 14 + Vercel)
│   ├── app/
│   │   ├── layout.tsx              # Root layout & font definition
│   │   ├── page.tsx                # Main mission-control dashboard
│   │   ├── globals.css             # Tailwind styling & Leaflet map z-index isolation
│   │   └── api/
│   │       ├── health/route.ts     # Operational health & dataset integrity check
│   │       ├── locations/route.ts  # Catalog locations endpoint
│   │       ├── scenes/route.ts     # Satellite scenes catalog endpoint
│   │       ├── search/route.ts     # CLIP exact cosine similarity vector retrieval
│   │       ├── analyze/route.ts    # Bitemporal change detection engine
│   │       ├── export/route.ts     # Intelligence dossier JSON & Markdown generator
│   │       └── evaluation/route.ts # Authoritative evaluation benchmark suite
│   ├── components/
│   │   ├── Header.tsx              # Mission telemetry header & live benchmark indicators
│   │   ├── SearchBar.tsx           # Natural language query input & quick-select queries
│   │   ├── SceneCatalog.tsx        # Deduplicated candidate location results
│   │   ├── TacticalMap.tsx         # Leaflet tactical map (ESRI World Imagery + CARTO/OSM)
│   │   ├── TemporalComparison.tsx  # T1 Baseline vs T2 Monitoring visual inspection
│   │   ├── ChangeMaskViewer.tsx    # Change mask & difference overlay toggles
│   │   ├── ConfidenceCard.tsx      # Transparent confidence metric formula breakdown
│   │   ├── EvidencePanel.tsx       # Provenance audit lineage & human analyst adjudication
│   │   └── EvaluationModal.tsx     # Authoritative benchmark metrics verification modal
│   ├── lib/
│   │   ├── data.ts                 # Validated locations, scenes, and benchmark query pairs
│   │   └── vector.ts               # Exact 512-D cosine similarity vector calculations
│   └── public/
│       ├── data/                   # Static JSON embeddings, metadata & evaluation results
│       └── samples/                # Benchmark scenes and verified change masks
├── evaluation_report.md            # Benchmark report artifact
├── evaluation_results.json         # Raw benchmark metrics JSON artifact
├── SUBMISSION.md                   # Official SIH 2026 Submission Document (Sections 2.1-2.5)
├── VERCEL_DEPLOYMENT.md            # Production deployment runbook
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

#### Phase 5: Production Vercel Deployment & Web Architecture Hardening
- [x] **Dual-Track Deployment Architecture:** High-availability Next.js 14 web application deployed on Vercel Edge/Serverless ([terra-lens-ai.vercel.app](https://terra-lens-ai.vercel.app/)) without heavy Python/PyTorch dependencies.
- [x] **Client/Edge Exact Cosine Similarity Engine:** Executes normalized 512-dimensional CLIP embedding dot-product operations in sub-2ms in pure TypeScript with zero cold-start delay.
- [x] **Interactive Multi-Layer Tactical Map:** Dual-mode mapping supporting ESRI World Imagery (High-Resolution Satellite) and CARTO Voyager (Tactical Vector/Raster) with automatic graceful fallback to OpenStreetMap if no CARTO API key is supplied.
- [x] **Deduplicated Location Candidate Retrieval:** Groups and deduplicates scenes by canonical location ID, surfacing the top-matching spatial scenes per target site.
- [x] **Interactive Bitemporal Change Inspection:** Side-by-side comparison of Baseline (T1) and Monitoring (T2) scenes with toggleable binary change masks and difference heatmaps.
- [x] **Human-in-the-Loop Analyst Adjudication:** Analysts can review automated findings and assign immutable verdicts (`TRUE CHANGE`, `FALSE ALARM`, `UNCERTAIN`), with an unreviewed default state.
- [x] **Single-Source-of-Truth Benchmark Modal:** Directly ingests `evaluation_results.json` to render live Recall@K, Precision@K, MRR, Target Location Hit@1, pixel metrics, and robustness results with zero hardcoded discrepancies.
- [x] **Multi-Format Intelligence Dossier Export:** Downloadable JSON dossiers and executive Markdown reports via `/api/export` encapsulating full sensor metadata, detection metrics, confidence scores, and analyst audit trails.
- [x] **Comprehensive Test Suite:** **45 unit, integration, and end-to-end tests passing** across all modules with 100% pass rate.

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
*Expected: 45 passed (100% pass rate).*

### 6. Launch the Python Research Prototype (Streamlit)
```bash
streamlit run terralens/app/main.py
```
Open `http://localhost:8501` in your browser. This runs the full scientific Python environment (PyTorch, CLIP ViT-B/32, FAISS IndexFlatIP, and OpenCV).

### 7. Launch the Production Web Application (Next.js)
```bash
cd web
npm install
npm run dev
```
Open `http://localhost:3000` in your browser.  
*(Optional)* Create `web/.env.local` and set `NEXT_PUBLIC_CARTO_API_KEY=your_key` to enable CARTO Voyager tactical tiles. If omitted, the tactical map layer automatically and gracefully falls back to OpenStreetMap tiles with complete attribution and zero broken images.

---

## 8. Dual-Track Deployment Architecture

TerraLens AI supports two deployment targets tailored for research rigor and public hackathon evaluation:

```
                    TERRALENS AI
                         |
             +-----------+-----------+
             |                       |
      RESEARCH TRACK           PUBLIC DEMO (LIVE)
             |                       |
         Streamlit             Next.js 14 / React 18
             |                       |
     PyTorch + CLIP + FAISS        Vercel Serverless
             |                       |
       Full scientific         Sub-20ms Response APIs
          pipeline                   |
                              Pre-indexed Vector DB
                                     &
                              Bitemporal Artifacts
```

### Track A: Research Prototype (Local / Server Target)
- **Framework:** Streamlit (`terralens/app/main.py`)
- **Backend:** Python 3.13, PyTorch, HuggingFace Transformers, CLIP ViT-B/32, FAISS C++ IndexFlatIP, OpenCV.
- **Capabilities:** Full algorithmic experimentation, live embedding generation across new images, automated evaluation harness, and 45-test regression verification suite.
- **Run Command:** `streamlit run terralens/app/main.py`

### Track B: Public Demo (Vercel Production Deployment)
- **Live URL:** [https://terra-lens-ai.vercel.app/](https://terra-lens-ai.vercel.app/)
- **Framework:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS (`web/`)
- **Runtime:** Vercel Serverless Edge & Node.js Runtime (zero-cold-start, $<20\text{ ms}$ response).
- **Positioning:** *Controlled Benchmark Demo* — evaluates supported benchmark queries using pre-indexed 512-dimensional normalized vectors and pre-computed bitemporal change artifacts.
- **Interactive Mapping:** Dual-mode Leaflet tactical mapping supporting ESRI World Imagery (High-Resolution Satellite) and CARTO Voyager tactical basemap (with automatic graceful fallback to OpenStreetMap if no API key is configured).
- **Analyst Adjudication Workflow:** Human-in-the-loop review station allowing defense and environmental analysts to record explicit verdicts (`TRUE CHANGE`, `FALSE ALARM`, `UNCERTAIN`) with an unreviewed default state.
- **Candidate Deduplication:** Automatic grouping by canonical location ID (`LOC_001` through `LOC_005`), surfacing the most relevant spatial scene per site.
- **Dossier & Report Exporter:** Direct client downloads of structured JSON evidence dossiers and executive Markdown intelligence reports via `/api/export`.
- **Zero Heavy ML Bloat:** Completely excludes PyTorch, Transformers, and heavy C++ bindings from serverless bundles, ensuring high operational reliability and preventing out-of-memory crashes on serverless edge runtimes.
- **Deployment Guide:** See [VERCEL_DEPLOYMENT.md](file:///c:/Users/pavan/OneDrive/Pictures/Desktop/TerraLens%20AI/VERCEL_DEPLOYMENT.md) for full configuration.

---

## 9. Evaluation & Benchmark Summary

Authoritative results from automated benchmark run (`scripts/run_evaluation.py` / `evaluation_results.json`):

| Evaluation Category | Metric | Measured Value | Mathematical Definition / Standard |
|:---|:---|:---|:---|
| **Semantic Retrieval** | Mean Recall@1 | **0.20** | Fraction of relevant benchmark items retrieved in top 1 result |
| **Semantic Retrieval** | Mean Recall@3 | **0.50** | Fraction of relevant benchmark items retrieved in top 3 results |
| **Semantic Retrieval** | Mean Recall@5 | **0.50** | Fraction of relevant benchmark items retrieved in top 5 results |
| **Semantic Retrieval** | Mean Precision@1 | **0.40** | Fraction of top 1 retrieved items that are relevant |
| **Semantic Retrieval** | Target Location Hit@1 | **0.40 (40%)** | Fraction of queries where top retrieved scene is from target location |
| **Semantic Retrieval** | Mean Reciprocal Rank (MRR) | **0.667** | Mean Reciprocal Rank over benchmark queries |
| **Semantic Retrieval** | Warm Mean Query Latency | **21.47 ms** | Steady-state search latency over FAISS index |
| **Semantic Retrieval** | Cold-Start Model Initialization | **477 ms** | Initial CLIP model weight loading into memory |
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

## 10. Current Limitations & Scientific Notes
- **Dataset Scale:** Current prototype archive contains 10 benchmark scenes across 5 monitored locations.
- **CLIP Baseline:** Uses `openai/clip-vit-base-patch32` (*CLIP baseline*), a general vision-language model, rather than a domain-specific satellite foundation model.
- **Deterministic Baseline Detector:** The Phase 3/4 change detector uses deterministic radiometric difference and morphological filtering. While robust and defensible on small datasets, it does not perform semantic change classification (e.g., distinguishing urban construction from agricultural harvesting without contextual prompts).
- **Ground-Truth Annotation:** Unannotated catalog scenes do not have pixel-level ground truth masks; only controlled synthetic pairs have mathematical pixel annotations.
- **Provenance Trace Lineage:** The system records up to 10 granular chronological steps across query ingestion, embedding generation, FAISS vector search, candidate location retrieval, source image loading, spatial alignment, change detection, morphological false-alarm filtering, confidence evaluation, and human analyst adjudication.
- **Index Mode:** The current FAISS index uses `IndexFlatIP` (exact search). For scaling to millions of tiles, `IndexIVFFlat` or `IndexHNSW` is recommended.

---

## 11. Live Public Satellite Data Architecture (Copernicus Sentinel-2 L2A STAC)

In addition to deterministic Controlled Benchmark Mode, TerraLens AI supports **Live Public Data Mode** for real-time Earth-observation discovery across the European Space Agency (ESA) Copernicus Sentinel-2 archive via SpatioTemporal Asset Catalog (STAC) endpoints:

```
[ Analyst AOI Selection ] (Map Drawing or Manual Bounds)
           ↓
[ LiveAOISearch.tsx ]
           ↓
[ satelliteClient.ts ] (Client-Side API Layer)
           ↓
[ POST /api/satellite/search ] (Server-Side Proxy)
           ↓
[ CopernicusSentinelProvider ]
     ├── Primary: Microsoft Planetary Computer STAC
     └── Fallback: AWS Earth Search (Element 84)
           ↓
[ Standardized SatelliteScene[] ] (Metadata, Cloud Cover %, Previews)
```

### Six Dedicated Server-Side API Endpoints:
- `POST /api/satellite/search`: Validates geographic bounding boxes (`min_lat`, `min_lon`, `max_lat`, `max_lon`) and date windows (`startDate`, `endDate`), querying public STAC catalogs with structured timeout/error handling (400, 502, 504).
- `POST /api/satellite/pairs`: Discovers temporal before/after scene pairs matching user-defined day intervals (14–730 days) and cloud thresholds.
- `GET /api/satellite/scene/[sceneId]`: Retrieves immutable Sentinel-2 tile metadata, asset references, and true-color previews.
- `POST /api/satellite/assets`: Discovers georeferenced raster analysis assets (e.g. 10m/20m COGs) and segregates them from preview thumbnails with AOI subwindow compatibility calculations.
- `POST /api/satellite/prepare`: Validates temporal pairs, verifies CRS/resolution compatibility, coordinates spatial dimension reconciliation, and constructs immutable provenance evidence for change detection.
- `POST /api/satellite/analyze`: Executes the complete Phase 4B scientific bi-temporal Sentinel-2 change analysis pipeline on calibrated surface reflectance tiles, generating GeoJSON change polygons and provenance records.

### Phase 4A: Real Sentinel-2 Analysis Asset Foundation
- **Preview vs. Analysis Asset Segregation:**
  - *Preview Assets* (`rendered_preview`, `thumbnail`, `image/png`, `image/jpeg`): Restricted strictly to UI visualization and prohibited from scientific processing.
  - *Analysis Assets* (`visual`, `B02`, `B03`, `B04`, `B08`, `image/tiff; profile=cloud-optimized`): Georeferenced Cloud-Optimized GeoTIFFs (COGs) possessing coordinate reference systems (CRS: EPSG:326xx), affine transforms, and native 10m/20m spatial resolutions.
- **AOI Subwindow Windowing Strategy:**
  - Eliminates multi-gigabyte SAFE archive downloads by projecting user AOIs into raster pixel offsets (`colOff`, `rowOff`, `width`, `height`).
  - Enables HTTP partial range requests (Status 206), reducing data transfer from ~800 MB full granules to ~5.1 MB subwindows.
- **Dimension Reconciliation & Image Alignment:**
  - Evaluates native coordinate reference systems and establishes reprojection grids when UTM zones differ without claiming fake georeferencing.
- **Immutable Provenance Records:**
  - Captures complete audit chain (`PROV-...`), timestamps, processing levels (Level-2A Bottom-of-Atmosphere), sensor instruments, and step-by-step verification history.

### Phase 4B: Real Bi-Temporal Sentinel-2 Change Analysis Engine
- **Quality Masking (SCL / Validity):**
  - Evaluates ESA Sentinel-2 Scene Classification Layer (SCL) classes (0–11) to mask out cloud pixels (classes 8, 9, 10), cloud shadows (class 3), defective pixels (class 1), snow/ice (class 11), and nodata (class 0).
  - Explicitly reports valid surface observation percentage, clouds suppressed, and shadows suppressed.
- **Surface Reflectance Normalization:**
  - Converts Level-2A Bottom-of-Atmosphere (BOA) Digital Numbers to physical surface reflectance via scale factor 0.0001 ($DN / 10000.0$).
- **Deterministic Radiometric Illumination Matching:**
  - Adjusts gain and offset across valid surface pixels between before and after acquisitions to compensate for sun elevation disparities and atmospheric variations.
- **Multi-Spectral Difference Indices:**
  - Computes Normalized Difference Vegetation Index (NDVI) safely with zero-division handling: $\text{NDVI} = \frac{\text{NIR} - \text{Red}}{\text{NIR} + \text{Red}}$.
  - Formulates multi-spectral change score combining $\Delta\text{NDVI}$, $\Delta\text{Red}$, and $\Delta\text{NIR}$.
- **Adaptive Statistical Thresholding:**
  - Employs data-driven threshold formulation ($\mu + 1.8\sigma$ clamped in $[0.15, 0.45]$) avoiding arbitrary magic numbers.
- **Morphological False-Alarm Mitigation:**
  - Applies $3\times3$ morphological opening to eliminate isolated pixel noise, followed by $3\times3$ morphological closing to consolidate coherent change boundaries.
- **Connected Components Spatial Clustering:**
  - Groups changed pixels into spatial clusters via 8-connectivity.
  - Enforces minimum cluster area filtering (default $900\text{ m}^2$ or 9 pixels) to suppress speckle noise.
  - Transforms pixel bounding boxes into geographic coordinates ($[\text{lat}, \text{lon}]$), computing exact area in $\text{m}^2$, hectares, and $\text{km}^2$.
- **Explainable Change Classification:**
  - Categorizes each cluster using canonical spectral signatures:
    - `BUILT_UP_CONSTRUCTION`: Red surface reflectance surge ($\Delta\text{Red} > +0.08$) with vegetation suppression ($\Delta\text{NDVI} < -0.04$).
    - `VEGETATION_LOSS / CLEARANCE`: Significant vegetation loss ($\Delta\text{NDVI} < -0.15$) with increased bare soil/surface exposure.
    - `VEGETATION_GROWTH`: Significant vegetation vigor gain ($\Delta\text{NDVI} > +0.15$).
    - `WATER_VARIATION`: Sharp NIR attenuation ($\Delta\text{NIR} < -0.10$) characteristic of inundation or reservoir level change.
    - `OTHER / UNCERTAIN`: Unambiguous or mixed spectral transitions.
- **Explainable Confidence Score Formulation:**
  - Produces continuous confidence scores in $[0.20, 0.98]$ synthesized from change magnitude, spatial coherence (logarithmic cluster size), and spectral signal consistency.
- **Standard GeoJSON FeatureCollection:**
  - Outputs standard WGS84 GeoJSON polygons with cluster properties rendered directly on the interactive TacticalMap with popups and color-coded overlays.

### Mode Isolation & Data Honesty Guarantees:
- **Zero Fabrication:** Live Public Data Mode returns only verifiable open-access Copernicus metadata and real public Sentinel-2 assets.
- **No Silent Fallback:** If upstream STAC endpoints are unreachable, the system explicitly guides the analyst rather than substituting synthetic benchmark data.
- **Preview Disclosures:** Previews and thumbnails are explicitly labeled as *Preview* rather than full-resolution scientific rasters.

---

## 11. Phase 5B — End-to-End Scientific & Product Validation

The Phase 5B comprehensive audit verified the complete TerraLens AI workflow geometrically, scientifically, functionally, and operationally:

### 1. Geodesic & Raster Arithmetic Verification
- **Raster Analysis Tile:** $512 \times 512$ pixels at $10\text{ m}$ GSD $= 26,214,400\text{ m}^2 = 2,621.44\text{ ha}$ ($26.21\text{ km}^2$).
- **Changed Pixels & Area:** $11,767\text{ pixels} \times 100\text{ m}^2 = 1,176,700\text{ m}^2 = 117.6700\text{ ha}$.
- **Raster Footprint Percentage:** $\frac{117.67\text{ ha}}{2,621.44\text{ ha}} \times 100 = 4.4888\% \approx 4.49\%$ (Exact match with reported telemetry).
- **WGS-84 Ellipsoidal AOI:** Subwindow $[17.40^\circ\text{N}, 78.44^\circ\text{E}]$ to $[17.44^\circ\text{N}, 78.48^\circ\text{E}]$ computes to $1,881.38\text{ ha}$ ($6.254\%$ change density).
- **Cluster Sum Consistency:** $\sum_{i=1}^{19} \text{Area}(\text{Cluster}_i) = 117.6700\text{ ha}$ ($100.0\%$ arithmetic preservation).

### 2. Cluster Geometry & Scientific Class Verification
- **Geometry Validity:** All 19 spatial clusters export valid 5-point closed WGS-84 polygon boundaries strictly contained within target geographic extents.
- **Rule-Based Decision Logic:** All cluster classifications strictly adhere to implemented multi-spectral thresholds ($\Delta\text{NDVI}$, $\Delta\text{Red}$, $\Delta\text{NIR}$) with zero manual overrides.
- **Confidence Formulation:** Fully deterministic scoring within $[0.20, 0.98]$ reflecting signal contrast and spatial consistency, explicitly disclaiming calibrated probability.

### 3. Human-in-the-Loop Adjudication & Dossier Export
- **Non-Presumptive Default:** Every newly discovered cluster initializes strictly to `UNREVIEWED`.
- **Adjudication State Machine:** Verified bi-directional transitions (`UNREVIEWED` $\leftrightarrow$ `CONFIRMED` $\leftrightarrow$ `REJECTED`) with persistent operational notes.
- **Intelligence Export:** Full Markdown (`.md`) and JSON (`.json`) dossiers verify all 6 required sections with zero benchmark mock leakage.

---

## 12. Team: The Limit Breakers (Smart India Hackathon 2026)

| Name | GitHub Profile | Role | Focus Areas |
|:---|:---|:---|:---|
| **Baddireddy Leela Krishna** | [@leelakrishna18](https://github.com/leelakrishna18) | Team Leader & Retrieval Pipeline | Overall team leadership, semantic retrieval pipeline, CLIP multimodal embeddings, FAISS indexing |
| **Atchyuta Pavan Karthikeya** | [@pavankarthikeyaatychuta-lab](https://github.com/pavankarthikeyaatychuta-lab) | System Architecture & Cloud Infrastructure | System architecture, benchmark design, STAC provider abstraction, cloud deployment |
| **Hemanth Maddula** | [@hemanthmaddula146-sudo](https://github.com/hemanthmaddula146-sudo) | Geospatial Analytics & Change Engine | Geospatial analytics, spherical area calculations, spatial IoU, MGRS parsing |
| **Divija Jangam** | [@divijajangam](https://github.com/divijajangam) | Full-Stack Web Application & UI/UX | Full-stack Next.js web application, client-side STAC API SDK, interactive Leaflet integration |
| **Anjana Janyavula** | [@Anjana-Janyavula](https://github.com/Anjana-Janyavula) | QA, Evaluation Suite & Benchmarking | QA & evaluation suite, benchmark verification, robustness testing, documentation |
| **Busireddy Mohan Narayana Reddy** | [@Mohanreddy-lab](https://github.com/Mohanreddy-lab) | Backend Engineering & Systems Auditing | Backend architecture, server-side data pipeline integration, network boundary security, pre-flight auditing |
