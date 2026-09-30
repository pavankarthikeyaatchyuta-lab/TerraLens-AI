# TERRALENS AI EVALUATION REPORT

**Smart India Hackathon 2026**  
**Problem Statement ID:** SIH26227  
**Benchmark Suite:** TerraLens AI Evaluation Suite v1.0.0  

---

## 1. Benchmark & Environment Summary

- **Total Monitored Locations:** 5
- **Total Satellite Scenes:** 10
- **Retrieval Queries in Suite:** 5
- **Change Analysis Pairs in Suite:** 4
- **Operating System:** Windows 11 (10.0.26300)
- **Python Version:** 3.13.14 (AMD64)
- **Processor:** Intel64 Family 6 Model 186 Stepping 2, GenuineIntel
- **Logical CPU Cores:** 12

---

## 2. Semantic Retrieval Evaluation

Cross-modal semantic search using normalized 512-dimensional CLIP baseline embeddings against a FAISS `IndexFlatIP` cosine similarity index:

- **Recall@1:** 0.2
- **Recall@3:** 0.5
- **Recall@5:** 0.5
- **Precision@1:** 0.4
- **Mean Reciprocal Rank (MRR):** 0.6667
- **Target Location Accuracy@1:** 0.4
- **Mean Query Latency:** 2122.62 ms

### Individual Query Performance
| Query ID / Text | Relevant Scenes | Retrieved @ 1 | Latency | R@1 | R@3 | R@5 | MRR |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *"urban expansion and new construction near river"* | 2 | `SCENE_LOC_001_HYDERABAD_URBAN_2025` | 10545.1ms | 0.50 | 0.50 | 0.50 | 1.00 |
| *"water reservoir shoreline drying and lake shrinkage"* | 2 | `SCENE_LOC_001_HYDERABAD_URBAN_2023` | 19.9ms | 0.00 | 0.50 | 0.50 | 0.50 |
| *"forest road clearing corridor and tree removal"* | 2 | `SCENE_LOC_001_HYDERABAD_URBAN_2025` | 17.4ms | 0.00 | 0.50 | 0.50 | 0.50 |
| *"coastal port reclamation and ocean harbor pier"* | 2 | `SCENE_LOC_001_HYDERABAD_URBAN_2025` | 14.3ms | 0.00 | 0.50 | 0.50 | 0.33 |
| *"solar panel farm photovoltaic arrays in desert terrain"* | 2 | `SCENE_LOC_005_THAR_SOLAR_PARK_2025` | 16.5ms | 0.50 | 0.50 | 0.50 | 1.00 |

---

## 3. Multi-Temporal Change Detection Evaluation

Deterministic bi-temporal change detection with morphological noise reduction and minimum region filtering:

- **Benchmark Pairs Evaluated:** 4 (2 with ground truth, 2 unannotated)
- **Precision:** 1.0
- **Recall:** 0.9985
- **F1-Score:** 0.9992
- **IoU (Jaccard Index):** 0.9985
- **False Positive Rate (FPR):** 0.0

> **Honesty Principle:** Metrics are computed strictly on benchmark pairs where explicit pixel-level ground truth exists. For unannotated catalog pairs, metrics are marked as *'Ground truth unavailable — metric not computed'*, preserving scientific defensibility.

### Pair-by-Pair Ground Truth Adjudication
| Pair ID | Scenario Name | Ground Truth | Verdict | Status / IoU |
| :--- | :--- | :--- | :--- | :--- |
| `PAIR_SYNTHETIC_CHANGE` | Controlled Synthetic Structural Change | Available | CHANGE_DETECTED | IoU: 0.9969 |
| `PAIR_SYNTHETIC_NO_CHANGE` | Controlled Synthetic Invariant Scene | Available | NO_SIGNIFICANT_CHANGE | IoU: 1.0000 |
| `PAIR_LOC_001_HYDERABAD` | Hyderabad Peri-Urban Growth Zone (2023 vs 2025) | Unavailable | CHANGE_DETECTED | Metric not computed |
| `PAIR_LOC_002_GODAVARI` | Sriram Sagar Reservoir Catchment (2023 vs 2025) | Unavailable | CHANGE_DETECTED | Metric not computed |

---

## 4. Robustness & Stress Scenarios

Evaluation across 7 controlled operational stress and perturbation conditions:

| Scenario | Verdict | Behavior & Mitigation Notes |
| :--- | :--- | :--- |
| No-change invariant pair | **PASSED** | Verified that zero change occurs on identical inputs. |
| Known synthetic change block | **PASSED** | Verified detection of continuous change block with region clustering. |
| Low-quality / narrow dynamic range | **PASSED** | Verified that detector triggers low-contrast warning and avoids blind trust. |
| Global illumination variation (+40 offset) | **PASSED** | Verified that mean/std illumination normalization prevents false alarms from sun angle. |
| Seasonal phenology variation | **PASSED** | Verified that thresholding + illumination matching suppresses diffuse seasonal foliage shifts. |
| Spatial dimension mismatch normalization | **PASSED** | Verified that ImageAlignmentService reconciles dimensions without crashing. |
| Cross-sensor comparison | **PASSED** | Verified that sensor mismatch triggers explicit warnings and score penalty. |

---

## 5. System Performance & Storage

Actual measured execution times using `time.perf_counter()`:

- **FAISS Index File Size:** 20.04 KB (10 vectors, dim=512)
- **FAISS Metadata File Size:** 5.35 KB
- **Semantic Retrieval Latency (Mean):** 16.36 ms (Min: 10.9 ms, Max: 23.05 ms)
- **Temporal Analysis Latency (Mean):** 32.64 ms (Shape: (512, 512), Min: 31.61 ms, Max: 34.36 ms)

---

## 6. Technical Limitations & Scientific Disclosures

1. **Benchmark Scale:** The current benchmark contains 10 scenes across 5 monitored locations. It is designed to demonstrate architectural soundness and workflow reproducibility at prototype scale, not global planetary scale.
2. **Generic Vision-Language Model:** Embeddings are produced by `openai/clip-vit-base-patch32` (*CLIP baseline*). While effective for generic semantic retrieval, fine-tuning on multispectral remote-sensing bands (e.g. RemoteCLIP) is planned for future phases.
3. **Ground-Truth Availability:** Full pixel-level ground truth masks are provided for synthetic controlled verification pairs. For complex real satellite scenes, ground truth is marked as unavailable to avoid unverified synthetic metric fabrication.
4. **Deterministic Change Detector:** The Phase 3 detector detects radiometric and structural changes using difference magnitudes and morphological filtering. It does not perform autonomous semantic classification (e.g., distinguishing urban construction from agricultural land clearing without contextual prompts).
5. **Image Alignment vs. Geodetic Co-Registration:** The current `ImageAlignmentService` performs spatial dimension validation and resolution resizing to a common comparison space. It does not claim rigorous sub-pixel geodetic bundle adjustment.
6. **Model-Derived Analytical Confidence:** Confidence scores are computed directly from contrast dynamic range, spatial cluster coherence, and sensor mismatch penalties. They represent an engineered analytical confidence score, not a calibrated Bayesian posterior probability.
