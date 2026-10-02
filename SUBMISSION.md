# TerraLens AI — Smart India Hackathon 2026 Submission Document

**Problem Statement ID:** SIH26227  
**Problem Statement Title:** Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery  
**Team / Project Name:** TerraLens AI  
**Repository:** [https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI](https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI)  
**Verification Status:** 126/126 Automated Tests Passing | Next.js 17/17 Routes Compiled | Phase 5B Scientific Validation Complete  

### Team Members & Contributors
- **Baddireddy Leela Krishna** ([@leelakrishna18](https://github.com/leelakrishna18)) — Team Leader & Semantic Retrieval Pipeline
- **Atchyuta Pavan Karthikeya** ([@pavankarthikeyaatychuta-lab](https://github.com/pavankarthikeyaatychuta-lab)) — Team Member & System Architecture
- **Hemanth Maddula** ([@hemanthmaddula146-sudo](https://github.com/hemanthmaddula146-sudo)) — Multi-Temporal Change & Geospatial Engine
- **Divija Jangam** ([@divijajangam](https://github.com/divijajangam)) — Web Application & Analyst Interface
- **Anjana Janyavula** ([@Anjana-Janyavula](https://github.com/Anjana-Janyavula)) — Evaluation Suite, QA & Robustness Benchmarking
- **Busireddy Mohan Narayana Reddy** ([@Mohanreddy-lab](https://github.com/Mohanreddy-lab)) — Backend Engineering, Systems & Pre-Flight Auditing

---

## 2.1 Background

Earth-observation archives are rapidly expanding with multi-temporal, multi-spectral, and multi-sensor imagery. Conventional catalogues allow analysts to search using metadata such as coordinates, acquisition date, sensor, and product type, but they still require the analyst to know *where* and *when* to look. TerraLens AI addresses this discovery gap by enabling semantic search over satellite imagery while combining it with spatial, temporal, and sensor context.

The system is designed around semantic representation, multi-temporal analysis, geospatial provenance, and quality-aware change verification. It aims to help analysts discover relevant locations from natural-language descriptions, compare observations across time, suppress false changes caused by imaging conditions, and preserve the evidence and processing history associated with each result.

---

## 2.2 Detailed Description

TerraLens AI is a semantic satellite-imagery retrieval and multi-temporal change-analysis platform designed for analyst-driven Earth-observation discovery.

The system follows the workflow:

$$\text{SEARCH} \longrightarrow \text{DISCOVER} \longrightarrow \text{COMPARE} \longrightarrow \text{VERIFY}$$

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

*Scientific Integrity Notice:* Real-scene polygon-level ground truth is explicitly identified as unavailable where applicable, and those metrics are therefore not presented as measured real-scene performance.

The current implementation has **126 automated tests passing** (100% pass rate across Python, geospatial, and end-to-end workflow test suites), with the Next.js production build compiling all **17 routes successfully** including Phase 4B real bi-temporal Sentinel-2 change analysis (`/api/satellite/analyze`), Phase 5A end-to-end analyst workflow with interactive cluster selection, adjudication, and signed intelligence dossier export (`/api/export`), and Phase 5B comprehensive scientific, geodesic, and geometric validation.

---

## 2.5 Innovation

The key differentiator of TerraLens AI is the combination of:

$$\mathbf{Semantic\ Discovery} \;+\; \mathbf{Multi\text{-}Temporal\ Verification} \;+\; \mathbf{Evidence\ Provenance}$$

1. **Natural Language Geospatial Discovery:** Instead of requiring an analyst to know the exact coordinates or bounding box before inspecting imagery, TerraLens allows the analyst to begin with a semantic description (e.g., *"rapid reservoir shoreline retreat"*).
2. **Deterministic & Quality-Aware Verification:** Pairs semantic candidates with multi-temporal imagery, applies radiometric illumination matching, and filters out atmospheric/phenological false alarms through morphological clustering.
3. **Audit Trail & Human-in-the-Loop Sovereign Lineage:** Every analytical conclusion is accompanied by a granular provenance trace and an analyst adjudication station (`TRUE CHANGE`, `FALSE ALARM`, `UNCERTAIN`), exportable as signed intelligence dossiers.

The system therefore treats satellite-image retrieval and change analysis as a connected, auditable intelligence workflow rather than as isolated search and change-detection components.
