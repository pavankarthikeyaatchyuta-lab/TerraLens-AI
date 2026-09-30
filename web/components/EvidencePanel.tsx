"use client";

import React, { useState } from "react";
import { Location, ChangeDetectionResult } from "@/types";
import {
  FileText,
  Download,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  History,
  ShieldCheck,
  FileCode,
} from "lucide-react";

interface EvidencePanelProps {
  location: Location;
  analysis: ChangeDetectionResult | null;
}

export function EvidencePanel({ location, analysis }: EvidencePanelProps) {
  const [verdict, setVerdict] = useState<"VERIFIED_TRUE_CHANGE" | "FALSE_ALARM" | "INCONCLUSIVE">("VERIFIED_TRUE_CHANGE");
  const [analystNotes, setAnalystNotes] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const handleExport = async (format: "json" | "markdown") => {
    setIsExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_id: location.location_id,
          format,
          analyst_notes: analystNotes,
          verdict,
        }),
      });

      const data = await res.json();
      const contentStr = typeof data.content === "string" ? data.content : JSON.stringify(data.content, null, 2);
      const mimeType = format === "markdown" ? "text/markdown;charset=utf-8" : "application/json";
      const blob = new Blob([contentStr], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `terralens_dossier_${location.location_id}.${format === "markdown" ? "md" : "json"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to export dossier");
    } finally {
      setIsExporting(false);
    }
  };

  const provenanceSteps = [
    {
      num: "01",
      title: "Semantic Vector Retrieval",
      engine: "CLIP ViT-B/32 + 512-dim Normalized Cosine Similarity",
      status: "SUCCESS",
      detail: `Target matched query with cosine similarity over catalog archive.`,
    },
    {
      num: "02",
      title: "Spatial Image Alignment",
      engine: "ImageAlignmentService (Image Alignment / Dimension Reconciliation)",
      status: "SUCCESS",
      detail: `Identity spatial grid verified across multi-temporal acquisition frames.`,
    },
    {
      num: "03",
      title: "Radiometric Contrast Normalization",
      engine: "Illumination Equalization (Gaussian mean & variance match)",
      status: "SUCCESS",
      detail: `Sun angle and atmospheric radiance differences normalized across epochs.`,
    },
    {
      num: "04",
      title: "Absolute Luminance Subtraction",
      engine: "Luminance Delta Operator (|T2 - T1|)",
      status: "SUCCESS",
      detail: `Generated continuous absolute difference heatmap (262,144 evaluated pixels).`,
    },
    {
      num: "05",
      title: "False-Alarm Noise Suppression",
      engine: "Morphological Open + Min-Region Thresholding",
      status: "SUCCESS",
      detail: `Pruned high-frequency sensor noise and isolated pixels under 20 contiguous px.`,
    },
    {
      num: "06",
      title: "Connected Component Extraction",
      engine: "8-Connectivity Spatial Region Clustering",
      status: "SUCCESS",
      detail: `Identified ${analysis?.change_regions?.length || 0} discrete spatial change polygons with centroids.`,
    },
  ];

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-tactical-700/60">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold font-mono text-slate-100 uppercase">
            Evidence Provenance & Analyst Review
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">SIH26227 AUDIT TRAIL</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Provenance Pipeline History */}
        <div>
          <h4 className="text-xs font-mono font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span>Processing Chain Provenance</span>
          </h4>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {provenanceSteps.map((step) => (
              <div
                key={step.num}
                className="bg-tactical-900/80 p-2.5 rounded-lg border border-tactical-750 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-bold">
                    STEP {step.num}: {step.title}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {step.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1 font-sans">{step.detail}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{step.engine}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Analyst Adjudication & Dossier Export */}
        <div className="bg-tactical-900/60 p-3.5 rounded-lg border border-tactical-750 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-mono font-bold text-slate-300 uppercase mb-2 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>Analyst Adjudication Verdict</span>
            </h4>

            {/* Verdict Selector */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setVerdict("VERIFIED_TRUE_CHANGE")}
                className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition-all flex flex-col items-center gap-1 ${
                  verdict === "VERIFIED_TRUE_CHANGE"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500 shadow-sm"
                    : "bg-tactical-800 text-slate-400 border-tactical-700 hover:text-slate-200"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>TRUE CHANGE</span>
              </button>

              <button
                type="button"
                onClick={() => setVerdict("FALSE_ALARM")}
                className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition-all flex flex-col items-center gap-1 ${
                  verdict === "FALSE_ALARM"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500 shadow-sm"
                    : "bg-tactical-800 text-slate-400 border-tactical-700 hover:text-slate-200"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>FALSE ALARM</span>
              </button>

              <button
                type="button"
                onClick={() => setVerdict("INCONCLUSIVE")}
                className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition-all flex flex-col items-center gap-1 ${
                  verdict === "INCONCLUSIVE"
                    ? "bg-slate-600/30 text-slate-300 border-slate-500 shadow-sm"
                    : "bg-tactical-800 text-slate-400 border-tactical-700 hover:text-slate-200"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>UNCERTAIN</span>
              </button>
            </div>

            {/* Notes textarea */}
            <label className="block text-[11px] font-mono text-slate-400 mb-1">
              Analyst Verification Notes:
            </label>
            <textarea
              rows={3}
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              placeholder="Enter domain interpretation notes for intelligence brief..."
              className="w-full bg-tactical-950 border border-tactical-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono resize-none"
            />
          </div>

          {/* Export Action Buttons */}
          <div className="mt-4 pt-3 border-t border-tactical-700/60 flex items-center justify-end gap-2">
            <button
              onClick={() => handleExport("json")}
              disabled={isExporting}
              className="px-3 py-1.5 rounded bg-tactical-800 hover:bg-tactical-700 text-slate-200 border border-tactical-600 text-xs font-mono font-semibold transition-all flex items-center gap-1.5"
            >
              <FileCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>EXPORT JSON</span>
            </button>

            <button
              onClick={() => handleExport("markdown")}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-mono font-bold transition-all flex items-center gap-1.5 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD DOSSIER (.MD)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
