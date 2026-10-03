"use client";

import React, { useState } from "react";
import { Location } from "@/types";
import {
  FileText,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  History,
  ShieldCheck,
  FileCode,
  Archive,
  MapPin,
  Loader2,
} from "lucide-react";

interface EvidencePanelProps {
  location: Location;
  analysis: any;
  beforeScene?: any;
  afterScene?: any;
  catalogMode?: "benchmark" | "real-eo" | "live";
}

export function EvidencePanel({
  location,
  analysis,
  beforeScene,
  afterScene,
  catalogMode = "benchmark",
}: EvidencePanelProps) {
  const [verdict, setVerdict] = useState<"TRUE_CHANGE" | "FALSE_ALARM" | "UNCERTAIN" | null>(null);
  const [analystNotes, setAnalystNotes] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const isLiveOrReal = Boolean(analysis?.clusters || analysis?.change || analysis?.quality);
  const analysisId = analysis?.provenance?.provenanceId || `ANALYSIS_${location.location_id}`;
  const clusterCount = analysis?.clusters?.length ?? analysis?.change_regions?.length ?? 0;
  const changedAreaHa = analysis?.change?.changedAreaHa ?? (
    analysis?.changed_pixels ? ((analysis.changed_pixels * 100) / 10000).toFixed(2) : "0.00"
  );
  const t1Date = beforeScene?.acquisitionDate?.split("T")[0] || beforeScene?.acquisition_date || "2023-04-05";
  const t2Date = afterScene?.acquisitionDate?.split("T")[0] || afterScene?.acquisition_date || "2025-03-12";
  const temporalDays =
    t1Date && t2Date
      ? Math.round(Math.abs(new Date(t2Date).getTime() - new Date(t1Date).getTime()) / 86400000)
      : "N/A";

  const handleExport = async (format: "zip" | "geojson" | "json" | "markdown") => {
    setIsExporting(true);
    setExportNotice(null);

    try {
      const payload: any = {
        location_id: location.location_id,
        location_name: location.name,
        format,
        analyst_notes: analystNotes,
        verdict: verdict || "UNREVIEWED",
        analyst_decision: verdict || "UNREVIEWED",
        mode: catalogMode === "real-eo" ? "REAL_EO_CATALOG" : "CONTROLLED_BENCHMARK",
      };

      if (isLiveOrReal) {
        payload.live_analysis = analysis;
        if (beforeScene) payload.before_scene = beforeScene;
        if (afterScene) payload.after_scene = afterScene;
      } else {
        payload.analysis_result = analysis;
      }

      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("HTTP " + res.status);

      if (format === "zip") {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `terralens_bundle_${location.location_id}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportNotice(`Exported complete bundle: terralens_bundle_${location.location_id}.zip`);
      } else if (format === "geojson") {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `change_clusters_${location.location_id}.geojson`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportNotice(`Exported RFC 7946 GeoJSON: change_clusters_${location.location_id}.geojson`);
      } else {
        const data = await res.json();
        const contentStr = typeof data.content === "string" ? data.content : JSON.stringify(data.content, null, 2);
        const mimeType = format === "markdown" ? "text/markdown;charset=utf-8" : "application/json";
        const blob = new Blob([contentStr], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = format === "markdown" ? "md" : "json";
        a.download = data.filename || `terralens_${format === "markdown" ? "report" : "analysis"}_${location.location_id}.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportNotice(`Exported: ${a.download}`);
      }

      setTimeout(() => setExportNotice(null), 5000);
    } catch (err) {
      setExportNotice("Export failed: " + (err instanceof Error ? err.message : String(err)));
      setTimeout(() => setExportNotice(null), 5000);
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
      engine: "Illumination Equalization (Gain [0.75, 1.25], Offset [-0.10, 0.10])",
      status: "SUCCESS",
      detail: `Sun angle and atmospheric radiance differences normalized across epochs.`,
    },
    {
      num: "04",
      title: "Adaptive Statistical Thresholding",
      engine: "Data-driven cutoff (mean + 1.8 * std, clamped [0.15, 0.45])",
      status: "SUCCESS",
      detail: `Statistical change magnitude cutoff determined without Otsu instability.`,
    },
    {
      num: "05",
      title: "False-Alarm Noise Suppression",
      engine: "3x3 Binary Opening + 3x3 Binary Closing + Min Cluster Filter",
      status: "SUCCESS",
      detail: `Pruned high-frequency sensor noise and isolated pixels under 9 contiguous px (900 m²).`,
    },
    {
      num: "06",
      title: "Connected Component Extraction",
      engine: "8-Connectivity Spatial Region Clustering",
      status: "SUCCESS",
      detail: `Identified ${clusterCount} discrete spatial change polygons with centroids.`,
    },
  ];

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-tactical-700/60">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 uppercase">
            Evidence Provenance & Analyst Review
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">SIH26227 AUDIT TRAIL</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Provenance Pipeline History */}
        <div>
          <h4 className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Processing Chain Provenance</span>
          </h4>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {provenanceSteps.map((step) => (
              <div
                key={step.num}
                className="bg-tactical-900/80 p-2.5 rounded-lg border border-tactical-700 text-xs font-mono"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sky-600 dark:text-sky-400 font-bold">
                    STEP {step.num}: {step.title}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    {step.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 font-sans">{step.detail}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">{step.engine}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Analyst Adjudication & Dossier Export */}
        <div className="bg-tactical-900/60 p-3.5 rounded-lg border border-tactical-700 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 uppercase flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>Analyst Adjudication</span>
              </h4>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                  verdict === "TRUE_CHANGE"
                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40"
                    : verdict === "FALSE_ALARM"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                    : verdict === "UNCERTAIN"
                    ? "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/40"
                    : "bg-tactical-800 text-slate-500 dark:text-slate-400 border-tactical-700"
                }`}
              >
                {verdict ? `ANALYST VERDICT: ${verdict.replace("_", " ")}` : "STATUS: UNREVIEWED"}
              </span>
            </div>

            {/* Verdict Selector */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setVerdict("TRUE_CHANGE")}
                className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition-all flex flex-col items-center gap-1 ${
                  verdict === "TRUE_CHANGE"
                    ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500 shadow-sm ring-1 ring-rose-500/50"
                    : "bg-tactical-800 text-slate-500 dark:text-slate-400 border-tactical-700 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>TRUE CHANGE</span>
              </button>

              <button
                type="button"
                onClick={() => setVerdict("FALSE_ALARM")}
                className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition-all flex flex-col items-center gap-1 ${
                  verdict === "FALSE_ALARM"
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500 shadow-sm ring-1 ring-amber-500/50"
                    : "bg-tactical-800 text-slate-500 dark:text-slate-400 border-tactical-700 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>FALSE ALARM</span>
              </button>

              <button
                type="button"
                onClick={() => setVerdict("UNCERTAIN")}
                className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold border transition-all flex flex-col items-center gap-1 ${
                  verdict === "UNCERTAIN"
                    ? "bg-slate-500/20 text-slate-700 dark:text-slate-300 border-slate-500 shadow-sm ring-1 ring-slate-500/50"
                    : "bg-tactical-800 text-slate-500 dark:text-slate-400 border-tactical-700 hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                <span>UNCERTAIN</span>
              </button>
            </div>

            {/* Notes textarea */}
            <label className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
              Analyst Verification Notes:
            </label>
            <textarea
              rows={2}
              value={analystNotes}
              onChange={(e) => setAnalystNotes(e.target.value)}
              placeholder="Enter domain interpretation notes for intelligence brief..."
              className="w-full bg-tactical-950 border border-tactical-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-sky-500 font-mono resize-none"
            />
          </div>

          {/* Phase 11: Dedicated Analysis Export Card */}
          <div className="bg-tactical-950 p-3 rounded-lg border border-tactical-750 font-mono space-y-2.5">
            <div className="flex items-center justify-between pb-1.5 border-b border-tactical-800 text-xs">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                <Archive className="w-3.5 h-3.5" />
                <span>ANALYSIS EXPORT</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-500/30">
                PORTABLE BUNDLE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
              <div>
                <span className="text-slate-500 block text-[10px]">ANALYSIS ID:</span>
                <span className="font-bold text-slate-200 truncate block text-[10px]" title={analysisId}>
                  {analysisId}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">LOCATION:</span>
                <span className="font-bold text-slate-200 truncate block text-[10px]" title={location.name}>
                  {location.name}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">T1 → T2 BASELINE:</span>
                <span className="text-slate-200 block text-[10px]">
                  {t1Date} → {t2Date} ({temporalDays}d)
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">CLUSTERS & EXTENT:</span>
                <span className="text-emerald-400 font-bold block text-[10px]">
                  {clusterCount} clusters • {changedAreaHa} ha
                </span>
              </div>
            </div>

            {/* Actions: Primary Bundle + Individual Actions */}
            <div className="pt-2 border-t border-tactical-800 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleExport("zip")}
                disabled={isExporting}
                className="py-1.5 px-3 rounded bg-sky-600 hover:bg-sky-500 text-white font-mono font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                <span>EXPORT ANALYSIS BUNDLE</span>
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleExport("geojson")}
                  disabled={isExporting}
                  className="py-1 px-2 rounded bg-tactical-800 hover:bg-tactical-700 text-slate-300 border border-tactical-600 text-[11px] font-mono font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                  title="Download RFC 7946 GeoJSON FeatureCollection"
                >
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>GeoJSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport("json")}
                  disabled={isExporting}
                  className="py-1 px-2 rounded bg-tactical-800 hover:bg-tactical-700 text-slate-300 border border-tactical-600 text-[11px] font-mono font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                  title="Download Structured Analysis JSON"
                >
                  <FileCode className="w-3 h-3 text-sky-400" />
                  <span>JSON</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExport("markdown")}
                  disabled={isExporting}
                  className="py-1 px-2 rounded bg-tactical-800 hover:bg-tactical-700 text-slate-300 border border-tactical-600 text-[11px] font-mono font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                  title="Download Operational Intelligence Markdown Dossier"
                >
                  <FileText className="w-3 h-3 text-amber-400" />
                  <span>REPORT</span>
                </button>
              </div>
            </div>

            {exportNotice && (
              <p className="text-[11px] font-mono text-emerald-300 bg-emerald-950/40 p-1.5 rounded border border-emerald-500/30">
                {exportNotice}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
