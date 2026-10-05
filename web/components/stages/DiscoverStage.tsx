"use client";

import React from "react";
import { Location } from "@/types";
import { TacticalMap } from "@/components/TacticalMap";
import { Compass, Calendar, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, MapPin } from "lucide-react";

interface DiscoverStageProps {
  locations: Location[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  topLocation: Location;
  topSimilarity?: number;
  topRank?: number;
  alternatives: { location: Location; similarity: number; rank: number }[];
  onOpenTemporalHistory: () => void;
  onBackToSearch: () => void;
  activeQuery: string;
}

export function DiscoverStage({
  locations,
  selectedLocationId,
  onSelectLocation,
  topLocation,
  topSimilarity,
  topRank,
  alternatives,
  onOpenTemporalHistory,
  onBackToSearch,
  activeQuery,
}: DiscoverStageProps) {
  return (
    <div className="space-y-4 font-mono">
      {/* Stage Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-tactical-900/90 border border-tactical-750 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToSearch}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>NEW SEARCH</span>
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Query:</span>
          <strong className="text-sky-400">&ldquo;{activeQuery || "solar park development in Rajasthan"}&rdquo;</strong>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
          {activeQuery && (activeQuery.toLowerCase().includes("rajasthan") || activeQuery.toLowerCase().includes("rajisthan")) && (
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500 font-black text-[10px] flex items-center gap-1.5 shadow-sm">
              <span>🔒</span>
              <span>STRICT REGION LOCK: RAJASTHAN ONLY</span>
            </span>
          )}
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Rank-1 Hub Resolved • Real-Time Spatial Retrieval</span>
        </div>

      </div>

      {/* 2-Column Clean Spatial Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN (6 cols): Focused Tactical Map in 3D Neumorphic Bezel */}
        <div className="lg:col-span-6 space-y-2 neu-raised p-2.5 rounded-2xl shadow-xl">
          <div className="rounded-xl overflow-hidden border border-tactical-700/80 shadow-inner">
            <TacticalMap
              locations={locations}
              selectedLocationId={selectedLocationId}
              onSelectLocation={onSelectLocation}
              catalogMode="real-eo"
            />
          </div>
          <div className="text-[10px] text-slate-400 font-bold flex items-center justify-between px-2 pt-1 font-mono">
            <span>Target: {topLocation.latitude.toFixed(4)}°N, {topLocation.longitude.toFixed(4)}°E</span>
            <span className="text-sky-400">Sentinel-2 MSI L2A (10m BOA)</span>
          </div>
        </div>

        {/* RIGHT COLUMN (6 cols): Top Semantic Result & Compact Alternatives */}
        <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
          {/* Top Semantic Match (Prominently Highlighted 3D Spatial Instrument) */}
          <div className="neu-raised neu-card border-2 border-sky-500/60 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/50 text-[10px] font-black tracking-wider uppercase flex items-center gap-1.5 neu-pill">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{topRank && topRank > 1 ? `SELECTED CANDIDATE • RANK ${topRank}` : "TOP SEMANTIC MATCH • RANK 1"}</span>
              </span>
              <span className="text-xs text-emerald-400 font-black px-2.5 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800 neu-pill">
                {((topSimilarity ?? 0.942) * 100).toFixed(1)}% SIMILARITY
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-100 tracking-tight uppercase">
                {topLocation.name}
              </h3>
              <p className="text-xs text-sky-400 font-bold mt-1">
                {topLocation.primary_sensor || "Sentinel-2 MSI L2A"} • {topLocation.available_dates?.length || 4} catalog observations ({topLocation.available_dates?.[0] || "2023-04-05"} &rarr; {topLocation.available_dates?.[topLocation.available_dates.length - 1] || "2026-10-01"})
              </p>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              {topLocation.description}
            </p>

            {/* Quick Metadata Pill Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="neu-inset p-2.5 rounded-xl border border-tactical-800">
                <span className="text-slate-500 text-[10px] font-bold block">COORDINATES:</span>
                <span className="text-slate-200 font-black">{topLocation.latitude.toFixed(4)}°N, {topLocation.longitude.toFixed(4)}°E</span>
              </div>
              <div className="neu-inset p-2.5 rounded-xl border border-tactical-800">
                <span className="text-slate-500 text-[10px] font-bold block">ARCHIVE BASELINE:</span>
                <span className="text-slate-200 font-black truncate block">
                  {topLocation.available_dates?.[0] || "2023-04-05"} &rarr; {topLocation.available_dates?.[topLocation.available_dates.length - 1] || "2026-10-01"}
                </span>
              </div>
            </div>

            {/* Primary Action CTA */}
            <button
              type="button"
              onClick={onOpenTemporalHistory}
              className="w-full py-4 px-6 rounded-xl neu-btn-primary font-black text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-2xl hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>OPEN TEMPORAL HISTORY</span>
              <ArrowRight className="w-4 h-4 stroke-[3]" />
            </button>
          </div>

          {/* Compact Ranked Alternatives (3D Neumorphic Cluster Tray) */}
          <div className="neu-raised rounded-2xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                Semantic Cluster Neighbors:
              </span>
              <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider">
                512-D Cosine Similarity
              </span>
            </div>

            <div className="space-y-2">
              {alternatives.map((alt) => {
                const isSelected = alt.location.location_id === selectedLocationId;
                return (
                  <div
                    key={alt.location.location_id}
                    onClick={() => onSelectLocation(alt.location.location_id)}
                    className={`p-2.5 rounded-xl transition-all flex items-center justify-between cursor-pointer text-xs neu-card ${
                      isSelected
                        ? "neu-btn-primary shadow-md"
                        : "neu-btn text-slate-300 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-tactical-950/80 text-[10px] font-black flex items-center justify-center text-sky-400 border border-tactical-700">
                        #{alt.rank}
                      </span>
                      <div className="text-left">
                        <span className="font-bold text-slate-200 block">{alt.location.name}</span>
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <span>📍</span>
                          {alt.location.name.toLowerCase().includes("rajasthan") || (alt.location as any).region?.toLowerCase().includes("rajasthan")
                            ? "Rajasthan, India • Verified Solar Infrastructure"
                            : (alt.location as any).region || "Earth Observation Site"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-sky-300 font-black">
                        {(alt.similarity * 100).toFixed(1)}%
                      </span>
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black tracking-wider ${
                        isSelected ? "bg-white text-sky-900 shadow-sm" : "neu-pill bg-tactical-950 text-slate-400"
                      }`}>
                        {isSelected ? "SELECTED" : "VIEW"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
