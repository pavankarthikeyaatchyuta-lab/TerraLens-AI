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
  ShieldAlert,
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
  onDiscoverHistory?: (cloudThreshold?: number, startDate?: string, endDate?: string) => void;
  isDiscoveringHistory?: boolean;
  historyResult?: TemporalHistoryResult | null;
  onSwitchToRealEo?: () => void;
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
  onSwitchToRealEo,
}: TemporalComparisonProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [beforeLoadError, setBeforeLoadError] = useState<boolean>(false);
  const [afterLoadError, setAfterLoadError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  // Real EO Observation Timeline & Custom Date Selector State
  const [selectedT1SceneId, setSelectedT1SceneId] = useState<string>("");
  const [selectedT2SceneId, setSelectedT2SceneId] = useState<string>("");
  const [filterCloud, setFilterCloud] = useState<number>(25);
  const [filterStartDate, setFilterStartDate] = useState<string>("");
  const [filterEndDate, setFilterEndDate] = useState<string>("");

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

  // Synchronize initial T1 & T2 selections from historyResult or selectedPair
  React.useEffect(() => {
    if (!historyResult || !historyResult.usableObservations?.length) return;
    const obs = historyResult.usableObservations;

    if (!selectedT1SceneId || !obs.some((o) => o.sceneId === selectedT1SceneId)) {
      const initialT1 = selectedPair?.beforeScene?.sceneId || historyResult.earliestUsable?.sceneId || obs[0]?.sceneId;
      if (initialT1) setSelectedT1SceneId(initialT1);
    }

    if (!selectedT2SceneId || !obs.some((o) => o.sceneId === selectedT2SceneId)) {
      const initialT2 = selectedPair?.afterScene?.sceneId || historyResult.latestUsable?.sceneId || obs[obs.length - 1]?.sceneId;
      if (initialT2) setSelectedT2SceneId(initialT2);
    }
  }, [historyResult, selectedPair]);

  const handleCompareSelectedDates = () => {
    if (!historyResult || !historyResult.usableObservations?.length) return;
    const obs = historyResult.usableObservations;
    const t1 = obs.find((o) => o.sceneId === selectedT1SceneId) || historyResult.earliestUsable || obs[0];
    const t2 = obs.find((o) => o.sceneId === selectedT2SceneId) || historyResult.latestUsable || obs[obs.length - 1];
    if (!t1 || !t2) return;

    const daysDifference = Math.abs(
      Math.round(
        (new Date(t2.acquisitionDate).getTime() - new Date(t1.acquisitionDate).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    );

    onSelectPair?.({
      beforeScene: t1,
      afterScene: t2,
      daysDifference,
      recommended: true,
    });
  };

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
            <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono font-semibold shadow-sm">
              <span className={isRealEo ? "text-indigo-600 dark:text-indigo-300" : "text-amber-600 dark:text-amber-300"}>
                {isRealEo ? "REAL S2 L2A • T1 (BASELINE):" : "CONTROLLED BENCHMARK • T1:"}
              </span>{" "}
              <span className="text-slate-900 dark:text-slate-100">{beforeScene?.acquisition_date || location.available_dates?.[0] || "2023-03"}</span>
            </div>
          </div>

          {/* Badge T2 */}
          <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono font-semibold shadow-sm">
            <span className={isRealEo ? "text-indigo-600 dark:text-indigo-300" : "text-amber-600 dark:text-amber-300"}>
              {isRealEo ? "REAL S2 L2A • T2 (MONITORING):" : "CONTROLLED BENCHMARK • T2:"}
            </span>{" "}
            <span className="text-slate-900 dark:text-slate-100">{afterScene?.acquisition_date || location.available_dates?.[1] || "2025-02"}</span>
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
            <div className="absolute top-3 left-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono font-semibold shadow-sm">
              <span className={isRealEo ? "text-indigo-600 dark:text-indigo-300" : "text-amber-600 dark:text-amber-300"}>
                {isRealEo ? "REAL S2 L2A • T1:" : "BENCHMARK T1:"}
              </span>{" "}
              <span className="text-slate-900 dark:text-slate-100">{beforeScene?.acquisition_date || location.available_dates?.[0] || "2023"}</span>
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
            <div className="absolute top-3 right-3 bg-tactical-900/90 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-xs font-mono font-semibold shadow-sm">
              <span className={isRealEo ? "text-indigo-600 dark:text-indigo-300" : "text-amber-600 dark:text-amber-300"}>
                {isRealEo ? "REAL S2 L2A • T2:" : "BENCHMARK T2:"}
              </span>{" "}
              <span className="text-slate-900 dark:text-slate-100">{afterScene?.acquisition_date || location.available_dates?.[1] || "2025"}</span>
            </div>
          </div>
        </div>
      )}

      {/* BENCHMARK MODE: Fixed Evaluation Notice Card */}
      {!isRealEo && (
        <div className="mt-3 p-3.5 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-2.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>CONTROLLED BENCHMARK — SYNTHETIC DATA BASELINE</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
              STANDARDIZED EVALUATION
            </span>
          </div>

          <p className="text-slate-300 text-[11px] leading-relaxed">
            This mode evaluates calibrated synthetic benchmark scene dates (<span className="text-amber-300 font-semibold">{beforeScene?.acquisition_date || "2023-04-05"}</span> &rarr; <span className="text-amber-300 font-semibold">{afterScene?.acquisition_date || "2025-03-12"}</span>) against standardized algorithmic ground truth. These dates are invariant benchmark scene dates, not an interactive general timeline.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-amber-500/20 text-[11px]">
            <div className="flex items-center gap-2 text-slate-400">
              <span className="font-semibold text-amber-300">Standardized Pair:</span>
              <span>{beforeScene?.acquisition_date || "2023"} &rarr; {afterScene?.acquisition_date || "2025"}</span>
              <span className="text-slate-500">• Invariant Evaluation Baseline</span>
            </div>

            {onSwitchToRealEo && (
              <button
                type="button"
                onClick={onSwitchToRealEo}
                className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] flex items-center gap-1 transition-all shadow-sm"
              >
                <span>OPEN REAL SENTINEL-2 TIMELINE (REAL EO)</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* REAL EO MODE: Real Sentinel-2 Observation Timeline & Custom Date Pairing */}
      {isRealEo && (
        <div className="mt-3 p-3.5 bg-indigo-950/20 border border-indigo-500/30 rounded-xl space-y-3 font-mono text-xs">
          {/* Panel Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-indigo-500/25">
            <div className="flex items-center gap-2 text-indigo-300 font-bold">
              <History className="w-4 h-4 text-indigo-400" />
              <span>REAL SENTINEL-2 OBSERVATION TIMELINE & ARCHIVE</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                COPERNICUS STAC ARCHIVE
              </span>
              {historyResult && (
                <span className={`px-2 py-0.5 rounded font-bold border ${
                  historyResult.isExhaustive
                    ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40"
                    : "bg-amber-950/60 text-amber-300 border-amber-500/40"
                }`}>
                  {historyResult.isExhaustive ? "EXHAUSTIVE TIMELINE" : "NON-EXHAUSTIVE"}
                </span>
              )}
            </div>
          </div>

          {/* Discovery / Trigger Bar if history not yet loaded */}
          {!historyResult && (
            <div className="p-3 bg-tactical-900 border border-tactical-700 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-200">Query Sentinel-2 Observation History</div>
                <div className="text-[11px] text-slate-400">
                  Search Copernicus archives for all usable multi-temporal observations across {location.name}.
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDiscoverHistory?.(filterCloud, filterStartDate || undefined, filterEndDate || undefined)}
                disabled={isDiscoveringHistory}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold flex items-center gap-1.5 transition-all text-xs whitespace-nowrap shadow-sm"
              >
                {isDiscoveringHistory ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>QUERYING STAC ARCHIVE...</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>LOAD SENTINEL-2 TIMELINE</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Observation History Results */}
          {historyResult && (
            <div className="space-y-3">
              {/* Telemetry & Search Scope Summary */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-tactical-900 p-2.5 rounded-lg border border-tactical-700">
                <div className="flex items-center gap-3">
                  <span className="text-emerald-400 font-bold">
                    {historyResult.usableCount} USABLE SCENES
                  </span>
                  <span className="text-slate-400">
                    ({historyResult.recordsExamined || historyResult.totalFound} STAC records examined)
                  </span>
                  <span className="text-slate-400">
                    Span: <strong className="text-slate-200">{historyResult.summary.temporalSpanDays} days</strong>
                  </span>
                </div>
                {historyResult.pagesFollowed && (
                  <span className="text-[10px] text-slate-400">
                    {historyResult.pagesFollowed} STAC page(s) parsed
                  </span>
                )}
              </div>

              {/* Archive Filters: Date Range and Cloud Threshold */}
              <div className="p-2.5 rounded-lg bg-tactical-900 border border-tactical-700 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Start Date</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    className="w-full bg-tactical-950 border border-tactical-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">End Date</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    className="w-full bg-tactical-950 border border-tactical-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Max Cloud Cover</label>
                  <select
                    value={filterCloud}
                    onChange={(e) => setFilterCloud(Number(e.target.value))}
                    className="w-full bg-tactical-950 border border-tactical-700 rounded px-2 py-1 text-slate-200 font-mono text-[11px]"
                  >
                    <option value={10}>Max 10% Cloud</option>
                    <option value={20}>Max 20% Cloud</option>
                    <option value={25}>Max 25% Cloud (Default)</option>
                    <option value={40}>Max 40% Cloud</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => onDiscoverHistory?.(filterCloud, filterStartDate || undefined, filterEndDate || undefined)}
                    disabled={isDiscoveringHistory}
                    className="w-full py-1.5 px-2.5 rounded bg-sky-700 hover:bg-sky-600 disabled:opacity-50 text-white font-bold text-[11px] transition-all flex items-center justify-center gap-1 shadow-sm"
                  >
                    {isDiscoveringHistory ? <RotateCcw className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                    <span>FILTER ARCHIVE</span>
                  </button>
                </div>
              </div>

              {/* Phase 12C: Multi-Temporal Verification Chain (Earliest -> First Supported Change -> Subsequent Confirmation -> Latest) */}
              {historyResult.usableObservations.length >= 2 && (() => {
                const obsList = historyResult.usableObservations;
                const earliestUsableObs = historyResult.earliestUsable || obsList[0];
                const latestUsableObs = historyResult.latestUsable || obsList[obsList.length - 1];
                const activeT1 = obsList.find((o) => o.sceneId === selectedT1SceneId) || earliestUsableObs;
                const activeT2 = obsList.find((o) => o.sceneId === selectedT2SceneId) || (obsList.length > 1 ? obsList[obsList.length - 1] : earliestUsableObs);
                const firstSupportedChangeObs = activeT2;
                const subsequentConfirmationObs = obsList.find(
                  (o) => new Date(o.acquisitionDate).getTime() > new Date(firstSupportedChangeObs.acquisitionDate).getTime()
                );

                return (
                  <div className="p-3 bg-tactical-900 border border-tactical-700 rounded-lg space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="font-bold text-slate-200 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-sky-400" />
                        <span>MULTI-TEMPORAL PROVENANCE SEQUENCE</span>
                      </span>
                      <span className="text-[10px] text-slate-400 bg-tactical-800 px-2 py-0.5 rounded border border-tactical-700">
                        AUTHENTIC SENTINEL-2 METADATA
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
                      {/* Node 1: Earliest Usable */}
                      <div className="bg-tactical-950 p-2.5 rounded border border-tactical-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">EARLIEST USABLE</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                            BASELINE
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-100">{earliestUsableObs?.acquisitionDate.slice(0, 10)}</div>
                        <div className="text-[10px] text-slate-500">{earliestUsableObs?.cloudCoverPercentage.toFixed(1)}% cloud • {earliestUsableObs?.platform}</div>
                      </div>

                      {/* Node 2: First Supported Change */}
                      <div className="bg-tactical-950 p-2.5 rounded border border-amber-500/40 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-amber-400 uppercase">FIRST SUPPORTED CHANGE</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            CHANGE
                          </span>
                        </div>
                        <div className="text-xs font-bold text-amber-300">{firstSupportedChangeObs?.acquisitionDate.slice(0, 10)}</div>
                        <div className="text-[10px] text-slate-500">{firstSupportedChangeObs?.cloudCoverPercentage.toFixed(1)}% cloud • {firstSupportedChangeObs?.platform}</div>
                      </div>

                      {/* Node 3: Subsequent Confirmation */}
                      <div className="bg-tactical-950 p-2.5 rounded border border-tactical-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">CONFIRMED BY</span>
                          <span className={`text-[8px] px-1 py-0.2 rounded font-bold border ${
                            subsequentConfirmationObs
                              ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                            {subsequentConfirmationObs ? "CONFIRMED" : "AWAITING"}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-100">
                          {subsequentConfirmationObs ? subsequentConfirmationObs.acquisitionDate.slice(0, 10) : "Next Acquisition"}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {subsequentConfirmationObs
                            ? `${subsequentConfirmationObs.cloudCoverPercentage.toFixed(1)}% cloud • ${subsequentConfirmationObs.platform}`
                            : "T2 is current frontier scene"}
                        </div>
                      </div>

                      {/* Node 4: Latest Observation */}
                      <div className="bg-tactical-950 p-2.5 rounded border border-tactical-800 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold text-slate-400 uppercase">LATEST OBSERVATION</span>
                          <span className="text-[8px] px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                            FRONTIER
                          </span>
                        </div>
                        <div className="text-xs font-bold text-sky-300">{latestUsableObs?.acquisitionDate.slice(0, 10)}</div>
                        <div className="text-[10px] text-slate-500">{latestUsableObs?.cloudCoverPercentage.toFixed(1)}% cloud • {latestUsableObs?.platform}</div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Chronological Visual Timeline Track */}
              {historyResult.usableObservations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                    <span>Chronological Observation Timeline (Earliest &rarr; Latest):</span>
                    <span>Click any observation to assign as T1 or T2</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                    {historyResult.usableObservations.map((obs, idx) => {
                      const isT1 = selectedT1SceneId === obs.sceneId;
                      const isT2 = selectedT2SceneId === obs.sceneId;
                      const isEarliest = idx === 0;
                      const isLatest = idx === historyResult.usableObservations.length - 1;
                      const dateStr = obs.acquisitionDate.slice(0, 10);

                      return (
                        <div
                          key={obs.sceneId}
                          className={`flex-shrink-0 p-2 rounded-lg border text-[11px] font-mono transition-all min-w-[140px] space-y-1 ${
                            isT1
                              ? "bg-sky-950/60 border-sky-400 shadow-md text-white"
                              : isT2
                              ? "bg-amber-950/60 border-amber-400 shadow-md text-white"
                              : "bg-tactical-900 border-tactical-700 text-slate-300 hover:border-slate-500"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400">#{idx + 1}</span>
                            {isEarliest && (
                              <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                EARLIEST
                              </span>
                            )}
                            {isLatest && (
                              <span className="text-[9px] px-1 rounded bg-sky-500/20 text-sky-300 font-bold border border-sky-500/30">
                                LATEST
                              </span>
                            )}
                          </div>

                          <div className="font-bold text-slate-100">{dateStr}</div>
                          <div className="text-[10px] text-slate-400">
                            {obs.cloudCoverPercentage.toFixed(1)}% cloud • {obs.platform}
                          </div>

                          <div className="pt-1 flex items-center gap-1 border-t border-tactical-700/60">
                            <button
                              type="button"
                              onClick={() => setSelectedT1SceneId(obs.sceneId)}
                              className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-all ${
                                isT1
                                  ? "bg-sky-600 text-white"
                                  : "bg-tactical-800 text-slate-400 hover:text-sky-300"
                              }`}
                            >
                              {isT1 ? "T1 ACTIVE" : "SET T1"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedT2SceneId(obs.sceneId)}
                              className={`flex-1 py-0.5 rounded text-[9px] font-bold transition-all ${
                                isT2
                                  ? "bg-amber-600 text-white"
                                  : "bg-tactical-800 text-slate-400 hover:text-amber-300"
                              }`}
                            >
                              {isT2 ? "T2 ACTIVE" : "SET T2"}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dual T1 & T2 Selectors & Action Bar */}
              <div className="p-3 rounded-lg bg-indigo-950/30 border border-indigo-500/40 space-y-2.5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* T1 Baseline Selector Box */}
                  <div className="p-2.5 rounded bg-tactical-900 border border-tactical-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-400 uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                        T1 Baseline Observation:
                      </span>
                      {selectedT1SceneId === historyResult.earliestUsable?.sceneId && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                          EARLIEST USABLE
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedT1SceneId}
                      onChange={(e) => setSelectedT1SceneId(e.target.value)}
                      className="w-full bg-tactical-950 border border-tactical-700 rounded p-1.5 text-slate-200 font-mono text-[11px]"
                    >
                      {historyResult.usableObservations.map((o) => (
                        <option key={o.sceneId} value={o.sceneId}>
                          {o.acquisitionDate.slice(0, 10)} • {o.cloudCoverPercentage.toFixed(1)}% cloud • {o.platform}
                        </option>
                      ))}
                    </select>
                    {selectedT1SceneId && (
                      <div className="text-[10px] text-slate-400 truncate">
                        ID: {selectedT1SceneId}
                      </div>
                    )}
                  </div>

                  {/* T2 Monitoring Selector Box */}
                  <div className="p-2.5 rounded bg-tactical-900 border border-tactical-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-400 uppercase tracking-wide flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                        T2 Monitoring Observation:
                      </span>
                      {selectedT2SceneId === historyResult.latestUsable?.sceneId && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 font-bold">
                          LATEST USABLE
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedT2SceneId}
                      onChange={(e) => setSelectedT2SceneId(e.target.value)}
                      className="w-full bg-tactical-950 border border-tactical-700 rounded p-1.5 text-slate-200 font-mono text-[11px]"
                    >
                      {historyResult.usableObservations.map((o) => (
                        <option key={o.sceneId} value={o.sceneId}>
                          {o.acquisitionDate.slice(0, 10)} • {o.cloudCoverPercentage.toFixed(1)}% cloud • {o.platform}
                        </option>
                      ))}
                    </select>
                    {selectedT2SceneId && (
                      <div className="text-[10px] text-slate-400 truncate">
                        ID: {selectedT2SceneId}
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary Comparison Action */}
                {(() => {
                  const t1Obs = historyResult.usableObservations.find((o) => o.sceneId === selectedT1SceneId);
                  const t2Obs = historyResult.usableObservations.find((o) => o.sceneId === selectedT2SceneId);
                  const t1Time = t1Obs ? new Date(t1Obs.acquisitionDate).getTime() : 0;
                  const t2Time = t2Obs ? new Date(t2Obs.acquisitionDate).getTime() : 0;
                  const daysDiff = t1Time && t2Time ? Math.abs(Math.round((t2Time - t1Time) / (1000 * 60 * 60 * 24))) : 0;
                  const isChronological = t1Time <= t2Time;

                  return (
                    <div className="pt-1 space-y-2">
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                        <div>
                          Selected Pair: <strong className="text-sky-300">{t1Obs?.acquisitionDate.slice(0, 10) || "T1"}</strong> &rarr; <strong className="text-amber-300">{t2Obs?.acquisitionDate.slice(0, 10) || "T2"}</strong> (Δ {daysDiff} days)
                        </div>
                        {!isChronological && (
                          <span className="text-amber-400 font-semibold">
                            Note: T1 is later than T2; chronological ordering recommended for forward change detection.
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleCompareSelectedDates}
                          className="py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm text-xs border border-indigo-400/40"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          <span>COMPARE SELECTED DATES ({daysDiff}d DELTA)</span>
                        </button>

                        {onExecuteAnalysis && (
                          <button
                            type="button"
                            onClick={onExecuteAnalysis}
                            disabled={isAnalyzing}
                            className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm text-xs border border-emerald-400/40"
                          >
                            {isAnalyzing ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                                <span>ANALYZING B04/B08/SCL...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>RUN QUANTITATIVE SENTINEL-2 CHANGE DETECTION</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Transparency: Excluded Records Breakdown */}
              {historyResult.rejectedCount > 0 && (
                <div className="p-2.5 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{historyResult.rejectedCount} STAC record(s) excluded by quality/cloud filters:</span>
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
            </div>
          )}

          {/* Fallback Discovered Pair Candidates List if present */}
          {pairCandidates.length > 0 && (
            <div className="pt-2 border-t border-indigo-500/20 space-y-2">
              <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-bold uppercase tracking-wider block">
                Discovered STAC Temporal Candidates ({pairCandidates.length}):
              </span>
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                {pairCandidates.map((pair, idx) => {
                  const isSelected = selectedPair?.beforeScene.sceneId === pair.beforeScene.sceneId && selectedPair?.afterScene.sceneId === pair.afterScene.sceneId;
                  return (
                    <div
                      key={pair.beforeScene.sceneId + pair.afterScene.sceneId}
                      onClick={() => onSelectPair?.(pair)}
                      className={`p-2 rounded-lg border cursor-pointer transition-all flex items-center justify-between text-[11px] ${
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
