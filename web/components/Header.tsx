"use client";

import React from "react";
import { Activity, ShieldCheck, Database, BarChart3, Radio, Globe, Terminal } from "lucide-react";
import { OperatingMode } from "@/lib/providers/satelliteProvider";

interface HeaderProps {
  onOpenEvaluation: () => void;
  latencyMs?: number;
  totalScenes?: number;
  operatingMode?: OperatingMode;
  onSelectMode?: (mode: OperatingMode) => void;
}

export function Header({
  onOpenEvaluation,
  latencyMs,
  totalScenes = 10,
  operatingMode = "CONTROLLED_BENCHMARK",
  onSelectMode,
}: HeaderProps) {
  return (
    <header className="border-b border-tactical-700 bg-tactical-900/90 backdrop-blur-md px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Brand & SIH Badge */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 text-cyan-400 font-bold shadow-lg shadow-cyan-950/40">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-wider text-slate-100 uppercase font-mono">
                  TerraLens <span className="text-cyan-400">AI</span>
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tactical-800 text-cyan-300 border border-tactical-700 tracking-wider">
                  SIH26227
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Semantic Satellite Intelligence & Multi-Temporal Change Verification
              </p>
            </div>
          </div>

          {/* Mode Switcher Segmented Control (Mobile & Desktop) */}
          {onSelectMode && (
            <div className="flex items-center p-0.5 rounded-lg bg-tactical-950 border border-tactical-700 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => onSelectMode("CONTROLLED_BENCHMARK")}
                className={`px-2.5 py-1 rounded transition-all ${
                  operatingMode === "CONTROLLED_BENCHMARK"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Controlled Benchmark Mode (Deterministic 5-Location Evaluation Baseline)"
              >
                BENCHMARK
              </button>
              <button
                type="button"
                onClick={() => onSelectMode("LIVE_PUBLIC_DATA")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
                  operatingMode === "LIVE_PUBLIC_DATA"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Live Public Data Mode (Copernicus Sentinel-2 L2A STAC Discovery)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>LIVE STAC</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectMode("OFFLINE_RESEARCH")}
                className={`px-2.5 py-1 rounded transition-all ${
                  operatingMode === "OFFLINE_RESEARCH"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Offline Research Mode (Local Python Pipeline & Evaluation Harness)"
              >
                RESEARCH
              </button>
            </div>
          )}
        </div>

        {/* Tactical HUD Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-850 border border-tactical-700 text-slate-300 font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                operatingMode === "LIVE_PUBLIC_DATA" ? "bg-emerald-400 animate-ping" : "bg-cyan-400"
              }`}
            ></span>
            <span className="text-[11px]">
              {operatingMode === "LIVE_PUBLIC_DATA"
                ? "LIVE SENTINEL-2 ONLINE"
                : operatingMode === "OFFLINE_RESEARCH"
                ? "RESEARCH HARNESS"
                : "BENCHMARK ONLINE"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-850 border border-tactical-700 text-slate-300 font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>INDEX: {totalScenes} SCENES</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-850 border border-tactical-700 text-slate-300 font-mono">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {latencyMs !== undefined
                ? `LOCAL RETRIEVAL: ${latencyMs.toFixed(2)}ms`
                : "WARM RETRIEVAL BENCHMARK: 21.47ms"}
            </span>
          </div>

          <button
            onClick={onOpenEvaluation}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-mono font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>EVALUATION SUITE</span>
          </button>
        </div>
      </div>
    </header>
  );
}

