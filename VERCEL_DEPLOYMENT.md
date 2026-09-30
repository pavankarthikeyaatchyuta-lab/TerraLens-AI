# TerraLens AI — Production Vercel Deployment Guide
**Smart India Hackathon 2026 — Problem Statement SIH26227**  
*Semantic Retrieval and Multi-Temporal Change Analysis of Satellite Imagery*

---

## 1. Architecture

TerraLens AI employs a dual-track architecture designed for both research depth and public reliability:

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

- **Research Engine (Local / Server):** Streamlit + Python 3.13 + PyTorch + CLIP ViT-B/32 + FAISS IndexFlatIP + OpenCV deterministic change detection.
- **Public Demo (Vercel Serverless):** Next.js 14 + React 18 + TypeScript + Tailwind CSS. Operates in **Controlled Benchmark Mode** using pre-indexed 512-dimensional normalized vectors and pre-computed raster change artifacts, providing $<20\text{ ms}$ response times without serverless crashes or timeouts.

---

## 2. Local Setup

### Prerequisites
- Node.js 18+ (tested on Node v24.13.0)
- Python 3.11 - 3.13
- Git

### Installing Dependencies
```bash
# 1. Install Python research dependencies (in project root)
pip install -r requirements.txt

# 2. Install Web demo dependencies
cd web
npm install
```

---

## 3. Asset Generation

To extract pre-indexed FAISS vectors, generate change masks, and serialize benchmark assets for the web application:

```bash
# In project root
python scripts/export_web_assets.py
```

This exports:
- `web/public/data/locations.json`: Full catalog of 5 monitoring locations.
- `web/public/data/scenes.json`: 10 benchmark satellite scenes.
- `web/public/data/scene_embeddings.json`: 512-dim normalized vectors from FAISS.
- `web/public/data/query_embeddings.json`: Precomputed CLIP query representations.
- `web/public/data/change_analysis_cache.json`: Pre-computed deterministic change results.
- `web/public/data/evaluation_results.json`: Benchmark evaluation telemetry.
- `web/public/samples/`: Baseline and monitoring satellite imagery.
- `web/public/outputs/change_masks/`: Pre-rendered masks, heatmaps, and overlays.

---

## 4. Web Build

To compile the production Next.js application:

```bash
cd web
npm run build
```

Expected output:
- 11 pre-rendered static and dynamic serverless routes.
- Zero TypeScript, ESLint, or bundling errors.

---

## 5. API Structure

All serverless endpoints run in `web/app/api/` and respond in $<20\text{ ms}$:

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/health` | `GET` | Service status (`ok`), mode (`controlled-benchmark`), catalog size. |
| `/api/locations` | `GET` | Catalog locations with geographic coordinates and metadata. |
| `/api/scenes` | `GET` | Complete list of indexed satellite scenes. |
| `/api/scenes/[id]` | `GET` | Metadata for a specific scene or location. |
| `/api/scenes/[id]/temporal` | `GET` | Paired baseline ($T_1$) and monitoring ($T_2$) scenes. |
| `/api/temporal/[location_id]` | `GET` | Temporal pair with artifact paths and precomputed analysis metadata. |
| `/api/search` | `POST` | Exact 512-dim cosine similarity search over catalog vectors. |
| `/api/analyze` | `POST` | Change classification, change ratio, confidence, and region clusters. |
| `/api/export` | `POST` | Generates downloadable analytical dossier in JSON or Markdown. |
| `/api/evaluation` | `GET` | Serves verified empirical evaluation benchmark results. |

---

## 6. Vercel Configuration

The project includes root and web configurations:
- Root [`vercel.json`](file:///c:/Users/pavan/OneDrive/Pictures/Desktop/TerraLens%20AI/vercel.json): Configures Next.js framework preset, build command (`cd web && npm run build`), and output directory (`web/.next`).
- Web [`web/vercel.json`](file:///c:/Users/pavan/OneDrive/Pictures/Desktop/TerraLens%20AI/web/vercel.json): For deployments where the Vercel Root Directory is set directly to `web`.
- Serverless Requirements [`requirements-serverless.txt`](file:///c:/Users/pavan/OneDrive/Pictures/Desktop/TerraLens%20AI/requirements-serverless.txt): Declares minimal dependencies (`numpy`, `pillow`, `pydantic`) without heavy ML frameworks.

---

## 7. Environment Variables

Create `.env.example` in `web/`:
```bash
NEXT_PUBLIC_APP_NAME="TerraLens AI"
NEXT_PUBLIC_SIH_PROBLEM="SIH26227"
NEXT_PUBLIC_DEMO_MODE="production"
```
No private tokens, API keys, or database secrets are required for the public controlled benchmark demo.

---

## 8. Deployment Steps

### Option A: Via Vercel Web Dashboard (Recommended)
1. Navigate to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and import `pavankarthikeyaatchyuta-lab/TerraLens-AI`.
3. Under **Project Settings**:
   - Framework Preset: `Next.js`
   - Root Directory: Click `Edit` and select `web`
4. Click **Deploy**.
5. Deployment will complete in under 2 minutes.

### Option B: Via Vercel CLI
```bash
cd web
vercel deploy --temporary -y
```

---

## 9. Production Verification

Post-deployment checklist for hackathon judges and evaluators:
- [x] **Homepage Hero Banner:** Displays SIH26227, Space Technology, and motto `SEARCH → DISCOVER → COMPARE → VERIFY`.
- [x] **Zero Cold-Start:** Vector retrieval responds in $<20\text{ ms}$.
- [x] **Interactive Leaflet AOI Map:** Markers and bounding boxes render correctly.
- [x] **Swipe Comparison Slider:** Smoothly compares before ($T_1$) and after ($T_2$) satellite scenes.
- [x] **Raster Diagnostics:** Instant toggling between Difference Heatmap, Binary Change Mask, and Highlight Overlay with opacity slider.
- [x] **Auditable Provenance:** Displays every step in the deterministic processing pipeline.
- [x] **Analyst Adjudication & Dossier Export:** Supports analyst verification notes and one-click Markdown/JSON download.
- [x] **Live Evaluation Modal:** Presents empirical benchmarks (MRR: 0.6667, Mean IoU: 0.9764, Illumination Invariance: 0.999).

---

## 10. Known Limitations

1. **Controlled Benchmark Scope:** Real satellite catalog scenes currently lack polygon-level ground truth; pixel-level IoU is therefore not reported for those scenes.
2. **CLIP Baseline:** The vision-language model is `openai/clip-vit-base-patch32` (*CLIP baseline*), a general foundation model rather than an Earth-observation fine-tuned model.
3. **Public Demo Mode:** The public Vercel deployment evaluates supported benchmark queries using pre-indexed 512-dim normalized vectors and precomputed raster artifacts.
4. **Research Engine Distinction:** The full scientific research pipeline (live CLIP inference, dynamic FAISS indexing, live OpenCV change detection) runs locally via Streamlit.
5. **Analytical Confidence Semantics:** The confidence score reflects signal contrast and spatial consistency, not a calibrated statistical probability of change.

---

## 11. Difference Between Streamlit and Vercel Tracks

| Characteristic | Research Prototype (`terralens/app/main.py`) | Public Demo (`web/` on Vercel) |
| :--- | :--- | :--- |
| **Primary Audience** | Research teams, data scientists, GIS engineers | SIH judges, public evaluators, mobile browsers |
| **Framework** | Python 3.13 + Streamlit + Folium | Next.js 14 + React 18 + Tailwind + Leaflet |
| **Model Inference** | Live PyTorch CLIP ViT-B/32 execution | Exact cosine similarity on pre-indexed 512d vectors |
| **Vector Search** | Live FAISS C++ `IndexFlatIP` | Mathematical dot product over normalized vectors |
| **Change Detection** | Dynamic OpenCV / NumPy bitemporal pipeline | Pre-rendered raster layers + telemetry serving |
| **Deployment Target** | Local workstation / Dedicated GPU server | Vercel Serverless Edge & Node.js Runtime |
| **Bundle Footprint** | $\sim 2.5\text{ GB}$ (PyTorch + CUDA + Transformers) | $\sim 15\text{ MB}$ (Static assets + optimized JS) |
| **Query Latency** | $\sim 21.47\text{ ms}$ (warm) / $477\text{ ms}$ (cold model load) | $< 20\text{ ms}$ (zero cold start) |

---

## 12. Troubleshooting

- **Leaflet Window Not Defined:** Ensure `TacticalMap.tsx` imports Leaflet dynamically on the client inside `useEffect` or via Next.js dynamic import (`ssr: false`).
- **Sample Images 404:** Run `python scripts/export_web_assets.py` to ensure all 5 location subdirectories are copied from `data/samples/` to `web/public/samples/`.
- **Port Conflict in Streamlit:** If port 8501 is busy, launch with `streamlit run terralens/app/main.py --server.port 8502`.
- **Vercel Monorepo Root Directory:** If deploying from repository root, ensure root `vercel.json` is present, or set Root Directory to `web` in the Vercel dashboard.
