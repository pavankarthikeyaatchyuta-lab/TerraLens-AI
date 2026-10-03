"use client";

import React from "react";
import { SearchResult, Location, Scene } from "@/types";
import { Layers, Calendar, Compass, ArrowRight, CheckCircle2, AlertTriangle, Crosshair, Sparkles } from "lucide-react";

interface SceneCatalogProps {
  results: SearchResult[];
  allLocations: Location[];
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
  searchOutcome?: any;
  onSelectBenchmarkQuery?: (query: string) => void;
  onHandoffToLive?: (location: Location) => void;
  catalogMode?: "benchmark" | "real-eo";
  selectedSceneId?: string;
  onSelectResult?: (result: SearchResult) => void;
  allScenes?: Scene[];
  onFindSimilarLocations?: (scene: Scene) => void;
}

export function SceneCatalog({
  results,
  allLocations,
  selectedLocationId,
  onSelectLocation,
  searchOutcome,
  onSelectBenchmarkQuery,
  onHandoffToLive,
  catalogMode = "benchmark",
  selectedSceneId,
  onSelectResult,
  allScenes = [],
  onFindSimilarLocations,
}: SceneCatalogProps) {
  const isRealEo = catalogMode === "real-eo";

  // If no search results, show all locations
  const items: SearchResult[] = results.length > 0
    ? results
    : allLocations.map((loc, idx) => {
        const matchingScene = allScenes.find((s) => s.location_id === loc.location_id);
        const imagePath = matchingScene?.image_path ||
          (isRealEo
            ? `/eo_catalog/thumbnails/${matchingScene?.scene_id || loc.location_id}.jpg`
            : `/samples/${loc.location_id}/before_2023.jpg`);

        return {
          rank: idx + 1,
          similarity_score: isRealEo ? 0.28 : 0.25,
          location: loc,
          scene: {
            scene_id: matchingScene?.scene_id || loc.before_scene_id || "",
            location_id: loc.location_id,
            acquisition_date: matchingScene?.acquisition_date || loc.available_dates?.[0] || "2026",
            sensor: matchingScene?.sensor || loc.primary_sensor,
            cloud_percentage: matchingScene?.cloud_percentage ?? 1.2,
            tags: matchingScene?.tags || loc.tags,
            image_path: imagePath,
          },
        };
      });

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-tactical-700/60 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          <h2 className="text-sm font-bold font-mono tracking-wide text-slate-800 dark:text-slate-100 uppercase">
            {results.length > 0 ? `Semantic Matches (${results.length})` : "Candidate Locations Archive"}
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
          {isRealEo ? "REAL EO INDEX: 70 SCENES • FAISS INDEXFLATIP" : "OFFLINE INDEX: FAISS • NORMALIZED COSINE"}
        </span>
      </div>

      {searchOutcome && searchOutcome.supported === false && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs font-mono text-amber-700 dark:text-amber-300 space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>CONTROLLED BENCHMARK NOTICE</span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            Query <span className="text-amber-700 dark:text-amber-200 font-semibold">&ldquo;{searchOutcome.query}&rdquo;</span> is not available in Controlled Benchmark Mode. Public demo evaluation uses pre-indexed 512-dim normalized vectors for verified benchmark queries.
          </p>
          <div className="pt-1">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-1.5">Select a verified benchmark query:</span>
            <div className="flex flex-col gap-1.5">
              {searchOutcome.supported_benchmark_queries?.map((q: string) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onSelectBenchmarkQuery?.(q)}
                  className="text-[11px] px-2.5 py-1 rounded bg-tactical-800 border border-tactical-700 text-sky-600 dark:text-sky-300 hover:border-sky-500 hover:bg-tactical-750 transition-colors text-left font-mono"
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
              onClick={() => {
                onSelectLocation(item.location.location_id);
                onSelectResult?.(item);
              }}
              className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col gap-2 ${
                isSelected
                  ? isRealEo
                    ? "bg-tactical-800/90 border-indigo-500 ring-1 ring-indigo-500/40 shadow-sm"
                    : "bg-tactical-800/90 border-sky-500 ring-1 ring-sky-500/40 shadow-sm"
                  : "bg-tactical-900/60 border-tactical-700/70 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-tactical-900"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      isSelected
                        ? isRealEo
                          ? "bg-indigo-600 text-white"
                          : "bg-sky-600 text-white"
                        : "bg-tactical-700 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    #{item.rank}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 font-mono">
                    {item.location.name}
                  </span>
                </div>

                {results.length > 0 && (
                  <span className={`text-[11px] font-mono font-bold ${isRealEo ? "text-indigo-600 dark:text-indigo-400" : "text-sky-600 dark:text-sky-400"}`}>
                    {item.similarity_score.toFixed(4)}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                {item.location.description}
              </p>

              {/* Progress bar of similarity score */}
              {results.length > 0 && (
                <div className="w-full bg-tactical-700/50 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isRealEo ? "bg-indigo-500" : "bg-sky-500"}`}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-tactical-700/40 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                <span className="flex items-center gap-1">
                  <Compass className={`w-3 h-3 ${isRealEo ? "text-indigo-500" : "text-sky-600 dark:text-sky-400"}`} />
                  {item.location.latitude.toFixed(2)}°N, {item.location.longitude.toFixed(2)}°E
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  {item.location.available_dates?.join(" → ") || "2023 - 2026"}
                </span>
                {isSelected ? (
                  <span className={`${isRealEo ? "text-indigo-600 dark:text-indigo-400" : "text-sky-600 dark:text-sky-400"} font-bold flex items-center gap-0.5`}>
                    <CheckCircle2 className="w-3 h-3" /> ACTIVE
                  </span>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 flex items-center gap-0.5">
                    SELECT <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>

              {onFindSimilarLocations && isSelected && item.scene?.scene_id && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFindSimilarLocations(item.scene);
                  }}
                  className="w-full mt-1.5 py-1.5 px-2.5 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-sm"
                  title="Discover other locations with high visual/semantic similarity to this scene"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  <span>FIND SEMANTICALLY SIMILAR LOCATIONS &rarr;</span>
                </button>
              )}

              {onHandoffToLive && isSelected && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHandoffToLive(item.location);
                  }}
                  className={`w-full mt-1 py-1.5 px-2.5 rounded text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
                    isRealEo
                      ? "bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                      : "bg-sky-500/15 hover:bg-sky-500/25 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                  }`}
                >
                  <Crosshair className={`w-3.5 h-3.5 ${isRealEo ? "text-indigo-500" : "text-sky-600 dark:text-sky-400"}`} />
                  <span>
                    {isRealEo
                      ? "DISCOVER SENTINEL-2 TEMPORAL PAIRS \u2192"
                      : "LAUNCH IN LIVE SENTINEL-2 WORKFLOW \u2192"}
                  </span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
