"use client";

import React from "react";
import { ChangeDetectionResult } from "@/types";
import { Gauge, CheckCircle2, AlertTriangle } from "lucide-react";

interface ConfidenceCardProps {
  analysis: ChangeDetectionResult | null;
}

export function ConfidenceCard({ analysis }: ConfidenceCardProps) {
  if (!analysis) return null;

  const isChangeDetected = analysis.status === "CHANGE_DETECTED";
  const confidencePercent = ((analysis.confidence_score ?? 0) * 100).toFixed(1);
  const changeRatioPercent = (analysis.change_ratio * 100).toFixed(2);

  const confidenceTitle = !isChangeDetected
    ? "Analytical Confidence (Invariance)"
    : "Analytical Confidence Score";

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-tactical-700/60">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h3 className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 uppercase">
            Confidence & Pixel-Level Telemetry
          </h3>
        </div>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded flex items-center gap-1 ${
            isChangeDetected
              ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40"
              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
          }`}
        >
          {isChangeDetected ? (
            <>
              <AlertTriangle className="w-3 h-3 text-rose-500" />
              <span>CHANGE DETECTED</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>INVARIANT / NO CHANGE</span>
            </>
          )}
        </span>
      </div>

      {/* Grid of Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Metric 1: Confidence */}
        <div className="bg-tactical-900 p-3 rounded-lg border border-tactical-700 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase leading-tight">
            {confidenceTitle}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400">{confidencePercent}%</span>
          </div>
          <div className="w-full bg-tactical-750 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full"
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Change Ratio */}
        <div className="bg-tactical-900 p-3 rounded-lg border border-tactical-700 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase leading-tight">
            Change Area Ratio
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">{changeRatioPercent}%</span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">area</span>
          </div>
          <div className="w-full bg-tactical-750 h-1 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-amber-500 h-full rounded-full"
              style={{ width: `${Math.min(100, analysis.change_ratio * 100)}%` }}
            />
          </div>
        </div>

        {/* Metric 3: Changed Pixels */}
        <div className="bg-tactical-900 p-3 rounded-lg border border-tactical-700 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase leading-tight">
            Changed Pixels
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">
              {analysis.changed_pixels.toLocaleString()}
            </span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">px</span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 mt-1">
            of {analysis.total_pixels.toLocaleString()} total
          </span>
        </div>

        {/* Metric 4: Regions */}
        <div className="bg-tactical-900 p-3 rounded-lg border border-tactical-700 flex flex-col justify-between">
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase leading-tight">
            Contiguous Clusters
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {analysis.change_regions?.length || 0}
            </span>
            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">components</span>
          </div>
          <span className="text-[9px] font-mono text-slate-500 mt-1">
            Filtered (min {20}px)
          </span>
        </div>
      </div>

      {/* Confidence Breakdown Diagnostic Bar */}
      {analysis.confidence_breakdown && (
        <div className="mt-3 pt-3 border-t border-tactical-700/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
          <div className="flex items-center justify-between px-2 py-1 rounded bg-tactical-900/60 border border-tactical-700">
            <span className="text-slate-500 dark:text-slate-400">Signal Contrast:</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">
              {analysis.confidence_breakdown.signal_contrast?.toFixed(3) ?? "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-tactical-900/60 border border-tactical-700">
            <span className="text-slate-500 dark:text-slate-400">Spatial Coherence:</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">
              {analysis.confidence_breakdown.spatial_coherence?.toFixed(3) ?? "N/A"}
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-tactical-900/60 border border-tactical-700">
            <span className="text-slate-500 dark:text-slate-400">Alignment Penalty:</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">
              {analysis.confidence_breakdown.alignment_penalty?.toFixed(3) ?? "0.000"}
            </span>
          </div>

          <div className="flex items-center justify-between px-2 py-1 rounded bg-tactical-900/60 border border-tactical-700">
            <span className="text-slate-500 dark:text-slate-400">Quality Penalty:</span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">
              {analysis.confidence_breakdown.quality_penalty?.toFixed(3) ?? "0.000"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
