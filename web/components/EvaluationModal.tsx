"use client";

import React, { useEffect, useState } from "react";
import { X, BarChart3, CheckCircle, ShieldAlert, Cpu, Timer, Layers, AlertCircle } from "lucide-react";

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EvaluationModal({ isOpen, onClose }: EvaluationModalProps) {
  const [evalData, setEvalData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/evaluation")
      .then((res) => res.json())
      .then((data) => {
        setEvalData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load evaluation data", err);
        setLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-tactical-900 border border-tactical-700 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-tactical-700 bg-tactical-850">
          <div className="flex items-center gap-2.5">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-bold font-mono text-slate-100 uppercase tracking-wide">
                TerraLens AI — Empirical Evaluation Suite
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                SIH26227 Benchmark Verification | Multi-Temporal Change & Semantic Retrieval
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg bg-tactical-800 border border-tactical-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-slate-400 font-mono">
              Loading benchmark telemetry...
            </div>
          ) : (
            <>
              {/* SECTION 1: Latency & System Telemetry */}
              <div>
                <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Timer className="w-4 h-4" />
                  <span>1. Runtime Latency Decomposition</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-tactical-850 p-3.5 rounded-xl border border-tactical-700">
                    <span className="text-[11px] font-mono text-slate-400 block uppercase">
                      Warm Semantic Retrieval
                    </span>
                    <span className="text-2xl font-bold font-mono text-cyan-400">
                      ~21.47 ms
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      Min: 16.59 ms | Max: 28.22 ms
                    </span>
                  </div>

                  <div className="bg-tactical-850 p-3.5 rounded-xl border border-tactical-700">
                    <span className="text-[11px] font-mono text-slate-400 block uppercase">
                      CLIP Model Initialization
                    </span>
                    <span className="text-2xl font-bold font-mono text-amber-400">
                      ~477.4 ms
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      PyTorch weights load (not total cold start)
                    </span>
                  </div>

                  <div className="bg-tactical-850 p-3.5 rounded-xl border border-tactical-700">
                    <span className="text-[11px] font-mono text-slate-400 block uppercase">
                      First-Query Cold Pipeline
                    </span>
                    <span className="text-2xl font-bold font-mono text-slate-200">
                      ~10.28 s
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">
                      Cold initialization + initial vector search
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Semantic Retrieval Accuracy */}
              <div>
                <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Layers className="w-4 h-4" />
                  <span>2. Semantic Retrieval Accuracy (CLIP ViT-B/32 + FAISS IndexFlatIP)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Mean Reciprocal Rank</span>
                    <span className="text-xl font-bold font-mono text-slate-100">0.6667</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">MRR Benchmark</span>
                  </div>

                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Location Acc@1</span>
                    <span className="text-xl font-bold font-mono text-slate-100">40.0%</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Top-1 Target Loc</span>
                  </div>

                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Recall@3</span>
                    <span className="text-xl font-bold font-mono text-slate-100">50.0%</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Relevant scenes</span>
                  </div>

                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Precision@1</span>
                    <span className="text-xl font-bold font-mono text-slate-100">40.0%</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Exact match</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Change Detection Accuracy (Controlled Synthetic Benchmark) */}
              <div>
                <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span>3. Change Detection Ground Truth Metrics (Controlled Synthetic Benchmark)</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Intersection over Union</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">0.9764</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Mean IoU (Controlled)</span>
                  </div>

                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Pixel Precision</span>
                    <span className="text-xl font-bold font-mono text-slate-100">0.9880</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Controlled Pairs</span>
                  </div>

                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Pixel Recall</span>
                    <span className="text-xl font-bold font-mono text-slate-100">0.9879</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Controlled Pairs</span>
                  </div>

                  <div className="bg-tactical-850 p-3 rounded-lg border border-tactical-700">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Pixel F1-Score</span>
                    <span className="text-xl font-bold font-mono text-slate-100">0.9879</span>
                    <span className="text-[10px] text-slate-500 font-mono block mt-1">Harmonic mean</span>
                  </div>
                </div>

                {/* Real-Scene Ground Truth Disclosure */}
                <div className="mt-2 p-2.5 rounded-lg bg-tactical-850 border border-tactical-750 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span className="text-slate-300">Unannotated Real Catalog Scenes (Hyderabad, Godavari, Western Ghats, Chennai, Thar):</span>
                  <span className="text-amber-400 font-bold">Ground truth unavailable — metric not computed.</span>
                </div>
              </div>

              {/* SECTION 4: Robustness & False-Alarm Suppression */}
              <div>
                <h3 className="text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>4. Robustness Diagnostics (7/7 Scenarios Passing)</span>
                </h3>
                <div className="bg-tactical-850 p-4 rounded-xl border border-tactical-700 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between pb-2 border-b border-tactical-750">
                    <span className="text-slate-300">Illumination Drift Resilience (ROB_ILLUM):</span>
                    <span className="text-emerald-400 font-bold">IoU = 0.999 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-tactical-750">
                    <span className="text-slate-300">Cross-Sensor Calibration Resilience (ROB_CROSS_SENSOR):</span>
                    <span className="text-emerald-400 font-bold">IoU = 0.976 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-tactical-750">
                    <span className="text-slate-300">Invariant Pair False Alarm Suppression (ROB_NO_CHANGE):</span>
                    <span className="text-emerald-400 font-bold">Changed Ratio = 0.00% (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300">Low-Quality Image Degradation Penalty (ROB_LOW_QUALITY):</span>
                    <span className="text-amber-400 font-bold">Quality Penalty = -0.30 (CONF PENALIZED)</span>
                  </div>
                </div>
              </div>

              {/* SECTION 5: Explicit Limitations & Scientific Disclosures */}
              <div className="bg-tactical-950 p-4 rounded-xl border border-tactical-700 text-xs text-slate-400 space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-mono font-semibold">
                  <AlertCircle className="w-4 h-4 text-cyan-400" />
                  <span>Known Scientific Limitations</span>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 leading-relaxed pl-1">
                  <li>Real satellite catalog scenes currently lack polygon-level ground truth; pixel-level IoU is therefore not reported for those scenes.</li>
                  <li>The current semantic model is the zero-shot CLIP baseline (<code className="text-cyan-300">openai/clip-vit-base-patch32</code>).</li>
                  <li>Domain-specific Earth-observation fine-tuning (e.g., RemoteCLIP, SatMAE) is a planned future extension.</li>
                  <li>The public Vercel demo operates in Controlled Benchmark Mode using pre-indexed 512-dim normalized vectors and precomputed artifacts.</li>
                  <li>The full scientific research pipeline remains available through the local Python Streamlit application.</li>
                  <li>Analytical confidence reflects signal contrast and spatial consistency, not a calibrated statistical probability of change.</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-tactical-700 bg-tactical-850 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">Evaluation Suite v1.0.0 | All 45 Unit & Integration Tests Passing</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-tactical-700 hover:bg-tactical-600 text-slate-200 font-bold transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
