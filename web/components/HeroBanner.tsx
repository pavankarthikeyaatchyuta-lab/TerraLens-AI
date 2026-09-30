"use client";

import React from "react";
import { Sparkles, BarChart3, Github, Compass, ShieldAlert, ArrowDown } from "lucide-react";

interface HeroBannerProps {
  onOpenEvaluation: () => void;
  onLaunchConsole: () => void;
}

export function HeroBanner({ onOpenEvaluation, onLaunchConsole }: HeroBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-tactical-700 bg-gradient-to-b from-tactical-850 via-tactical-900 to-tactical-950 p-6 md:p-8 shadow-2xl">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl space-y-4">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold tracking-wider">
            SIH 2026
          </span>
          <span className="px-2.5 py-1 rounded-full bg-tactical-800 text-slate-300 border border-tactical-700">
            PS: SIH26227
          </span>
          <span className="px-2.5 py-1 rounded-full bg-tactical-800 text-slate-300 border border-tactical-700">
            Space Technology
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Public Demo — Controlled Benchmark Mode
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <div>
          <h1 className="text-3xl md:text-5xl font-black font-mono tracking-tight text-slate-100 uppercase">
            TERRALENS <span className="text-cyan-400">AI</span>
          </h1>
          <p className="text-base md:text-xl font-medium text-slate-300 mt-1 font-mono">
            Semantic Satellite Intelligence
          </p>
        </div>

        {/* Workflow Motto */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-tactical-900/90 border border-tactical-700 text-xs font-mono font-bold tracking-widest text-cyan-300 uppercase shadow-inner">
          <span>SEARCH</span>
          <span className="text-slate-600">→</span>
          <span>DISCOVER</span>
          <span className="text-slate-600">→</span>
          <span>COMPARE</span>
          <span className="text-slate-600">→</span>
          <span>VERIFY</span>
        </div>

        {/* Description */}
        <p className="text-xs md:text-sm text-slate-400 max-w-2xl leading-relaxed">
          Autonomous multi-temporal satellite change intelligence workstation. Natural-language semantic discovery powered by 512-dimensional CLIP embeddings coupled with deterministic bi-temporal radiometric normalization, morphological false-alarm suppression, and auditable evidence provenance.
        </p>

        {/* Call to Actions */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            onClick={onLaunchConsole}
            className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-cyan-950/50 hover:scale-105 active:scale-95"
          >
            <Compass className="w-4 h-4" />
            <span>LAUNCH INTELLIGENCE CONSOLE</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOpenEvaluation}
            className="px-4 py-2.5 rounded-xl bg-tactical-800 hover:bg-tactical-750 text-slate-200 border border-tactical-600 font-mono text-xs font-semibold tracking-wider transition-all flex items-center gap-2 hover:border-cyan-400/50"
          >
            <BarChart3 className="w-4 h-4 text-cyan-400" />
            <span>VIEW EVALUATION</span>
          </button>

          <a
            href="https://github.com/pavankarthikeyaatchyuta-lab/TerraLens-AI"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-tactical-800/80 hover:bg-tactical-750 text-slate-300 border border-tactical-700 font-mono text-xs font-semibold tracking-wider transition-all flex items-center gap-2 hover:text-white"
          >
            <Github className="w-4 h-4" />
            <span>GITHUB</span>
          </a>
        </div>
      </div>
    </div>
  );
}
