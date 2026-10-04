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

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Rank-1 Hub Resolved • Sub-25ms Vector Search</span>
        </div>
      </div>

      {/* 2-Column Clean Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* LEFT COLUMN (5 cols): Focused Tactical Map */}
        <div className="lg:col-span-6 space-y-2">
          <TacticalMap
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSelectLocation={onSelectLocation}
            catalogMode="real-eo"
          />
          <div className="text-[10px] text-slate-500 flex items-center justify-between px-1">
            <span>Target Location: {topLocation.latitude.toFixed(4)}°N, {topLocation.longitude.toFixed(4)}°E</span>
            <span>Sensor: Sentinel-2 MSI L2A (10m)</span>
          </div>
        </div>

        {/* RIGHT COLUMN (6 cols): Top Semantic Result & Compact Alternatives */}
        <div className="lg:col-span-6 space-y-4 flex flex-col justify-between">
          {/* Top Semantic Match (Prominently Highlighted) */}
          <div className="bg-tactical-900 border-2 border-sky-500/50 rounded-2xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-sky-400" />
                <span>TOP SEMANTIC MATCH • RANK 1</span>
              </span>
              <span className="text-xs text-emerald-400 font-bold">94.2% SIMILARITY</span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-100 tracking-tight uppercase">
                {topLocation.name}
              </h3>
              <p className="text-xs text-sky-400/90 mt-0.5">
                {topLocation.primary_sensor || "Sentinel-2 MSI L2A"} • 39 usable observations
              </p>
            </div>

            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              {topLocation.description}
            </p>

            {/* Quick Metadata Pill Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-tactical-800">
              <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                <span className="text-slate-500 text-[10px] block">COORDINATES:</span>
                <span className="text-slate-200 font-bold">{topLocation.latitude.toFixed(4)}°N, {topLocation.longitude.toFixed(4)}°E</span>
              </div>
              <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                <span className="text-slate-500 text-[10px] block">ARCHIVE BASELINE:</span>
                <span className="text-slate-200 font-bold">
                  {topLocation.available_dates?.[0] || "2023-04-05"} &rarr; {topLocation.available_dates?.[1] || "2025-03-15"}
                </span>
              </div>
            </div>

            {/* Primary Action CTA */}
            <button
              type="button"
              onClick={onOpenTemporalHistory}
              className="w-full py-3.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:scale-[1.01] active:scale-[0.99]"
            >
              <span>OPEN TEMPORAL HISTORY</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Compact Ranked Alternatives */}
          <div className="bg-tactical-900/80 border border-tactical-750 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">
                Semantic Cluster Neighbors:
              </span>
              <span className="text-[9px] text-sky-400 font-bold uppercase tracking-wider">
                512-D Cosine Similarity
              </span>
            </div>

            <div className="space-y-1.5">
              {alternatives.map((alt) => {
                const isSelected = alt.location.location_id === selectedLocationId;
                return (
                  <div
                    key={alt.location.location_id}
                    onClick={() => onSelectLocation(alt.location.location_id)}
                    className={`p-2 rounded-lg border transition-all flex items-center justify-between cursor-pointer text-xs ${
                      isSelected
                        ? "bg-sky-950/40 border-sky-500 text-white"
                        : "bg-tactical-950 border-tactical-800 hover:border-tactical-700 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-tactical-800 text-[10px] font-bold flex items-center justify-center text-slate-400">
                        #{alt.rank}
                      </span>
                      <span className="font-semibold text-slate-200">{alt.location.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-sky-400 font-bold">
                        {(alt.similarity * 100).toFixed(1)}%
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        isSelected ? "bg-sky-600 text-white" : "bg-tactical-800 text-slate-400"
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
