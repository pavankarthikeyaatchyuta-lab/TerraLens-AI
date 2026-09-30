"use client";

import React from "react";
import { SearchResult, Location } from "@/types";
import { Layers, Calendar, Compass, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

interface SceneCatalogProps {
  results: SearchResult[];
  allLocations: Location[];
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
  searchOutcome?: any;
  onSelectBenchmarkQuery?: (query: string) => void;
}

export function SceneCatalog({
  results,
  allLocations,
  selectedLocationId,
  onSelectLocation,
  searchOutcome,
  onSelectBenchmarkQuery,
}: SceneCatalogProps) {
  // If no search results, show all locations
  const items = results.length > 0
    ? results
    : allLocations.map((loc, idx) => ({
        rank: idx + 1,
        similarity_score: 0.25,
        location: loc,
        scene: {
          scene_id: loc.before_scene_id || "",
          location_id: loc.location_id,
          acquisition_date: loc.available_dates[0] || "2023",
          sensor: loc.primary_sensor,
          cloud_percentage: 1.2,
          tags: loc.tags,
          image_path: `/samples/${loc.location_id}/before_2023.jpg`,
        },
      }));

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3 border-b border-tactical-700/60 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold font-mono tracking-wide text-slate-100 uppercase">
            {results.length > 0 ? `Semantic Matches (${results.length})` : "Candidate Locations Archive"}
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">FAISS Normalized Cosine</span>
      </div>

      {searchOutcome && searchOutcome.supported === false && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-300 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>CONTROLLED BENCHMARK NOTICE</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Query <span className="text-amber-200 font-semibold">&ldquo;{searchOutcome.query}&rdquo;</span> is not available in Controlled Benchmark Mode. Public demo evaluation uses pre-indexed 512-dim normalized vectors for verified benchmark queries.
          </p>
          <div className="pt-1">
            <span className="text-[10px] text-slate-400 block mb-1.5">Select a verified benchmark query:</span>
            <div className="flex flex-col gap-1.5">
              {searchOutcome.supported_benchmark_queries?.map((q: string) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSelectBenchmarkQuery?.(q)}
                  className="text-[11px] px-2.5 py-1 rounded bg-tactical-800 border border-tactical-700 text-cyan-300 hover:border-cyan-400 hover:bg-tactical-750 transition-colors text-left font-mono"
                >
                  &rarr; {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {items.map((item) => {
          const isSelected = item.location.location_id === selectedLocationId;
          const scorePercent = Math.min(100, Math.max(0, (item.similarity_score / 0.40) * 100));

          return (
            <div
              key={item.location.location_id + (item.scene?.scene_id || "")}
              onClick={() => onSelectLocation(item.location.location_id)}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                isSelected
                  ? "bg-tactical-800/90 border-cyan-400 shadow-md shadow-cyan-950/50 ring-1 ring-cyan-400/50"
                  : "bg-tactical-900/60 border-tactical-700/70 hover:border-slate-500 hover:bg-tactical-900"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? "bg-cyan-500 text-slate-950"
                        : "bg-tactical-700 text-slate-300"
                    }`}
                  >
                    #{item.rank}
                  </span>
                  <span className="text-xs font-semibold text-slate-200 line-clamp-1 font-mono">
                    {item.location.name}
                  </span>
                </div>

                {results.length > 0 && (
                  <span className="text-[11px] font-mono font-bold text-cyan-400">
                    {item.similarity_score.toFixed(4)}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {item.location.description}
              </p>

              {/* Progress bar of similarity score */}
              {results.length > 0 && (
                <div className="w-full bg-tactical-700/50 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-tactical-700/40 text-[10px] text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Compass className="w-3 h-3 text-cyan-400" />
                  {item.location.latitude.toFixed(2)}°N, {item.location.longitude.toFixed(2)}°E
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {item.location.available_dates?.join(" → ") || "2023 - 2025"}
                </span>
                {isSelected ? (
                  <span className="text-cyan-400 font-bold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> ACTIVE
                  </span>
                ) : (
                  <span className="text-slate-500 flex items-center gap-0.5">
                    SELECT <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
