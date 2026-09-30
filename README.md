# TerraLens AI: Semantic Satellite Intelligence for Multi-Temporal Change Analysis

**Smart India Hackathon 2026 (SIH 2026)**  
**Problem Statement ID:** SIH26227  
**Operational Status:** Phase 1 Working Foundation (Local Prototype)

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
DISCOVER (Semantic retrieval + similar candidate locations)
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
│   ├── main.py                     # Streamlit application entrypoint
│   ├── components/
│   │   ├── search.py               # Search interface & ranked candidate cards
│   │   ├── map_view.py             # Interactive Folium map with satellite/topo layers
│   │   ├── temporal_view.py        # Side-by-side multi-temporal baseline vs. monitoring
│   │   ├── evidence_panel.py       # Evidence dossier, audit trail & analyst adjudication
│   │   ├── sidebar.py              # Navigation and live system architecture status
│   │   └── image_viewer.py         # Resilient image rendering & placeholder fallbacks
│   ├── services/
│   │   ├── dataset_service.py      # Archive scanner, integrity checks & path resolver
│   │   ├── metadata_service.py     # Schema validation and metadata query filters
│   │   ├── retrieval_service.py    # Modular retrieval engine (Prototype & future FAISS)
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
│   └── README.md                   # FAISS vector index architecture specification
├── tests/
│   ├── test_metadata.py            # Pydantic validation & catalog query tests
│   ├── test_dataset.py             # Archive discovery & image loader tests
│   ├── test_retrieval.py           # Lexical & filter retrieval tests
│   ├── test_temporal.py            # Temporal pairing & alignment tests
│   └── test_provenance.py          # Lineage trace & adjudication tests
├── scripts/
│   └── generate_sample_dataset.py  # Benchmark dataset generator
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

## 4. Phase 1 Capabilities vs. Future Roadmap

To uphold scientific and engineering integrity, TerraLens AI strictly distinguishes between **implemented capabilities** and **planned features**:

### ✅ IMPLEMENTED (Phase 1 Foundation)
- [x] **Geospatial Intelligence UI:** Professional dark-mode dashboard built on Streamlit with defense/research HUD aesthetics.
- [x] **Satellite Archive Browser:** Multi-temporal location exploration across India-centric benchmark operational scenarios.
- [x] **Interactive Mapping:** Open-source Folium/Leaflet map with Esri World Imagery & OpenStreetMap base tiles, candidate markers, selected AOI pulsing radar circle, and bounding box extents.
- [x] **Location & Scene Metadata Catalog:** Strict Pydantic models (`Location`, `Scene`, `BoundingBox`) with latitude/longitude validation, ISO date checks, and sensor tagging.
- [x] **Multi-Temporal Imagery Inspection:** True side-by-side comparison of baseline (2023) and monitoring (2025) satellite observations.
- [x] **Search Foundation:** Pluggable retrieval architecture supporting keyword matching, thematic category filtering (urban, water, forest, coastal, solar), sensor family constraints, and cloud cover thresholds.
- [x] **Lineage & Provenance Tracking:** Complete auditable execution trail (`QUERY` → `RETRIEVED_LOCATION` → `SOURCE_IMAGES` → `PREPROCESSING` → `TEMPORAL_COMPARISON` → `CONFIDENCE_EVALUATION` → `ANALYST_DECISION`).
- [x] **Human Analyst Adjudication:** Adjudication form allowing reviewers to record confirmation, mark false alarms (phenology/shadow), and log operational remarks.
- [x] **Resilient Error Boundaries:** Graceful handling of missing images, corrupted files, and malformed queries with no unhandled crashes.
- [x] **Automated Test Suite:** 16 unit and integration tests passing in `< 1.0s` across metadata, dataset, temporal, and retrieval layers.

### ⏳ PLANNED (Phase 2 & Beyond)
- [ ] **Multi-Modal Embeddings:** Remote Sensing CLIP / OpenCLIP fine-tuned on satellite imagery and multi-spectral bands.
- [ ] **FAISS Vector Indexing:** Sub-second vector similarity retrieval over large-scale satellite tile archives.
- [ ] **Visual Feature Search:** Uploading a reference satellite patch to retrieve structurally similar geographic locations.
- [ ] **Automated Deep Change Detection:** Bi-temporal Siamese UNet / ChangeFormer architectures for automated change boundary extraction.
- [ ] **Pixel-Level Change Masks:** Generation of georeferenced GeoTIFF binary and categorical change heatmaps.
- [ ] **False-Alarm Mitigation Pipeline:** Deep cloud/cloud-shadow masking (Fmask/s2cloudless) and multi-seasonal phenology normalization.
- [ ] **Statistical Confidence Calibration:** Temperature-scaled confidence scores providing true Bayesian uncertainty metrics.

---

## 5. Prototype Dataset

TerraLens AI includes 5 diverse, realistic multi-temporal benchmark scenarios clearly marked as `PROTOTYPE DATASET`:

| Location ID | Name | Coordinates | Sensor | Temporal Baseline | Temporal Monitoring | Operational Scenario |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `LOC_001_HYDERABAD_URBAN` | Hyderabad Peri-Urban Growth | `17.4483° N, 78.3742° E` | Sentinel-2 MSI | March 2023 | February 2025 | Peri-urban construction & road network expansion |
| `LOC_002_GODAVARI_RESERVOIR` | Sriram Sagar Catchment | `18.9647° N, 78.3283° E` | Sentinel-2 MSI | January 2023 | January 2025 | Reservoir water volume retreat & exposed mudflats |
| `LOC_003_WESTERN_GHATS_FOREST`| Western Ghats Corridor | `14.8512° N, 74.5238° E` | Sentinel-2 MSI | April 2023 | March 2025 | Linear infrastructure clearance through dense canopy |
| `LOC_004_CHENNAI_COASTAL` | Ennore Coastal Reclamation | `13.2541° N, 80.3312° E` | Sentinel-2 MSI | February 2023 | February 2025 | Port jetty construction and industrial land reclamation |
| `LOC_005_THAR_SOLAR_PARK` | Bhadla Solar Intelligence | `27.5380° N, 71.9170° E` | Sentinel-2 MSI | May 2023 | April 2025 | Arid desert conversion into high-density PV solar arrays |

---

## 6. Installation & Local Setup

### Prerequisites
- Python 3.10+ (Tested on Python 3.13)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI.git
cd "TerraLens AI"
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Generate Benchmark Dataset (If not already present)
```bash
python scripts/generate_sample_dataset.py
```

### 4. Run the Test Suite
```bash
python -m pytest -v
```

### 5. Launch the Dashboard
```bash
streamlit run terralens/app/main.py
```
The application will launch at `http://localhost:8501`.

---

## 7. How to Add Real Satellite Imagery

TerraLens AI was architected from day one to ingest actual GeoTIFF / satellite imagery (e.g. Sentinel-2 L2A, Landsat-8/9, PlanetScope):

1. **Place Imagery in Archive:**
   Copy your imagery files into `data/imagery/<YOUR_LOCATION_ID>/`:
   ```
   data/imagery/LOC_006_DELHI_NCR/
       before_2023.tif (or .jpg/.png)
       after_2025.tif (or .jpg/.png)
   ```

2. **Register in `data/metadata/locations.json`:**
   Add a scene and location entry:
   ```json
   {
     "location_id": "LOC_006_DELHI_NCR",
     "name": "Delhi NCR Northern Corridor",
     "description": "Highway expansion and logistics hub construction.",
     "latitude": 28.7041,
     "longitude": 77.1025,
     "primary_sensor": "Sentinel-2 MSI",
     "before_scene_id": "SCENE_LOC_006_2023",
     "after_scene_id": "SCENE_LOC_006_2025",
     "available_dates": ["2023-02-10", "2025-02-12"],
     "tags": ["urban", "highways", "logistics"],
     "source": "Copernicus Open Access Hub"
   }
   ```
3. Restart or reload the Streamlit app. The dataset service will automatically discover, validate, and index the new imagery on the interactive map and temporal viewer.

---

## 8. Current Limitations
- **Retrieval Engine:** Currently operates via structured metadata querying and keyword indexing. Neural cross-modal embedding search (CLIP + FAISS) will be activated in Phase 2.
- **Change Detection Models:** Change classification, statistical confidence, and binary masks are marked as `Not yet calculated` until bi-temporal neural networks are trained.
- **Image Formats:** Phase 1 visualizes 3-band RGB/JPEG/PNG scenes; multi-spectral 12-band GeoTIFF radiometric pipelines are scheduled for Phase 2.

---

## 9. Next Steps: Phase 2 Execution
1. Implement `SemanticEmbeddingRetrievalService` using pre-trained `RemoteCLIP` / `OpenCLIP`.
2. Generate vector embeddings for satellite image tiles and build the FAISS index in `indexes/`.
3. Implement `BiTemporalChangeDetector` using Siamese Feature Difference networks.
4. Integrate automated cloud/shadow masking via Sentinel-2 QA60 / SCL scene classification bands.
5. Connect analyst adjudication feedback into a local fine-tuning loop to continuously suppress false positives.