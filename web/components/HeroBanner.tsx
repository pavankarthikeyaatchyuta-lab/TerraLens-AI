"use client";

import React from "react";
import { Sparkles, BarChart3, Github, Compass, ShieldAlert, ArrowDown } from "lucide-react";

interface HeroBannerProps {
  onOpenEvaluation: () => void;
  onLaunchConsole: () => void;
}

export function HeroBanner({ onOpenEvaluation, onLaunchConsole }: HeroBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-tactical-700 bg-tactical-850 p-6 md:p-8 shadow-sm transition-colors">
      <div className="relative z-10 max-w-4xl space-y-4">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-full bg-sky-600/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-semibold tracking-wider">
            SIH 2026
          </span>
          <span className="px-2.5 py-1 rounded-full bg-tactical-800 text-slate-700 dark:text-slate-300 border border-tactical-700 font-medium">
            PS: SIH26227
          </span>
          <span className="px-2.5 py-1 rounded-full bg-tactical-800 text-slate-700 dark:text-slate-300 border border-tactical-700 font-medium">
            Space Technology
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-600/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium">
            Controlled Benchmark & Live Sentinel-2 Workstation
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <div>
          <h1 className="text-3xl md:text-5xl font-black font-mono tracking-tight text-slate-900 dark:text-slate-100 uppercase">
            TERRALENS <span className="text-sky-600 dark:text-sky-400">AI</span>
          </h1>
          <p className="text-base md:text-xl font-medium text-slate-700 dark:text-slate-300 mt-1 font-mono">
            Semantic Satellite Intelligence & Multi-Temporal Change Verification
          </p>
        </div>

        {/* Workflow Motto */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tactical-900 border border-tactical-700 text-xs font-mono font-bold tracking-widest text-sky-700 dark:text-sky-300 uppercase">
          <span>SEARCH</span>
          <span className="text-slate-400">→</span>
          <span>DISCOVER</span>
          <span className="text-slate-400">→</span>
          <span>COMPARE</span>
          <span className="text-slate-400">→</span>
          <span>VERIFY</span>
          <span className="text-slate-400">→</span>
          <span>EXPORT</span>
        </div>

        {/* Description */}
        <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          Evidence-first satellite intelligence for finding, explaining, verifying and documenting temporal change. TerraLens doesn't stop at detecting change — it makes that change searchable, explainable, verifiable and auditable through 512-D semantic discovery, multi-stage false-alarm suppression, and auditable evidence dossiers.
        </p>

        {/* Call to Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={onLaunchConsole}
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-mono text-xs font-bold tracking-wider transition-all flex items-center gap-2 shadow-sm hover:scale-105 active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>LAUNCH INTELLIGENCE CONSOLE</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenEvaluation}
            className="px-4 py-2.5 rounded-xl bg-tactical-800 hover:bg-tactical-750 text-slate-700 dark:text-slate-200 border border-tactical-700 font-mono text-xs font-semibold tracking-wider transition-all flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <span>VIEW EVALUATION</span>
          </button>

          <a
            href="https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-tactical-800 hover:bg-tactical-750 text-slate-700 dark:text-slate-300 border border-tactical-700 font-mono text-xs font-semibold tracking-wider transition-all flex items-center gap-2 hover:text-slate-900 dark:hover:text-white"
          >
            <Github className="w-4 h-4" />
            <span>GITHUB</span>
          </a>
        </div>
      </div>
    </div>
  );
}
