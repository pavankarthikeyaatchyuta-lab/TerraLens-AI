"use client";

import React, { useState } from "react";
import { Search, Sparkles, X, Loader2 } from "lucide-react";

interface SearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
  activeQuery: string;
}

const PRESET_QUERIES = [
  { label: "Urban Expansion", query: "urban expansion and new construction near river" },
  { label: "Reservoir Drought", query: "water reservoir shoreline drying and lake shrinkage" },
  { label: "Forest Corridor", query: "forest road clearing corridor and tree removal" },
  { label: "Coastal Port", query: "coastal port reclamation and ocean harbor pier" },
  { label: "Solar Park", query: "solar panel farm photovoltaic arrays in desert terrain" },
];

export function SearchBar({ onSearch, isLoading, activeQuery }: SearchBarProps) {
  const [inputVal, setInputVal] = useState(activeQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      onSearch(inputVal.trim());
    }
  };

  const handleChipClick = (q: string) => {
    setInputVal(q);
    onSearch(q);
  };

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-xl">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute left-3.5 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Enter natural-language query (e.g. 'urban expansion near water', 'reservoir drying')..."
          className="w-full bg-tactical-900 border border-tactical-600 rounded-lg pl-11 pr-28 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 font-mono transition-all"
        />

        {inputVal && (
          <button
            type="button"
            onClick={() => setInputVal("")}
            className="absolute right-24 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-cyan-800 text-white rounded-md text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 shadow"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>SEARCHING...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>RETRIEVE</span>
            </>
          )}
        </button>
      </form>

      {/* Benchmark Presets Chips */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
          <span>BENCHMARKS:</span>
        </span>
        {PRESET_QUERIES.map((item) => (
          <button
            key={item.label}
            onClick={() => handleChipClick(item.query)}
            className={`text-xs px-2.5 py-1 rounded-md font-mono border transition-all ${
              inputVal.toLowerCase() === item.query.toLowerCase()
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 font-bold"
                : "bg-tactical-800 text-slate-300 border-tactical-700 hover:border-slate-500 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Controlled Benchmark Notice */}
      <div className="mt-3 pt-2.5 border-t border-tactical-750 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5 text-cyan-300/80">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Controlled Benchmark Mode: Evaluates queries against pre-indexed 512-dim normalized vectors.</span>
        </div>
        <span className="text-slate-500 hidden sm:inline">Research Prototype: Full PyTorch/CLIP Pipeline</span>
      </div>
    </div>
  );
}
