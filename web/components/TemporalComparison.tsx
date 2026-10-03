"use client";

import React, { useState, useRef, useCallback } from "react";
import { Scene, Location } from "@/types";
import {
  TemporalPairCandidate,
  TemporalHistoryResult,
  SatelliteScene,
} from "@/lib/providers/satelliteProvider";
import {
  SplitSquareVertical,
  Columns2,
  Calendar,
  Satellite,
  Database,
  Sparkles,
  Crosshair,
  RotateCcw,
  CheckCircle2,
  Play,
  Layers,
  AlertTriangle,
  Clock,
  History,
  ArrowRight,
} from "lucide-react";

interface TemporalComparisonProps {
  location: Location;
  beforeScene?: Scene | null;
  afterScene?: Scene | null;
  catalogMode?: "benchmark" | "real-eo";
  selectedScene?: Scene | null;
  onDiscoverPairs?: () => void;
  isDiscovering?: boolean;
  pairCandidates?: TemporalPairCandidate[];
  selectedPair?: TemporalPairCandidate | null;
  onSelectPair?: (pair: TemporalPairCandidate | null) => void;
  onExecuteAnalysis?: () => void;
  isAnalyzing?: boolean;
  onDiscoverHistory?: () => void;
  isDiscoveringHistory?: boolean;
  historyResult?: TemporalHistoryResult | null;
}

export function TemporalComparison({
  location,
  beforeScene,
  afterScene,
  catalogMode = "benchmark",
  selectedScene,
  onDiscoverPairs,
  isDiscovering = false,
  pairCandidates = [],
  selectedPair,
  onSelectPair,
  onExecuteAnalysis,
  isAnalyzing = false,
  onDiscoverHistory,
  isDiscoveringHistory = false,
  historyResult,
}: TemporalComparisonProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [beforeLoadError, setBeforeLoadError] = useState<boolean>(false);
  const [afterLoadError, setAfterLoadError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  const isRealEo = catalogMode === "real-eo";
  const hasValidPair = Boolean(
    beforeScene &&
    afterScene &&
    beforeScene.scene_id &&
    afterScene.scene_id &&
    beforeScene.scene_id !== afterScene.scene_id
  );

  const resolveImageryUrl = (scene?: Scene | null, stacScene?: any, isBefore: boolean = true) => {
    // 1. Direct previewUrl or thumbnailUrl on STAC candidate scene
    if (stacScene?.previewUrl) return stacScene.previewUrl;
    if (stacScene?.thumbnailUrl) return stacScene.thumbnailUrl;
    // 2. Absolute HTTP/HTTPS URL
    if (scene?.image_path && (scene.image_path.startsWith("http://") || scene.image_path.startsWith("https://"))) {
      return scene.image_path;
    }
    // 3. Benchmark mode deterministic sample images
    if (!isRealEo) {
      return scene?.image_path || (isBefore ? `/samples/${location.location_id}/before_2023.jpg` : `/samples/${location.location_id}/after_2025.jpg`);
    }
    // 4. Pre-downloaded 70-scene catalog path
    if (scene?.image_path && scene.image_path.startsWith("/eo_catalog/thumbnails/")) {
      return scene.image_path;
    }
    // 5. Construct authentic Planetary Computer Sentinel-2 visual preview from scene ID
    const sid = stacScene?.sceneId || scene?.scene_id;
    if (sid && (sid.startsWith("S2A_") || sid.startsWith("S2B_") || sid.startsWith("S2C_"))) {
      return `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?collection=sentinel-2-l2a&item=${encodeURIComponent(
        sid
      )}&assets=visual&asset_bidx=visual%7C1,2,3&nodata=0&format=png`;
    }
    return scene?.image_path || "";
  };

  const beforeImg = resolveImageryUrl(beforeScene, selectedPair?.beforeScene, true);
  const afterImg = resolveImageryUrl(afterScene, selectedPair?.afterScene, false);
  const singlePreviewImg = selectedScene?.image_path || beforeScene?.image_path || "";

  React.useEffect(() => {
    setBeforeLoadError(false);
  }, [beforeImg]);

  React.useEffect(() => {
    setAfterLoadError(false);
  }, [afterImg]);

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
            {isRealEo ? (
              <Database className="w-4 h-4 text-indigo-500" />
            ) : (
              <Satellite className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            )}
            <h3 className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 uppercase">
              {isRealEo
                ? hasValidPair
                  ? `Temporal Observation Pair: ${location.name}`
                  : `REAL EO Sentinel-2 Scene: ${location.name}`
                : `Temporal Imagery Pair: ${location.name}`}
            </h3>
            {isRealEo ? (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-600/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                REAL EO • SENTINEL-2 L2A
              </span>
            ) : (
              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-600/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                SYNTHETIC BENCHMARK • {location.primary_sensor} PROFILE
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {isRealEo
              ? `Sensor: ${selectedScene?.sensor || location.primary_sensor} | Platform: ${selectedScene?.platform || "Sentinel-2"} | Authentic Copernicus Sentinel-2 L2A Archive`
              : `Sensor Profile: ${location.primary_sensor} | Data: Controlled Synthetic Benchmark Scene (Analysis Imagery)`}
          </p>
        </div>

        {/* View Mode Toggle (Only when a pair is available) */}
        {hasValidPair && (
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
        )}
      </div>

      {/* Main Imagery Area */}
      {!hasValidPair ? (
        /* Real EO Single Scene Preview */
        <div className="relative w-full aspect-video max-h-[380px] rounded-lg overflow-hidden border border-tactical-700 bg-tactical-900 flex items-center justify-center">
          {singlePreviewImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={singlePreviewImg}
              alt={selectedScene?.scene_id || "Sentinel-2 visual preview"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-slate-500 font-mono text-xs flex flex-col items-center gap-2">
              <Database className="w-8 h-8 text-indigo-500/50" />
              <span>Real Sentinel-2 preview loading...</span>
            </div>
          )}

          {/* Badges on preview */}
          <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-indigo-600 dark:text-indigo-300 font-semibold shadow-sm">
            <span>DISCOVERY SCENE:</span> {selectedScene?.acquisition_date || beforeScene?.acquisition_date || location.available_dates?.[0] || "2026"}
          </div>

          <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-slate-700 dark:text-slate-300 font-semibold shadow-sm">
            <span>CLOUD:</span> {selectedScene?.cloud_percentage?.toFixed(2) ?? beforeScene?.cloud_percentage?.toFixed(2) ?? "0.00"}% • {selectedScene?.platform || "Sentinel-2"}
          </div>

          {selectedScene?.scene_id && (
            <div className="absolute bottom-3 left-3 right-3 bg-tactical-900/95 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-[10px] font-mono text-slate-600 dark:text-slate-300 truncate shadow-sm">
              <span className="text-indigo-600 dark:text-indigo-400 font-semibold">STAC ID:</span> {selectedScene.scene_id}
            </div>
          )}
        </div>
      ) : viewMode === "slider" ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          className="relative w-full aspect-square max-h-[460px] rounded-lg overflow-hidden border border-tactical-700 select-none cursor-ew-resize bg-tactical-900"
        >
          {/* After image (background) */}
          {afterLoadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-tactical-900 border border-tactical-700 text-center font-mono text-xs">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <span className="font-bold text-slate-200">T2 MONITORING OBSERVATION UNAVAILABLE</span>
              <span className="text-[11px] text-slate-400 mt-1 max-w-sm">
                Authentic Sentinel-2 L2A observation for {afterScene?.acquisition_date || "T2"} ({afterScene?.scene_id || "selected scene"}) could not be retrieved from Earth Observation archives.
              </span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={afterImg}
              alt="After observation"
              onError={() => setAfterLoadError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* Before image (clipped foreground) */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            {beforeLoadError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-tactical-900 border border-tactical-700 text-center font-mono text-xs">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                <span className="font-bold text-slate-200">T1 BASELINE OBSERVATION UNAVAILABLE</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Authentic Sentinel-2 L2A observation for {beforeScene?.acquisition_date || "T1"} ({beforeScene?.scene_id || "selected scene"}) could not be retrieved from Earth Observation archives.
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={beforeImg}
                alt="Before observation"
                onError={() => setBeforeLoadError(true)}
                className="absolute inset-0 w-full h-full object-cover max-w-none"
                style={{
                  width: containerRef.current ? `${containerRef.current.clientWidth}px` : "100%",
                  height: "100%",
                }}
              />
            )}
            {/* Badge T1 */}
            <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-sky-700 dark:text-sky-300 font-semibold shadow-sm">
              <span>T1 (BASELINE):</span> {beforeScene?.acquisition_date || location.available_dates?.[0] || "2023-03"}
            </div>
          </div>

          {/* Badge T2 */}
          <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold shadow-sm">
            <span>T2 (MONITORING):</span> {afterScene?.acquisition_date || location.available_dates?.[1] || "2025-02"}
          </div>

          {/* Slider divider bar */}
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
            {beforeLoadError ? (
              <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center p-6 bg-tactical-900 border border-tactical-700 text-center font-mono text-xs">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                <span className="font-bold text-slate-200">T1 BASELINE OBSERVATION UNAVAILABLE</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Authentic Sentinel-2 L2A observation for {beforeScene?.acquisition_date || "T1"} ({beforeScene?.scene_id || "selected scene"}) could not be retrieved from Earth Observation archives.
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={beforeImg}
                alt="T1 Baseline"
                onError={() => setBeforeLoadError(true)}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-sky-700 dark:text-sky-300 font-semibold shadow-sm">
              <span>T1 BASELINE:</span> {beforeScene?.acquisition_date || location.available_dates?.[0] || "2023"}
            </div>
          </div>

          {/* After */}
          <div className="relative rounded-lg overflow-hidden border border-tactical-700 bg-tactical-900">
            {afterLoadError ? (
              <div className="w-full h-full min-h-[220px] flex flex-col items-center justify-center p-6 bg-tactical-900 border border-tactical-700 text-center font-mono text-xs">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                <span className="font-bold text-slate-200">T2 MONITORING OBSERVATION UNAVAILABLE</span>
                <span className="text-[11px] text-slate-400 mt-1 max-w-sm">
                  Authentic Sentinel-2 L2A observation for {afterScene?.acquisition_date || "T2"} ({afterScene?.scene_id || "selected scene"}) could not be retrieved from Earth Observation archives.
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={afterImg}
                alt="T2 Monitoring"
                onError={() => setAfterLoadError(true)}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold shadow-sm">
              <span>T2 MONITORING:</span> {afterScene?.acquisition_date || location.available_dates?.[1] || "2025"}
            </div>
          </div>
        </div>
      )}

      {/* Real EO Controls, Pair Discovery & Temporal History Panel */}
      {isRealEo && (
        <div className="mt-3 p-3.5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span>{hasValidPair ? "REAL EO SENTINEL-2 TEMPORAL PAIR LOADED" : "REAL EO SEMANTIC MATCH FOUND"}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-semibold">
              {hasValidPair ? "TEMPORAL PAIR READY" : "70-SCENE CATALOG"}
            </span>
          </div>

          <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
            {hasValidPair
              ? "Active Sentinel-2 temporal baseline (T1) and monitoring (T2) pair. You can run change detection, discover earliest observations, or select another candidate pair."
              : "Real EO semantic match found. Select or discover a Sentinel-2 temporal pair for change analysis."}
          </p>

          <div className="pt-1 flex flex-wrap items-center gap-2">
            {onDiscoverPairs && (
              <button
                type="button"
                onClick={onDiscoverPairs}
                disabled={isDiscovering}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm border border-indigo-400/40 text-xs"
              >
                {isDiscovering ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>QUERYING SENTINEL-2 STAC ARCHIVE...</span>
                  </>
                ) : (
                  <>
                    <Crosshair className="w-3.5 h-3.5" />
                    <span>DISCOVER SENTINEL-2 TEMPORAL PAIRS</span>
                  </>
                )}
              </button>
            )}

            {onDiscoverHistory && (
              <button
                type="button"
                onClick={onDiscoverHistory}
                disabled={isDiscoveringHistory}
                className="px-3 py-1.5 rounded-lg bg-sky-700/80 hover:bg-sky-600 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition-all shadow-sm border border-sky-400/40 text-xs"
              >
                {isDiscoveringHistory ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>DISCOVERING EARLIEST OBSERVATION...</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>DISCOVER EARLIEST USABLE & HISTORY</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Phase 8: Temporal History & Earliest Usable Discovery Panel */}
          {historyResult && (
            <div className="pt-3 border-t border-indigo-500/20 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-[11px] text-sky-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sky-400" />
                  TEMPORAL HISTORY • {historyResult.usableCount} USABLE ({historyResult.recordsExamined || historyResult.totalFound} RECORDS EXAMINED)
                </span>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                  {historyResult.pagesFollowed && (
                    <span className="px-1.5 py-0.5 rounded bg-tactical-800 text-slate-300 border border-tactical-700">
                      {historyResult.pagesFollowed} STAC PAGES
                    </span>
                  )}
                  {historyResult.isExhaustive ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-semibold">
                      EXHAUSTIVE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/40 font-semibold">
                      NON-EXHAUSTIVE (MORE RECORDS REMAIN)
                    </span>
                  )}
                  <span>Time Span: {historyResult.summary.temporalSpanDays} days</span>
                </div>
              </div>
              {historyResult.searchScope?.scopeDescription && (
                <div className="text-[10px] font-mono flex items-center justify-between">
                  <span className={historyResult.isExhaustive ? "text-emerald-400/90 font-semibold" : "text-amber-400/90 font-semibold"}>
                    {historyResult.searchScope.scopeDescription}
                  </span>
                  <span className="text-slate-400">Scope: {historyResult.searchScope.startDate} &rarr; {historyResult.searchScope.endDate}</span>
                </div>
              )}

              {/* Earliest Usable Highlight Card */}
              {historyResult.earliestUsable && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-lg space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
                    <span className={`font-bold flex items-center gap-1.5 ${historyResult.isExhaustive ? "text-emerald-400" : "text-amber-400"}`}>
                      <CheckCircle2 className={`w-3.5 h-3.5 ${historyResult.isExhaustive ? "text-emerald-400" : "text-amber-400"}`} />
                      {historyResult.isExhaustive
                        ? "EARLIEST USABLE OBSERVATION"
                        : "EARLIEST USABLE OBSERVATION FOUND IN SEARCHED SCOPE"}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                      CLOUD: {historyResult.earliestUsable.cloudCoverPercentage.toFixed(2)}% • {historyResult.earliestUsable.platform}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
                    <div>
                      <div className="text-sm font-bold text-white tracking-wide">
                        {new Date(historyResult.earliestUsable.acquisitionDate).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate max-w-sm">
                        STAC ID: {historyResult.earliestUsable.sceneId}
                      </div>
                    </div>

                    {historyResult.latestUsable && onSelectPair && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPair({
                            beforeScene: historyResult.earliestUsable!,
                            afterScene: historyResult.latestUsable!,
                            daysDifference: historyResult.summary.temporalSpanDays,
                            recommended: true,
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                      >
                        <span>PAIR WITH LATEST ({historyResult.summary.temporalSpanDays}d DELTA)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Transparency: Excluded Records Breakdown */}
              {historyResult.rejectedCount > 0 && (
                <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{historyResult.rejectedCount} earlier STAC record(s) excluded from usable baseline:</span>
                  </div>
                  <ul className="text-[10px] text-slate-400 list-disc list-inside space-y-0.5 pl-1">
                    {Object.entries(historyResult.summary.rejectionBreakdown).map(([reason, count]) =>
                      count > 0 ? (
                        <li key={reason}>
                          <span className="font-semibold text-slate-300">{reason}</span>: {count} observation(s)
                        </li>
                      ) : null
                    )}
                  </ul>
                </div>
              )}

              {/* Chronological Available Observations List */}
              {historyResult.usableObservations.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Chronological Observations (Earliest &rarr; Latest):
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                    {historyResult.usableObservations.map((obs, idx) => {
                      const isEarliest = idx === 0;
                      const isLatest = idx === historyResult.usableObservations.length - 1;
                      const dateStr = obs.acquisitionDate.slice(0, 10);
                      return (
                        <div
                          key={obs.sceneId}
                          className="p-2 rounded bg-tactical-900 border border-tactical-700 flex items-center justify-between text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 w-5">#{idx + 1}</span>
                            <div>
                              <span className="font-semibold text-slate-200">{dateStr}</span>
                              <span className="text-[10px] text-slate-400 ml-2 font-mono">
                                {obs.cloudCoverPercentage.toFixed(1)}% cloud • {obs.platform}
                              </span>
                            </div>
                            {isEarliest && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                                EARLIEST
                              </span>
                            )}
                            {isLatest && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                                LATEST
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedPair) {
                                  onSelectPair?.({
                                    ...selectedPair,
                                    beforeScene: obs,
                                    daysDifference: Math.abs(Math.round((new Date(selectedPair.afterScene.acquisitionDate).getTime() - new Date(obs.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))),
                                  });
                                } else if (historyResult.latestUsable) {
                                  onSelectPair?.({
                                    beforeScene: obs,
                                    afterScene: historyResult.latestUsable,
                                    daysDifference: Math.abs(Math.round((new Date(historyResult.latestUsable.acquisitionDate).getTime() - new Date(obs.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))),
                                    recommended: false,
                                  });
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 text-[10px] font-semibold"
                            >
                              SET AS T1
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedPair) {
                                  onSelectPair?.({
                                    ...selectedPair,
                                    afterScene: obs,
                                    daysDifference: Math.abs(Math.round((new Date(obs.acquisitionDate).getTime() - new Date(selectedPair.beforeScene.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))),
                                  });
                                } else if (historyResult.earliestUsable) {
                                  onSelectPair?.({
                                    beforeScene: historyResult.earliestUsable,
                                    afterScene: obs,
                                    daysDifference: Math.abs(Math.round((new Date(obs.acquisitionDate).getTime() - new Date(historyResult.earliestUsable.acquisitionDate).getTime()) / (1000 * 60 * 60 * 24))),
                                    recommended: false,
                                  });
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-[10px] font-semibold"
                            >
                              SET AS T2
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Discovered Pair Candidates List */}
          {pairCandidates.length > 0 && (
            <div className="pt-2 border-t border-indigo-500/20 space-y-2">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider block">
                Discovered STAC Temporal Candidates ({pairCandidates.length}):
              </span>
              <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                {pairCandidates.map((pair, idx) => {
                  const isSelected = selectedPair?.beforeScene.sceneId === pair.beforeScene.sceneId && selectedPair?.afterScene.sceneId === pair.afterScene.sceneId;
                  return (
                    <div
                      key={pair.beforeScene.sceneId + pair.afterScene.sceneId}
                      onClick={() => onSelectPair?.(pair)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-[11px] ${
                        isSelected
                          ? "bg-indigo-900/40 border-indigo-400 text-white"
                          : "bg-tactical-900 border-tactical-700 hover:border-indigo-500/50 text-slate-300"
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-slate-200">
                          Pair #{idx + 1}: {pair.beforeScene.acquisitionDate.slice(0, 10)} &rarr; {pair.afterScene.acquisitionDate.slice(0, 10)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          &Delta; {pair.daysDifference} days • Before: {pair.beforeScene.cloudCoverPercentage.toFixed(1)}% cloud • After: {pair.afterScene.cloudCoverPercentage.toFixed(1)}% cloud
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isSelected ? "bg-indigo-600 text-white" : "bg-tactical-800 text-slate-400"
                      }`}>
                        {isSelected ? "SELECTED" : "SELECT"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {selectedPair && onExecuteAnalysis && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onExecuteAnalysis}
                    disabled={isAnalyzing}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm text-xs"
                  >
                    {isAnalyzing ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                        <span>EXECUTING SCIENTIFIC B04/B08/SCL CHANGE ANALYSIS...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>RUN QUANTITATIVE SENTINEL-2 CHANGE DETECTION</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
