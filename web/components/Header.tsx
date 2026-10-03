"use client";

import React from "react";
import { Activity, ShieldCheck, Database, BarChart3, Radio, Globe, Terminal, Sun, Moon } from "lucide-react";
import { OperatingMode } from "@/lib/providers/satelliteProvider";
import { useTheme } from "@/lib/themeContext";

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
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-tactical-700 bg-tactical-850/95 backdrop-blur-md px-4 py-3 sticky top-0 z-40 transition-colors shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-3">
        {/* Brand & SIH Badge */}
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-600/10 dark:bg-sky-500/20 border border-sky-500/30 text-sky-600 dark:text-sky-400 font-bold shadow-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-wider text-slate-900 dark:text-slate-100 uppercase font-mono">
                  TerraLens <span className="text-sky-600 dark:text-sky-400">AI</span>
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-tactical-800 text-sky-700 dark:text-sky-300 border border-tactical-700 tracking-wider font-semibold">
                  SIH26227
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
                Semantic Satellite Intelligence & Multi-Temporal Change Verification
              </p>
            </div>
          </div>

          {/* Mode Switcher Segmented Control (Mobile & Desktop) */}
          {onSelectMode && (
            <div className="flex items-center p-0.5 rounded-lg bg-tactical-900 border border-tactical-700 font-mono text-[10px]">
              <button
                type="button"
                onClick={() => onSelectMode("CONTROLLED_BENCHMARK")}
                className={`px-2.5 py-1 rounded transition-all ${
                  operatingMode === "CONTROLLED_BENCHMARK"
                    ? "bg-amber-600/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 font-bold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Controlled Benchmark Mode: Controlled Synthetic Data Baseline"
              >
                BENCHMARK
              </button>
              <button
                type="button"
                onClick={() => onSelectMode("REAL_EO_CATALOG")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
                  operatingMode === "REAL_EO_CATALOG"
                    ? "bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/40 font-bold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Real EO Mode: Real Sentinel-2 L2A Multi-Temporal Archive"
              >
                <Database className="w-3 h-3 text-indigo-500" />
                <span>REAL EO</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectMode("LIVE_PUBLIC_DATA")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
                  operatingMode === "LIVE_PUBLIC_DATA"
                    ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Live Public Data Mode: Live Public STAC Search"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>LIVE STAC</span>
              </button>
              <button
                type="button"
                onClick={() => onSelectMode("OFFLINE_RESEARCH")}
                className={`px-2.5 py-1 rounded transition-all ${
                  operatingMode === "OFFLINE_RESEARCH"
                    ? "bg-slate-600/20 text-slate-700 dark:text-slate-300 border border-slate-500/40 font-bold shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Offline Research Mode: Local Python Harness"
              >
                RESEARCH
              </button>
            </div>
          )}
        </div>

        {/* Tactical HUD Telemetry Badges & Theme Toggle */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Prominent Active Data Mode Badge */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] font-bold border transition-colors ${
              operatingMode === "CONTROLLED_BENCHMARK"
                ? "bg-amber-950/40 border-amber-500/60 text-amber-300"
                : operatingMode === "REAL_EO_CATALOG"
                ? "bg-indigo-950/40 border-indigo-500/60 text-indigo-300"
                : operatingMode === "LIVE_PUBLIC_DATA"
                ? "bg-emerald-950/40 border-emerald-500/60 text-emerald-300"
                : "bg-tactical-800 border-tactical-700 text-slate-300"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                operatingMode === "LIVE_PUBLIC_DATA"
                  ? "bg-emerald-400 animate-pulse"
                  : operatingMode === "REAL_EO_CATALOG"
                  ? "bg-indigo-400"
                  : operatingMode === "CONTROLLED_BENCHMARK"
                  ? "bg-amber-400"
                  : "bg-sky-400"
              }`}
            ></span>
            <span>
              {operatingMode === "CONTROLLED_BENCHMARK"
                ? "CONTROLLED SYNTHETIC DATA"
                : operatingMode === "REAL_EO_CATALOG"
                ? "REAL SENTINEL-2 L2A"
                : operatingMode === "LIVE_PUBLIC_DATA"
                ? "LIVE PUBLIC STAC SEARCH"
                : "OFFLINE RESEARCH HARNESS"}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-800 border border-tactical-700 text-slate-700 dark:text-slate-300 font-mono">
            <Database className={`w-3.5 h-3.5 ${operatingMode === "REAL_EO_CATALOG" ? "text-indigo-500" : "text-sky-600 dark:text-sky-400"}`} />
            <span>INDEX: {totalScenes} SCENES</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-800 border border-tactical-700 text-slate-700 dark:text-slate-300 font-mono hidden md:flex">
            <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>
              {latencyMs !== undefined
                ? `RETRIEVAL: ${latencyMs.toFixed(2)}ms`
                : "BENCHMARK: 21.47ms"}
            </span>
          </div>

          <button
            onClick={onOpenEvaluation}
            className="flex items-center gap-1.5 px-3 py-1 rounded bg-sky-600/10 hover:bg-sky-600/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-mono font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
          >
            <BarChart3 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>EVALUATION</span>
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-800 hover:bg-tactical-750 text-slate-700 dark:text-slate-200 border border-tactical-700 font-mono text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm"
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">LIGHT</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-600" />
                <span className="hidden sm:inline">DARK</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
