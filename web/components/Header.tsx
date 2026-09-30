"use client";

import React from "react";
import { Activity, ShieldCheck, Database, BarChart3, Radio } from "lucide-react";

interface HeaderProps {
  onOpenEvaluation: () => void;
  latencyMs?: number;
  totalScenes?: number;
}

export function Header({ onOpenEvaluation, latencyMs, totalScenes = 10 }: HeaderProps) {
  return (
    <header className="border-b border-tactical-700 bg-tactical-900/90 backdrop-blur-md px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand & SIH Badge */}
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

        {/* Tactical HUD Telemetry Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-850 border border-tactical-700 text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>SYSTEM ONLINE</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-850 border border-tactical-700 text-slate-300 font-mono">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span>INDEX: {totalScenes} SCENES</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-tactical-850 border border-tactical-700 text-slate-300 font-mono">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>LATENCY: {latencyMs !== undefined ? `${latencyMs}ms` : "16.4ms"}</span>
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
