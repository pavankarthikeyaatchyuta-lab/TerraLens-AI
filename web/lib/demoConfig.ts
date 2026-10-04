/**
 * SIH26227 Deterministic Judge Demonstration Path Configuration
 * 
 * Freezes the 3-minute reproducible evaluation path for SIH26227 judges:
 * 1. Query: "solar park development in Rajasthan"
 * 2. Candidate Scene: Bhadla Solar Park (LOC_EO_01_BHADLA_SOLAR / EO_BHADLA_SOLAR_PARK)
 * 3. Multi-temporal baseline: 2023-04-05 (Earliest usable) vs 2025-03-15 (Latest monitoring)
 * 4. Temporal comparison: Side-by-side & swipe
 * 5. Change analysis: Multi-spectral differencing with SCL atmospheric quality masking
 * 6. Detected change: Bi-temporal surface change across perimeter boundaries (classification: VEGETATION_GAIN)
 * 7. False-alarm suppression: SCL cloud/shadow mask eliminates atmospheric artifacts
 * 8. Analyst adjudication: Adjudicate verdict as TRUE CHANGE with domain notes
 * 9. Export bundle: Export full PKZIP bundle with manifest, provenance, GeoJSON, and report
 */

export interface DemoStep {
  step: number;
  name: string;
  durationEstSec: number;
  description: string;
}

export interface DemoConfig {
  query: string;
  catalogMode: "real-eo" | "benchmark";
  locationId: string;
  locationName: string;
  coordinates: { lat: number; lon: number };
  t1Date: string;
  t2Date: string;
  expectedClassification: string;
  expectedChangedAreaHa: string;
  expectedConfidence: string;
  expectedQuality: string;
  expectedClusterCount: number;
  expectedSteps: DemoStep[];
  telemetryProof: {
    rawDifferencePixels: number;
    sclMaskedPixels: number;
    illuminationGain: number;
    illuminationOffset: number;
    morphologyNoisePruned: number;
    minimumClusterAreaM2: number;
    finalClusters: number;
  };
}

export const SIH_DEMO_CONFIG: DemoConfig = {
  query: "solar park development in Rajasthan",
  catalogMode: "real-eo",
  locationId: "LOC_EO_01_BHADLA_SOLAR",
  locationName: "Bhadla Solar Park, Rajasthan",
  coordinates: { lat: 27.539, lon: 71.918 },
  t1Date: "2023-04-05",
  t2Date: "2025-03-15",
  expectedClassification: "VEGETATION_GAIN",
  expectedChangedAreaHa: "60.22",
  expectedConfidence: "0.55",
  expectedQuality: "100.0% valid pixels (Real SCL Quality Masked)",
  expectedClusterCount: 107,
  expectedSteps: [
    {
      step: 1,
      name: "Semantic Query Retrieval",
      durationEstSec: 15,
      description: "Analyst inputs natural language query 'solar park development in Rajasthan'. Encoded in <25ms by browser-side CLIP ViT-B/32 ONNX model with cosine similarity search."
    },
    {
      step: 2,
      name: "Candidate Scene Resolution",
      durationEstSec: 20,
      description: "System surfaces Bhadla Solar Park as Rank-1 match across 40 pan-Indian monitored hubs, displaying acquisition timeline and cloud metrics."
    },
    {
      step: 3,
      name: "Multi-Temporal Sequence Navigation",
      durationEstSec: 25,
      description: "Navigate from Earliest Usable Observation (2023-04-05) to Latest Observation Frontier (2025-03-15) across a 710-day Sentinel-2 monitoring baseline."
    },
    {
      step: 4,
      name: "Interactive Bi-Temporal Comparison",
      durationEstSec: 30,
      description: "Examine multi-spectral imagery in split side-by-side and interactive swipe viewports to inspect physical ground conditions."
    },
    {
      step: 5,
      name: "Automated Change Analysis & SCL Masking",
      durationEstSec: 20,
      description: "Execute radiometric illumination matching, SCL atmospheric quality masking (classes 0, 1, 3, 8, 9, 10, 11), and adaptive statistical thresholding (μ + 1.8σ clamped [0.15, 0.45])."
    },
    {
      step: 6,
      name: "False-Alarm Proof Telemetry Inspection",
      durationEstSec: 25,
      description: "Verify the 5-stage false-alarm suppression pipeline: Raw Difference → SCL Quality Masking → Illumination Normalization → 3x3 Morphology → Final Clusters (≥900m² / 9px)."
    },
    {
      step: 7,
      name: "Analyst Adjudication & Notes Capture",
      durationEstSec: 20,
      description: "Analyst adjudicates verdict as 'TRUE CHANGE', verifies event attribution, and records domain notes into the permanent audit trail."
    },
    {
      step: 8,
      name: "Autonomous Dossier Export & Validation",
      durationEstSec: 25,
      description: "Export full PKZIP intelligence dossier containing manifest.json, provenance.json, RFC 7946 change_clusters.geojson, and executive Markdown report."
    }
  ],
  telemetryProof: {
    rawDifferencePixels: 13931,
    sclMaskedPixels: 0,
    illuminationGain: 0.75,
    illuminationOffset: 0.086,
    morphologyNoisePruned: 7909,
    minimumClusterAreaM2: 900,
    finalClusters: 107,
  }
};
