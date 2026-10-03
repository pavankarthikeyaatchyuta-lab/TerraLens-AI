"use client";

import React, { useState } from "react";
import { ChangeDetectionResult, Location } from "@/types";
import { Flame, ShieldAlert, Layers, Eye, Sliders, BoxSelect } from "lucide-react";

interface ChangeMaskViewerProps {
  location: Location;
  analysis: ChangeDetectionResult | null;
  isLoading: boolean;
  catalogMode?: "benchmark" | "real-eo";
  afterScene?: any;
}

type LayerMode = "overlay" | "heatmap" | "mask" | "raw";

export function ChangeMaskViewer({
  location,
  analysis,
  isLoading,
  catalogMode = "benchmark",
  afterScene,
}: ChangeMaskViewerProps) {
  const [activeLayer, setActiveLayer] = useState<LayerMode>("overlay");
  const [opacity, setOpacity] = useState<number>(0.85);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const isRealEo = catalogMode === "real-eo";

  if (isLoading) {
    return (
      <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-8 flex flex-col items-center justify-center min-h-[360px] text-center">
        <div className="w-10 h-10 border-4 border-sky-500/20 border-t-sky-600 dark:border-sky-400/20 dark:border-t-sky-400 rounded-full animate-spin mb-4" />
        <h4 className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
          EXECUTING MULTI-TEMPORAL CHANGE DETECTION...
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Normalizing illumination, evaluating absolute difference, and suppressing false alarms
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400 font-mono text-xs">
        Select a location and trigger analysis to view raster change artifacts.
      </div>
    );
  }

  const rawAfterImg = isRealEo
    ? (afterScene?.previewUrl ||
       afterScene?.thumbnailUrl ||
       (afterScene?.sceneId
         ? `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item=${encodeURIComponent(afterScene.sceneId)}&assets=visual&asset_bidx=visual%7C1,2,3&nodata=0&format=png`
         : ""))
    : `/samples/${location.location_id}/after_2025.jpg`;

  const maskImg = analysis.mask_path || `/outputs/change_masks/${location.location_id}_2023_2025_change_mask.png`;
  const heatmapImg = analysis.heatmap_path || `/outputs/change_masks/${location.location_id}_2023_2025_diff_heatmap.png`;
  const overlayImg = analysis.overlay_path || `/outputs/change_masks/${location.location_id}_2023_2025_overlay.png`;

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-sm">
      {/* Layer selector bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-tactical-700/60">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100 uppercase">
              {isRealEo ? "Sentinel-2 Multispectral Analysis Layers" : "Change Detection Diagnostics & Raster Layers"}
            </h3>
            {isRealEo ? (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                REAL SENTINEL-2 L2A
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                CONTROLLED SYNTHETIC BENCHMARK SCENE
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {isRealEo
              ? "Analytical change raster visualization generated from authentic Copernicus Sentinel-2 L2A surface reflectance."
              : "Standardized synthetic benchmark evaluation rasters (2023 → 2025)."}
          </p>
        </div>

        {/* Layer Buttons */}
        <div className="flex flex-wrap items-center gap-1 bg-tactical-900 p-1 rounded-lg border border-tactical-700 text-xs font-mono">
          <button
            onClick={() => setActiveLayer("overlay")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              activeLayer === "overlay"
                ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 font-bold border border-sky-500/30"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>OVERLAY</span>
          </button>

          <button
            onClick={() => setActiveLayer("heatmap")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              activeLayer === "heatmap"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>HEATMAP</span>
          </button>

          <button
            onClick={() => setActiveLayer("mask")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              activeLayer === "mask"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>BINARY MASK</span>
          </button>

          <button
            onClick={() => setActiveLayer("raw")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded transition-all ${
              activeLayer === "raw"
                ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold border border-slate-300 dark:border-slate-500"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <span>RAW T2</span>
          </button>
        </div>
      </div>

      {/* Main Raster Display */}
      <div className="relative aspect-square max-h-[460px] w-full rounded-lg overflow-hidden border border-tactical-700 bg-tactical-950 flex items-center justify-center">
        {/* Base raw image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rawAfterImg}
          alt="Satellite Observation"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Selected Layer Overlay */}
        {activeLayer === "overlay" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={overlayImg}
            alt="Change Overlay"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity }}
          />
        )}

        {activeLayer === "heatmap" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heatmapImg}
            alt="Difference Heatmap"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity }}
          />
        )}

        {activeLayer === "mask" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={maskImg}
            alt="Binary Change Mask"
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity }}
          />
        )}

        {/* Bounding box annotations for connected components */}
        {showBoxes && analysis.change_regions && analysis.change_regions.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {analysis.change_regions.map((reg) => (
              <div
                key={reg.region_id}
                className="absolute border border-sky-500/80 bg-sky-500/10 shadow-sm"
                style={{
                  left: `${(reg.x / 512) * 100}%`,
                  top: `${(reg.y / 512) * 100}%`,
                  width: `${(reg.width / 512) * 100}%`,
                  height: `${(reg.height / 512) * 100}%`,
                }}
              >
                <span className="absolute -top-4 left-0 bg-tactical-900/90 text-sky-700 dark:text-sky-300 text-[9px] font-mono px-1 rounded border border-tactical-700">
                  #{reg.region_id} ({reg.area_pixels}px)
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Layer indicator badge */}
        <div className="absolute bottom-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-600 text-xs font-mono flex items-center gap-1.5 z-10">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span className="text-slate-700 dark:text-slate-300 font-bold uppercase">{activeLayer} LAYER</span>
          <span className="text-slate-400 dark:text-slate-500">|</span>
          <span className="text-slate-500 dark:text-slate-400">{analysis.change_regions?.length || 0} CLUSTERS</span>
        </div>
      </div>

      {/* Opacity slider & box toggle controls */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-600 dark:text-slate-300 bg-tactical-900 p-2.5 rounded-lg border border-tactical-700">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>LAYER OPACITY:</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            className="w-28 accent-sky-500 h-1 bg-tactical-700 rounded-lg cursor-pointer"
          />
          <span className="text-sky-600 dark:text-sky-400 font-bold">{Math.round(opacity * 100)}%</span>
        </div>

        <button
          onClick={() => setShowBoxes(!showBoxes)}
          className={`flex items-center gap-1 px-2 py-1 rounded border transition-all ${
            showBoxes
              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30"
              : "bg-tactical-800 text-slate-500 dark:text-slate-400 border-tactical-700"
          }`}
        >
          <BoxSelect className="w-3.5 h-3.5" />
          <span>{showBoxes ? "HIDE CLUSTER BOXES" : "SHOW CLUSTER BOXES"}</span>
        </button>
      </div>
    </div>
  );
}
