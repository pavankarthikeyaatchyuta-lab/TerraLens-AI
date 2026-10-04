"use client";

import React, { useState } from "react";
import { Search, Sparkles, Loader2, ArrowRight, Zap, Shield, Compass } from "lucide-react";

interface SearchStageProps {
  onExecuteSearch: (query: string) => void;
  onSelectSihDemo: () => void;
  isLoading: boolean;
  activeQuery: string;
}

const PRESET_QUERIES = [
  { label: "Urban Expansion", query: "urban expansion and new construction near river" },
  { label: "Reservoir Drying", query: "water reservoir shoreline drying and lake shrinkage" },
  { label: "Forest Clearance", query: "forest road clearing corridor and tree removal" },
  { label: "Coastal Port", query: "coastal port reclamation and ocean harbor pier" },
];

export function SearchStage({
  onExecuteSearch,
  onSelectSihDemo,
  isLoading,
  activeQuery,
}: SearchStageProps) {
  const [queryInput, setQueryInput] = useState(activeQuery || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      onExecuteSearch(queryInput.trim());
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 md:py-14 space-y-8 font-mono">
      {/* Primary Workspace Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-600/10 border border-sky-500/30 text-sky-400 text-xs font-semibold tracking-wider uppercase">
          <Compass className="w-3.5 h-3.5" />
          <span>STAGE 1: SEMANTIC SATELLITE DISCOVERY</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-100 uppercase">
          What are you looking for?
        </h2>
        <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-sans">
          Search arbitrary Earth-observation activity in natural language. Powered by 512-dimensional CLIP embeddings with sub-25ms vector retrieval across regional catalogs.
        </p>
      </div>

      {/* Primary Large Search Form */}
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center shadow-lg rounded-2xl bg-tactical-900 border-2 border-tactical-700 focus-within:border-sky-500 transition-colors">
          <Search className="absolute left-5 w-6 h-6 text-slate-500" />
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="e.g. solar park development in Rajasthan, reservoir drying, forest corridor..."
            className="w-full bg-transparent pl-14 pr-36 py-4 text-base md:text-lg text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
            autoFocus
          />
          <button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            className="absolute right-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-tactical-800 disabled:text-slate-600 text-white font-bold text-xs md:text-sm tracking-wider transition-all flex items-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>SEARCHING...</span>
              </>
            ) : (
              <>
                <span>SEARCH</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* SIH Deterministic Judge Preset Card */}
      <div className="bg-tactical-900/90 border border-sky-500/40 rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold tracking-wider uppercase">
              SIH JUDGE DEMO PATH
            </span>
            <span className="text-xs text-slate-400">Deterministic Multi-Temporal Evaluation</span>
          </div>
          <h3 className="text-base font-bold text-slate-100">
            &ldquo;solar park development in Rajasthan&rdquo;
          </h3>
          <p className="text-xs text-slate-400 font-sans">
            Resolves directly to Bhadla Solar Park • 710-day Sentinel-2 observation baseline (2023-04-05 &rarr; 2025-03-15) • 60.22 ha detected change.
          </p>
        </div>

        <button
          type="button"
          onClick={onSelectSihDemo}
          className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>LAUNCH SIH DEMO — SOLAR</span>
        </button>
      </div>

      {/* Secondary Exploration Chips */}
      <div className="space-y-2 pt-2">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block text-center">
          Or explore verified semantic concepts:
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setQueryInput(preset.query);
                onExecuteSearch(preset.query);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 hover:border-slate-500 text-xs text-slate-300 transition-colors"
            >
              &rarr; {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
