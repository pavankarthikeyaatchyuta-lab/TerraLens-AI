# TerraLens AI — Smart India Hackathon 2026 Submission Document

**Problem Statement ID:** SIH26227  
**Problem Statement Title:** Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery  
**Team Name:** The Limit Breakers (Project: TerraLens AI)  
**Repository:** [https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI](https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI)  
**Verification Status:** 218/218 Python Passing | 17/17 Web Passing (235 total automated tests) | Next.js 14/14 Routes Compiled (0 errors) | Phase 11 Analyst Export & Provenance Complete  

### Team Roster & Domain Roles
- **Baddireddy Leela Krishna** ([@leelakrishna18](https://github.com/leelakrishna18)) — Team Leader, Semantic Retrieval & Embedding Pipeline
- **Atchyuta Pavan Karthikeya** ([@pavankarthikeyaatychuta-lab](https://github.com/pavankarthikeyaatychuta-lab)) — System Architecture, Satellite Provider Abstraction & Cloud Infrastructure
- **Hemanth Maddula** ([@hemanthmaddula146-sudo](https://github.com/hemanthmaddula146-sudo)) — Geospatial Analytics & Multi-Temporal Change Engine
- **Divija Jangam** ([@divijajangam](https://github.com/divijajangam)) — Full-Stack Web Application & Analyst Interface
- **Anjana Janyavula** ([@Anjana-Janyavula](https://github.com/Anjana-Janyavula)) — QA, Evaluation Suite & Robustness Benchmarking
- **Busireddy Mohan Narayana Reddy** ([@Mohanreddy-lab](https://github.com/Mohanreddy-lab)) — Backend Engineering, Systems & Pre-Flight Auditing

---

## 2.1 Background

Earth-observation archives are rapidly expanding with multi-temporal, multi-spectral, and multi-sensor imagery. Conventional catalogues allow analysts to search using metadata such as coordinates, acquisition date, sensor, and product type, but they still require the analyst to know *where* and *when* to look. TerraLens AI addresses this discovery gap by enabling semantic search over satellite imagery while combining it with spatial, temporal, and sensor context.

The system is designed around semantic representation, multi-temporal analysis, geospatial provenance, and quality-aware change verification. It aims to help analysts discover relevant locations from natural-language descriptions, compare observations across time, suppress false changes caused by imaging conditions, and preserve the evidence and processing history associated with each result.

---

## 2.2 Detailed Description

TerraLens AI is a semantic satellite-imagery retrieval and multi-temporal change-analysis platform designed for analyst-driven Earth-observation discovery.

The system follows the 5-stage evidence-first workflow:

$$\text{SEARCH} \longrightarrow \text{DISCOVER} \longrightarrow \text{COMPARE} \longrightarrow \text{VERIFY} \longrightarrow \text{EXPORT}$$

### 1. Semantic and Multimodal Retrieval

Users can submit natural-language queries such as:
- *"newly built structures near a river"*
- *"reservoir drying"*
- *"forest corridor"*
- *"coastal development"*
- *"solar park"*

The system represents imagery and queries in a common embedding space and ranks candidate locations using normalized vector similarity. Results can be associated with spatial, temporal, and sensor metadata.

Image-to-image similarity can also be used to discover visually or semantically comparable locations.

### 2. Multi-Temporal Change Analysis

After a relevant location is identified, TerraLens compares imagery from different time periods to identify meaningful changes such as:
- Construction and expansion
- Land clearance
- Water-extent variation
- Road development

The temporal analysis produces pixel-level change information and groups connected changed pixels into interpretable spatial clusters.

### 3. False-Alarm Suppression and Quality Handling

Change analysis treats imaging differences as potential confounding factors rather than automatically interpreting every difference as real-world change.

The processing workflow includes:

$$\text{Image Alignment} \longrightarrow \text{Radiometric / Contrast Normalization} \longrightarrow \text{Pixel Comparison} \longrightarrow \text{Thresholding} \longrightarrow \text{Morphological Filtering} \longrightarrow \text{Connected-Component Clustering} \longrightarrow \text{Evidence Generation}$$

The system also exposes analytical confidence and change telemetry to support analyst review.

### 4. Discovery and Clustering

Semantic retrieval allows an analyst to move beyond a single known location. Once a relevant site is identified, the embedding-based archive can surface other locations with comparable visual or semantic characteristics.

This supports discovery across the indexed archive without requiring the analyst to manually construct an independent query for every location.

### 5. Analyst Workflow and Provenance

Each candidate can be reviewed using:
- Ranked semantic matches
- Geographic location
- Acquisition dates
- Sensor profile
- Before / after imagery
- Detected change regions
- Analytical confidence
- Processing history
- Evidence / provenance information

The analyst can explicitly adjudicate a candidate as:

$$\mathbf{TRUE\ CHANGE} \quad\big|\quad \mathbf{FALSE\ ALARM} \quad\big|\quad \mathbf{UNCERTAIN}$$

The initial state remains **UNREVIEWED**, ensuring that automated detection is not represented as analyst confirmation. Exported evidence retains the relevant source-scene and processing information.

### 6. Scale, Incremental Ingestion, and Sovereignty

The research architecture uses vector indexing for efficient semantic retrieval and supports the addition of newly acquired imagery through an incremental ingestion workflow.

The complete research stack is designed for local / on-premises operation after required models, libraries, and datasets have been staged. The architecture preserves geospatial and acquisition metadata and is intended to support common Earth-observation formats including GeoTIFF / COG.

### 7. Public Demonstration

The deployed TerraLens AI interface provides a **Controlled Benchmark Mode** using pre-indexed 512-dimensional normalized vectors and controlled benchmark imagery. The public demonstration separates contextual geographic mapping from the temporal analysis imagery and explicitly identifies synthetic benchmark scenes.

The complete research pipeline remains available separately from the lightweight public demonstration layer.

---

## 2.3 Expected Solution / Technical Approach

TerraLens AI consists of two complementary layers:

### A. Research / Offline Pipeline

```
Satellite Imagery
       ↓
Preprocessing & Quality Handling
       ↓
Feature / Semantic Representation
       ↓
Normalized Vector Index
       ↓
Semantic Retrieval
       ↓
Candidate Locations
       ↓
Multi-Temporal Alignment
       ↓
Radiometric Normalization
       ↓
Change Detection
       ↓
Cluster & Evidence Generation
       ↓
Analyst Adjudication
       ↓
Provenance-Preserving Export
```

### B. Public Demonstration Layer

```
Next.js 14 Interface
       ↓
Benchmark Retrieval APIs
       ↓
Pre-indexed 512-D Vectors
       ↓
Candidate Locations
       ↓
Context Map (Google Satellite Hybrid / Streets / Esri / Tactical)
       ↓
Temporal Comparison
       ↓
Change Analysis
       ↓
Evidence / Evaluation
```

The research implementation uses Python, PyTorch/Transformers, CLIP-based semantic representation, FAISS, OpenCV, and Streamlit, while the public demonstration uses a lightweight Next.js/Vercel layer with precomputed benchmark artifacts.

---

## 2.4 Evaluation

TerraLens AI provides reproducible evaluation of both retrieval and controlled change-analysis components.

### Audited Retrieval Measurements

| Metric | Measured Value | Standard / Description |
|:---|:---|:---|
| **Recall@1** | **20.0%** (0.2000) | Fraction of relevant benchmark items retrieved at rank 1 |
| **Recall@3** | **50.0%** (0.5000) | Fraction of relevant benchmark items retrieved in top 3 |
| **Recall@5** | **50.0%** (0.5000) | Fraction of relevant benchmark items retrieved in top 5 |
| **Mean Reciprocal Rank (MRR)** | **0.6667** | Average reciprocal rank of first relevant item |
| **Target Location Hit@1** | **40.0%** (0.4000) | Fraction of queries where top retrieved scene is from target location |
| **Precision@1** | **40.0%** (0.4000) | Fraction of top-ranked retrieved items that are relevant |
| **Warm Retrieval Benchmark Latency** | **21.47 ms** | Steady-state query search latency over vector index |
| **Cold-Start Model Initialization** | **477 ms** | Model weight initialization into memory |

### Controlled Synthetic Change-Analysis Evaluation

| Metric | Measured Value | Description |
|:---|:---|:---|
| **Mean Precision** | **1.0000** | Zero false alarm rate on controlled synthetic ground truth |
| **Mean Recall** | **0.9985** | High-fidelity change boundary recovery |
| **Mean F1-Score** | **0.9992** | Balanced harmonic mean of precision and recall |
| **Mean IoU** | **0.9985** | Intersection over Union against ground-truth mask |
| **Robustness Suite** | **7 / 7 (100%)** | All 7 environmental stress scenarios passing |
| **Bi-Temporal Analysis Latency** | **32.64 ms** | Real-time edge inference latency |

### Evaluation Data Status & SIH26227 Reproducibility

TerraLens AI uses publicly available Sentinel-2 imagery for its real Earth-observation workflow and maintains a controlled synthetic benchmark for deterministic regression testing. The SIH organiser's held-out evaluation imagery is treated as an external evaluation input and is not claimed as part of the team's benchmark unless officially provided.

1. **Public Real EO Demonstration Data (Sentinel-2 L2A):** Used for end-to-end operational workflow validation (e.g., Bhadla Solar Park). Real Sentinel-2 Bhadla imagery was used to validate the end-to-end operational workflow; this demonstration does not constitute labelled accuracy evaluation.
2. **Internal Controlled Synthetic Benchmark:** Used for deterministic algorithmic regression testing, invariant checks, and 7 environmental stress tests against explicit pixel ground truth. These numbers validate algorithm code, not real satellite accuracy.
3. **Locally Staged Offline Evaluation Data:** 80 staged evaluation scenes: 70 authentic Sentinel-2 L2A scenes + 10 synthetic controlled benchmark scenes (total footprint 2.41 MB of staged metadata/lightweight rasters/evaluation assets; does not represent full-resolution satellite imagery). Ingested via `scripts/build_offline_eval_archive.py` and `scripts/stage_local_dataset.py` with deterministic SHA-256 checksums and standard manifest generation.
4. **SIH Organiser Held-Out Evaluation Data:** **BLOCKED BY EXTERNAL INPUT** — organiser-held-out evaluation data is not present in the repository. The staging pipeline and evaluation harness (`scripts/run_evaluation.py`) are fully architected to consume organizer data upon delivery.
5. **Offline Execution Readiness (PASS):** Validated via isolated test suite (`tests/test_offline_workflow_isolated.py` and `scripts/verify_offline_mode.py`) where application-level outbound network connections were intercepted and blocked by the offline verification harness. 12/12 workflow stages passed under application-level network isolation (staged archive, text semantic search, image search, spatial filters, temporal history, bi-temporal comparison, false-alarm suppression, change classification, earliest supported observation, analyst adjudication, ZIP bundle export, GeoJSON validation). Full OS-level air-gapped validation with the network adapter/firewall disabled was not independently performed. Two non-blocking external runtime services (dynamic live STAC queries for un-staged coordinates and live basemap tile streaming) require internet connectivity and are documented.

The current implementation has **218 Python tests passing** and **17 Web tests passing** (235 total automated tests, 100% pass rate across Python, geospatial, change engine, export bundles, and isolated air-gapped test suites), with the Next.js production build compiling all **14 routes successfully** including real Sentinel-2 change analysis (`/api/satellite/analyze`), full analyst export bundle suite (`/api/export`), and complete provenance validation.

---

## 2.5 Innovation & Competitive Positioning

> **Core Philosophy:**  
> *"TerraLens doesn't stop at detecting change. It makes that change searchable, explainable, verifiable and auditable."*  
> Evidence-first satellite intelligence for finding, explaining, verifying and documenting temporal change.

The key architectural differentiators of TerraLens AI are structured across the 5-stage loop ($\text{SEARCH} \to \text{DISCOVER} \to \text{COMPARE} \to \text{VERIFY} \to \text{EXPORT}$):

1. **Semantic Discovery vs. Known Coordinates:** Instead of forcing an analyst to know exact bounding boxes or lat/long coordinates, TerraLens enables zero-shot natural-language search (`"solar park development in Rajasthan"`, `"rapid reservoir shoreline retreat"`) mapped to 512-dimensional CLIP embeddings with sub-25ms vector retrieval across regional catalogs.
2. **Usable Observation History vs. Arbitrary Pair Selection:** Rather than picking arbitrary bi-temporal snapshots that risk comparing seasonal clouds or snow, TerraLens reconstructs the complete observation history across Sentinel-2 archives, automatically identifying *Earliest Usable Observation*, *First Supported Change*, *Subsequent Confirmation*, and *Latest Observation*.
3. **Multi-Stage False-Alarm Suppression vs. Naive Differencing:** Replaces uncalibrated pixel differencing or black-box overlays with an auditable multi-stage pipeline: Raw Spectral Difference $\to$ Scene Classification Layer (SCL) Quality Masking $\to$ Radiometric Normalization ($\mu + 1.8\sigma$ clamped $[0.15, 0.45]$) $\to$ $3\times3$ Morphological Filtering $\to$ Minimum Cluster Area Filter ($\ge 900\,\text{m}^2$ / 9 px).
4. **Analyst-in-the-Loop Adjudication vs. Black-Box AI Overlay:** AI generates candidate evidence rather than asserting definitive conclusions. The human analyst reviews signal-to-noise ratio, coherence, and cloud mask coverage, and adjudicates the verdict (`UNREVIEWED` $\to$ `TRUE CHANGE`, `FALSE ALARM`, `UNCERTAIN`) with domain interpretation notes.
5. **Auditable Evidence Dossier vs. Static Screenshots:** Instead of exporting a lossy PNG/JPEG screenshot, TerraLens generates a portable, auditable PKZIP Evidence Dossier containing `manifest.json`, `analysis.json`, `provenance.json` (structured processing history, scene identifiers, analysis parameters, outputs, analyst decisions, and machine-readable evidence artifacts), RFC 7946 Polygon `change_clusters.geojson` for instant GIS ingestion, and an operational Markdown brief.

The system therefore treats satellite-image retrieval and change analysis as a connected, auditable intelligence workflow rather than as disconnected search and vision prototypes.
