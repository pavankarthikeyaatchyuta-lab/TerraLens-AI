"use client";

import React, { useState, useRef, useCallback } from "react";
import { Scene, Location } from "@/types";
import { SplitSquareVertical, Columns2, Calendar, Satellite } from "lucide-react";

interface TemporalComparisonProps {
  location: Location;
  beforeScene?: Scene | null;
  afterScene?: Scene | null;
}

export function TemporalComparison({
  location,
  beforeScene,
  afterScene,
}: TemporalComparisonProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  const beforeImg = beforeScene?.image_path || `/samples/${location.location_id}/before_2023.jpg`;
  const afterImg = afterScene?.image_path || `/samples/${location.location_id}/after_2025.jpg`;

  const handlePointerDown = () => {
    isDragging.current = true;
  };

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    setSliderPos(percent);
  }, []);

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-sm transition-colors">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-tactical-700">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Satellite className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 uppercase">
              Temporal Imagery Pair: {location.name}
            </h3>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
              SYNTHETIC BENCHMARK • {location.primary_sensor} PROFILE
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            Sensor Profile: {location.primary_sensor} | Data: Controlled Synthetic Benchmark Scene (Analysis Imagery)
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 bg-tactical-900 p-1 rounded-lg border border-tactical-700 text-xs font-mono">
          <button
            onClick={() => setViewMode("slider")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
              viewMode === "slider"
                ? "bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/40"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>SWIPE SLIDER</span>
          </button>
          <button
            onClick={() => setViewMode("side-by-side")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
              viewMode === "side-by-side"
                ? "bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/40"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>SIDE-BY-SIDE</span>
          </button>
        </div>
      </div>

      {/* Main Imagery Area */}
      {viewMode === "slider" ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          className="relative w-full aspect-square max-h-[460px] rounded-lg overflow-hidden border border-tactical-700 select-none cursor-ew-resize bg-tactical-900"
        >
          {/* After image (background) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={afterImg}
            alt="After observation"
            className="absolute inset-0 w-full h-full object-cover"
          />

          {/* Before image (clipped foreground) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeImg}
              alt="Before observation"
              className="absolute inset-0 w-full h-full object-cover max-w-none"
              style={{
                width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%",
                height: "100%",
              }}
            />
            {/* Badge T1 */}
            <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-sky-700 dark:text-sky-300 font-semibold shadow-sm">
              <span>T1 (BASELINE):</span> {location.available_dates?.[0] || "2023-03"}
            </div>
          </div>

          {/* Badge T2 */}
          <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold shadow-sm">
            <span>T2 (MONITORING):</span> {location.available_dates?.[1] || "2025-02"}
          </div>

          {/* Slider divider bar (Clean, non-neon) */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-sky-500 shadow-sm pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-tactical-850 border border-sky-500 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-md">
              <SplitSquareVertical className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 aspect-[2/1] max-h-[460px]">
          {/* Before */}
          <div className="relative rounded-lg overflow-hidden border border-tactical-700 bg-tactical-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeImg}
              alt="T1 Baseline"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-sky-700 dark:text-sky-300 font-semibold shadow-sm">
              <span>T1 BASELINE:</span> {location.available_dates?.[0] || "2023"}
            </div>
          </div>

          {/* After */}
          <div className="relative rounded-lg overflow-hidden border border-tactical-700 bg-tactical-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={afterImg}
              alt="T2 Monitoring"
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold shadow-sm">
              <span>T2 MONITORING:</span> {location.available_dates?.[1] || "2025"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
