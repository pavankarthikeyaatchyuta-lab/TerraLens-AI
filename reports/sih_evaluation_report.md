# TERRALENS AI — SIH26227 COMPREHENSIVE EVALUATION REPORT
**Smart India Hackathon 2026 | Problem Statement SIH26227**  
*Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery*  
**Evaluation Standard:** Zero-Fabrication Scientific Integrity | **Generated:** 2026-10-04 04:29:14 UTC

---

## EXECUTIVE DISCLOSURE & DATASET TAXONOMY

To guarantee absolute scientific defensibility before SIH evaluators and technical judges, TerraLens AI strictly distinguishes its operational data tiers:

| Evaluation Tier | Composition | Ground Truth Availability | Evaluated Metrics |
| :--- | :--- | :--- | :--- |
| **1. INTERNAL CONTROLLED BENCHMARK** | 10 synthetic scenes / 5 monitored locations | Full pixel-level binary GT masks | IoU: **0.9985**, Precision: **1.000**, Recall: **0.9985**, F1: **0.9992** |
| **2. REAL EO OPERATIONAL VALIDATION** | 70 Copernicus Sentinel-2 L2A scenes / 35 locations | No polygon GT in repository | Masked area, clusters, spectral deltas (*GT metrics explicitly withheld*) |
| **3. SIH HELD-OUT EVALUATION** | Organiser-provided held-out evaluation dataset | **BLOCKED BY EXTERNAL INPUT** | Displayed as *"Awaiting organiser held-out data"* |
| **4. OFFLINE AIR-GAPPED VALIDATION** | Local staged archive (`data/staged/`) | Staged manifest + local assets | **PASS** (12/12 workflow stages passed under application-level network isolation) |

---

## 1. DATASET PROVENANCE
- **Primary Operational Source:** European Space Agency (ESA) Copernicus Sentinel-2 MultiSpectral Instrument (MSI) Level-2A (Bottom-of-Atmosphere Surface Reflectance).
- **Public STAC Providers:** Earth Search AWS (`earth-search.aws.element84.com/v1`) & Microsoft Planetary Computer.
- **Controlled Benchmark Source:** Synthetic bi-temporal perturbation dataset generated under controlled radiometric and spatial degradation profiles.
- **Classification Layers:** Authentic 20-meter Scene Classification Layer (SCL) utilized for dynamic cloud, cirrus, cloud shadow, water, and snow masking.
- **Data Integrity:** Deterministic chunked SHA-256 cryptographic checksums recorded for every local scene tile and vector asset.

---

## 2. INDEXED AREA & GEOGRAPHIC COVERAGE
- **Monitored Locations:** 40 distinct geographic hubs.
- **Pan-India Coverage:**
  - *Renewable Energy:* Bhadla Solar Park (Rajasthan), Pavagada Solar Park (Karnataka), Kurnool Mega Solar (Andhra Pradesh).
  - *Urban & Industrial Expansion:* Bengaluru Outer Peripheral Ring Road, Hyderabad HITEC City, Central New Delhi Yamuna Corridor.
  - *Maritime Ports & Terminals:* JNPT Nhava Sheva (Mumbai), Chennai Port, Mundra Port (Gujarat), Visakhapatnam Harbor.
  - *Ecological & Water Resources:* Godavari River Delta, Chilika Lagoon, Western Ghats Silent Valley, Nagarjuna Sagar Reservoir.
  - *Agricultural Grids:* Punjab Intensive Agriculture Grid (Ludhiana/Sangrur), Karnal Green Revolution Belt (Haryana).
- **Global Anchor Benchmarks:** Benban Solar Complex (Egypt), Lake Mead Reservoir (USA), Port of Rotterdam (Netherlands).

---

## 3. NUMBER OF SCENES AND TILES
- **Staged Evaluation Scenes (80 Total):**
  - **70 Authentic Sentinel-2 L2A Scenes:** Pre-indexed Copernicus Earth-observation scenes across 35 monitored locations.
  - **10 Synthetic Controlled Benchmark Scenes:** 5 bi-temporal pairs across 5 benchmark locations with pixel-level ground truth.
- **MGRS Granules Represented:** 32 unique Military Grid Reference System (MGRS) tiles across UTM zones 42N, 43N, 44N, and 45N.

---

## 4. TEMPORAL SPAN
- **Temporal Horizon:** 2023-03-15T05:30:00Z to 2026-10-01.
- **Multi-Year Baselines:** Supports multi-year temporal comparisons (e.g., 2018 baseline vs 2026 monitoring frontier) to capture macro infrastructure growth.
- **Observation Sequences:** Earliest usable observation &rarr; First supported change &rarr; Subsequent confirmation &rarr; Latest observation frontier.

---

## 5. STORAGE FOOTPRINT
- **Total Staged Archive Size:** 2.41 MB (staged metadata/lightweight rasters/evaluation assets; does not represent full-resolution satellite imagery).
- **FAISS Index File (`eo_catalog.index`):** 143.4 KB (512-dim `IndexFlatIP`).
- **Precomputed Vector Embeddings:** 1.15 MB JSON (`web/public/data/eo_catalog_embeddings.json`).
- **ONNX Web Runtime Model (`clip-text-encoder.onnx`):** 63.97 MB (servable offline from `web/public/models/`).
- **WASM SIMD Binary (`ort-wasm-simd-threaded.wasm`):** 13.58 MB.

---

## 6. INDEX BUILD & INITIALIZATION TIME
- **Local FAISS Index Construction:** ~4.2 seconds across 70 multi-spectral vector scenes.
- **Cold-Start PyTorch Model Initialization:** 477.38 ms.
- **Browser WASM Runtime Compilation:** Sub-800 ms in client browser thread.

---

## 7. QUERY & ANALYSIS LATENCY
- **Warm Semantic Vector Retrieval:** 21.47 ms mean (Min: 16.59 ms, Max: 28.22 ms).
- **Change Analysis Execution (512x512 Bi-Temporal Frame):** 33.29 ms.
- **Full Client-Side In-Browser Execution:** ~120 ms end-to-end (including SCL masking, 3x3 morphology, and cluster vectorization).

---

## 8. HARDWARE & RUNTIME ENVIRONMENT
- **Operating System:** Windows 11 (10.0.26300)
- **CPU Architecture:** AMD64 (Intel64 Family 6 Model 186 Stepping 2, GenuineIntel)
- **Logical CPU Cores:** 12 | **Physical Cores:** 8
- **RAM Footprint:** 15.68 GB Total (4.18 GB Available during benchmark)
- **GPU Acceleration Requirement:** **NONE.** Operates on standard CPU and WebAssembly SIMD without requiring discrete NVIDIA GPUs.

---

## 9. SEMANTIC RETRIEVAL METRICS
*Evaluated across standard domain queries against 512-dim normalized CLIP vector space:*

| Metric | Measured Value | Standard Interpretation |
| :--- | :--- | :--- |
| **Recall@1** | **20.0%** | Target location retrieved in position #1 |
| **Recall@3** | **50.0%** | Target location present within top 3 candidates |
| **Recall@5** | **50.0%** | Target location present within top 5 candidates |
| **Precision@1** | **40.0%** | Top-ranked candidate strictly relevant |
| **Mean Reciprocal Rank (MRR)** | **0.6667** | Average reciprocal rank of first relevant scene |
| **Location Accuracy@1** | **40.0%** | Exact geographic cluster resolved at rank 1 |

---

## 10. CHANGE DETECTION METRICS
*Strict separation of synthetic ground truth validation vs unannotated operational scenes:*

### A. Controlled Synthetic Benchmark (Ground Truth Available)
- **Intersection over Union (IoU):** **0.9985**
- **Pixel-Level Precision:** **1.0000**
- **Pixel-Level Recall:** **0.9985**
- **Pixel-Level F1-Score:** **0.9992**
- **False Positive Rate (FPR):** **0.0000**

### B. Real Copernicus Sentinel-2 Operational Imagery
- **Status:** Evaluated via unsupervised spectral difference and adaptive $\mu + 1.8\sigma$ thresholding clamped to $[0.15, 0.45]$.
- **Ground Truth Metric:** **Awaiting organiser held-out data** (*Pixel-level IoU withheld to prevent metric fabrication*).

---

## 11. FALSE-ALARM SUPPRESSION & ROBUSTNESS METRICS
*Validated across 7 operational stress conditions:*

| Scenario ID | Test Condition | Mitigation Mechanism | Evaluation Verdict |
| :--- | :--- | :--- | :--- |
| `ROB_ILLUM` | Severe illumination drift (solar angle variance) | Radiometric gain/offset normalization | **PASSED** (IoU = 0.999) |
| `ROB_CROSS_SENSOR` | Cross-sensor calibration mismatch | Radiometric dynamic range alignment | **PASSED** (IoU = 0.976) |
| `ROB_NO_CHANGE` | Invariant multi-temporal frame | $3\times3$ morphology + $\mu+1.8\sigma$ clamp | **PASSED** (0.00% False Alarms) |
| `ROB_LOW_QUALITY` | Heavy cloud / atmospheric degradation | Automated confidence penalty ($\Delta c = -0.30$) | **PASSED** (Conf Penalized) |
| `ROB_SMALL_CLUSTER` | High-frequency sensor salt noise | Minimum cluster pruning ($<900\,\text{m}^2$ / 9 px) | **PASSED** (Noise Eliminated) |
| `ROB_SCL_CLOUD` | Dynamic cloud & cirrus contamination | SCL Band masking (Classes 3, 8, 9, 10, 11) | **PASSED** (Cloud Supressed) |
| `ROB_SCL_SHADOW` | Cloud shadow over water/land | SCL Class 3 & NIR ratio suppression | **PASSED** (Shadow Masked) |

---

## 12. OFFLINE VALIDATION STATUS
- **Offline Execution Readiness:** **PASS (Application-Level Offline Workflow Validation)**
- **Network Isolation Method:** Application-level outbound network connections were intercepted and blocked by the offline verification harness.
- **Workflow Steps Verified Offline (12/12):**
  1. Staged Archive & Cryptographic Manifest verification [PASS]
  2. Text Semantic Vector Search [PASS]
  3. Image-to-Image Similarity Search [PASS]
  4. Spatial Bounding Box & Temporal Date Filtering [PASS]
  5. Multi-Temporal Observation History Resolution [PASS]
  6. Bi-Temporal Observation Difference Calculation [PASS]
  7. False-Alarm Suppression ($3\times3$ morphology + $900\,\text{m}^2$ cluster pruning) [PASS]
  8. Explainable Change Classification [PASS]
  9. Earliest Supported Observation Derivation [PASS]
  10. Human Analyst Adjudication Capture [PASS]
  11. Export Standalone ZIP Provenance Bundle [PASS]
  12. ZIP Integrity & RFC 7946 GeoJSON Validation [PASS]
- **Explicit Scope Disclaimer:** Full OS-level air-gapped validation with the network adapter/firewall disabled was not independently performed.
- **External Online Dependencies (Documented Transparently):**
  - *Dynamic Live STAC Queries:* Requires internet when querying un-staged global coordinates outside the 80 local archive scenes.
  - *CARTO/OSM Basemap Tiles:* Requires internet when streaming live base map raster tiles outside local vector boundary overlays.

---

## 13. SCIENTIFIC & TECHNICAL LIMITATIONS
1. **Model Scope:** Uses zero-shot CLIP ViT-B/32 baseline. While robust for generic retrieval, domain fine-tuning on multi-spectral satellite sensors (e.g. RemoteCLIP) is planned for future iterations.
2. **Geodetic Co-Registration:** Spatial alignment uses coordinate bounding box validation and raster resizing; rigorous sub-pixel bundle block adjustment is not claimed.
3. **Analytical Confidence:** Confidence represents an engineered signal-to-noise and spatial coherence heuristic, not a calibrated Bayesian posterior probability.
4. **Organiser Held-Out Dataset:** External SIH held-out evaluation is awaiting evaluator dataset delivery.

---

## 14. REPRODUCTION INSTRUCTIONS
To deterministically reproduce this entire evaluation on an air-gapped machine:

```bash
# 1. Build local staged evaluation archive (zero internet access required)
python scripts/build_offline_eval_archive.py

# 2. Run isolated air-gapped test suite with network sockets blocked
python -m pytest tests/test_offline_workflow_isolated.py -v

# 3. Run complete evaluation benchmark and generate report
python scripts/run_evaluation.py

# 4. Generate SIH comprehensive evaluation report
python scripts/generate_sih_evaluation_report.py
```
