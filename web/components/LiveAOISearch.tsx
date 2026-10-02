"use client";

import React, { useState } from "react";
import {
  SatelliteScene,
  TemporalPairCandidate,
  AnalysisPreparationResult,
} from "@/lib/providers/satelliteProvider";
import { BoundingBox } from "@/types";
import { satelliteClient } from "@/lib/api/satelliteClient";
import {
  Search,
  Crosshair,
  Calendar,
  Cloud,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Eye,
  ShieldAlert,
  Cpu,
  FileCheck,
  Binary,
  Flame,
  Droplets,
  Trees,
  Building,
  HelpCircle,
  Activity,
  Sliders,
  Download,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";

interface LiveAOISearchProps {
  aoi: BoundingBox | null;
  onAoiChange: (aoi: BoundingBox | null) => void;
  isDrawingAoi: boolean;
  onToggleDrawingAoi: (drawing: boolean) => void;
  onSelectScene: (scene: SatelliteScene | null, type: "before" | "after") => void;
  selectedBeforeScene: SatelliteScene | null;
  selectedAfterScene: SatelliteScene | null;
  onSelectPair: (pair: TemporalPairCandidate | null) => void;
  selectedPair: TemporalPairCandidate | null;
  onFocusSceneOnMap?: (scene: SatelliteScene) => void;
  analysisResult?: any;
  onAnalysisComplete?: (result: any) => void;
  selectedClusterId?: string | null;
  onSelectCluster?: (clusterId: string | null) => void;
}

const PRESET_AOIS: { name: string; desc: string; bbox: BoundingBox }[] = [
  {
    name: "Hyderabad Urban Hub",
    desc: "Telangana, India (MGRS 44QKE)",
    bbox: { min_lat: 17.36, min_lon: 78.40, max_lat: 17.52, max_lon: 78.56 },
  },
  {
    name: "Thar Desert Solar Park",
    desc: "Bhadla, Rajasthan, India",
    bbox: { min_lat: 27.48, min_lon: 71.85, max_lat: 27.60, max_lon: 72.00 },
  },
  {
    name: "Nagarjuna Sagar Reservoir",
    desc: "Krishna River, Andhra Pradesh",
    bbox: { min_lat: 16.52, min_lon: 79.25, max_lat: 16.65, max_lon: 79.40 },
  },
  {
    name: "Mumbai Port & Coastal",
    desc: "Maharashtra, Western Seaboard",
    bbox: { min_lat: 18.90, min_lon: 72.80, max_lat: 19.05, max_lon: 72.95 },
  },
];

export function LiveAOISearch({
  aoi,
  onAoiChange,
  isDrawingAoi,
  onToggleDrawingAoi,
  onSelectScene,
  selectedBeforeScene,
  selectedAfterScene,
  onSelectPair,
  selectedPair,
  onFocusSceneOnMap,
  analysisResult,
  onAnalysisComplete,
  selectedClusterId,
  onSelectCluster,
}: LiveAOISearchProps) {
  // Search Form State
  const [startDate, setStartDate] = useState<string>("2024-01-01");
  const [endDate, setEndDate] = useState<string>("2024-06-30");
  const [maxCloudCover, setMaxCloudCover] = useState<number>(20);
  const [limit, setLimit] = useState<number>(10);

  // Phase 5A: End-to-End Analyst Workflow & Adjudication State
  const [internalSelectedClusterId, setInternalSelectedClusterId] = useState<string | null>(null);
  const activeClusterId = selectedClusterId !== undefined && selectedClusterId !== null ? selectedClusterId : internalSelectedClusterId;
  const [analystReviews, setAnalystReviews] = useState<Record<string, { decision: "CONFIRMED" | "REJECTED" | "UNREVIEWED"; notes: string; timestamp: string }>>({});
  const [currentAnalystNote, setCurrentAnalystNote] = useState<string>("");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Semantic Query Handoff State
  const [semanticQuery, setSemanticQuery] = useState<string>("");
  const [isSemanticSearching, setIsSemanticSearching] = useState<boolean>(false);
  const [semanticResults, setSemanticResults] = useState<any[]>([]);
  const [semanticSearchError, setSemanticSearchError] = useState<string | null>(null);

  // Manual Coordinates State
  const [aoiMode, setAoiMode] = useState<"draw" | "manual">("draw");
  const [manualMinLat, setManualMinLat] = useState<string>("");
  const [manualMinLon, setManualMinLon] = useState<string>("");
  const [manualMaxLat, setManualMaxLat] = useState<string>("");
  const [manualMaxLon, setManualMaxLon] = useState<string>("");
  const [manualError, setManualError] = useState<string | null>(null);

  // Search Execution State
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [scenes, setScenes] = useState<SatelliteScene[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Temporal Pair Discovery State
  const [isFindingPairs, setIsFindingPairs] = useState<boolean>(false);
  const [temporalPairs, setTemporalPairs] = useState<TemporalPairCandidate[]>([]);
  const [pairError, setPairError] = useState<string | null>(null);
  const [hasSearchedPairs, setHasSearchedPairs] = useState<boolean>(false);

  // Phase 4A: Real Analysis Asset Preparation State
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [prepareResult, setPrepareResult] = useState<AnalysisPreparationResult | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  // Phase 4B: Real Bi-Temporal Change Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [localAnalysisResult, setLocalAnalysisResult] = useState<any>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const activeAnalysis = analysisResult || localAnalysisResult;

  // Handle Manual AOI Apply
  const handleApplyManualAoi = () => {
    setManualError(null);
    const minLat = parseFloat(manualMinLat);
    const minLon = parseFloat(manualMinLon);
    const maxLat = parseFloat(manualMaxLat);
    const maxLon = parseFloat(manualMaxLon);

    if (isNaN(minLat) || isNaN(minLon) || isNaN(maxLat) || isNaN(maxLon)) {
      setManualError("All 4 coordinates must be valid numbers.");
      return;
    }
    if (minLat < -90 || minLat > 90 || maxLat < -90 || maxLat > 90) {
      setManualError("Latitude must be between -90 and 90 degrees.");
      return;
    }
    if (minLon < -180 || minLon > 180 || maxLon < -180 || maxLon > 180) {
      setManualError("Longitude must be between -180 and 180 degrees.");
      return;
    }
    if (minLat >= maxLat) {
      setManualError("Min Latitude must be less than Max Latitude.");
      return;
    }
    if (minLon >= maxLon) {
      setManualError("Min Longitude must be less than Max Longitude.");
      return;
    }

    onAoiChange({
      min_lat: minLat,
      min_lon: minLon,
      max_lat: maxLat,
      max_lon: maxLon,
    });
  };

  // Preset Selection
  const handleSelectPreset = (preset: (typeof PRESET_AOIS)[0]) => {
    onAoiChange(preset.bbox);
    setManualMinLat(preset.bbox.min_lat.toString());
    setManualMinLon(preset.bbox.min_lon.toString());
    setManualMaxLat(preset.bbox.max_lat.toString());
    setManualMaxLon(preset.bbox.max_lon.toString());
    setManualError(null);
  };

  // Execute Scene Search
  const handleSearchScenes = async (overrideAoi?: BoundingBox | any) => {
    const targetAoi = (overrideAoi && typeof overrideAoi === "object" && "min_lat" in overrideAoi)
      ? (overrideAoi as BoundingBox)
      : aoi;

    if (!targetAoi) {
      setSearchError("Please select or draw an Area of Interest (AOI) on the map first.");
      return;
    }

    if (!startDate || !endDate) {
      setSearchError("Both start date and end date are required.");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setSearchError("Start date cannot be later than end date.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const response = await satelliteClient.searchScenes({
        aoi: targetAoi,
        startDate,
        endDate,
        maxCloudCover,
        limit,
      });

      setScenes(response.scenes || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setSearchError(
        `Live satellite data unavailable. Switch to Controlled Benchmark Mode. (${message})`
      );
      setScenes([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Execute Temporal Pair Discovery
  const handleFindPairs = async () => {
    if (!aoi) {
      setPairError("Please select or draw an Area of Interest (AOI) on the map first.");
      return;
    }

    setIsFindingPairs(true);
    setPairError(null);
    setHasSearchedPairs(true);

    try {
      const response = await satelliteClient.getTemporalPairs(aoi, {
        maxCloudCover,
        minDaysDifference: 14,
        maxDaysDifference: 730,
      });

      setTemporalPairs(response.pairs || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPairError(
        `Live satellite data unavailable. Switch to Controlled Benchmark Mode. (${message})`
      );
      setTemporalPairs([]);
    } finally {
      setIsFindingPairs(false);
    }
  };

  // Scene Selection Guard: Prevent selecting the same scene for both
  const handleSetBefore = (scene: SatelliteScene) => {
    if (selectedAfterScene && selectedAfterScene.sceneId === scene.sceneId) {
      alert("Cannot select the same scene as both Before and After. Please choose a different acquisition.");
      return;
    }
    onSelectScene(scene, "before");
    if (onFocusSceneOnMap) onFocusSceneOnMap(scene);
  };

  const handleSetAfter = (scene: SatelliteScene) => {
    if (selectedBeforeScene && selectedBeforeScene.sceneId === scene.sceneId) {
      alert("Cannot select the same scene as both Before and After. Please choose a different acquisition.");
      return;
    }
    onSelectScene(scene, "after");
    if (onFocusSceneOnMap) onFocusSceneOnMap(scene);
  };

  const handleApplyPair = (pair: TemporalPairCandidate) => {
    onSelectPair(pair);
    onSelectScene(pair.beforeScene, "before");
    onSelectScene(pair.afterScene, "after");
    if (onFocusSceneOnMap) onFocusSceneOnMap(pair.afterScene);
  };

  // Phase 4A: Execute Analysis Preparation & Spatial Alignment
  const handlePrepareAnalysis = async () => {
    if (!selectedBeforeScene || !selectedAfterScene) {
      setPrepareError("Please select both a Before scene and an After scene.");
      return;
    }

    if (!aoi) {
      setPrepareError("Please define an Area of Interest (AOI) bounding box.");
      return;
    }

    setIsPreparing(true);
    setPrepareError(null);

    try {
      const result = await satelliteClient.prepareAnalysis(
        selectedBeforeScene.sceneId,
        selectedAfterScene.sceneId,
        aoi,
        "LIVE_PUBLIC_DATA"
      );
      setPrepareResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPrepareError(`Analysis preparation failed: ${msg}`);
      setPrepareResult(null);
    } finally {
      setIsPreparing(false);
    }
  };

  // Phase 4B: Execute Real Bi-Temporal Change Detection
  const handleRunAnalysis = async () => {
    if (!selectedBeforeScene || !selectedAfterScene) {
      setAnalysisError("Please select both a Before scene and an After scene.");
      return;
    }

    if (!aoi) {
      setAnalysisError("Please define an Area of Interest (AOI) bounding box.");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const result = await satelliteClient.analyzePair(
        selectedBeforeScene.sceneId,
        selectedAfterScene.sceneId,
        aoi,
        { mode: "LIVE_PUBLIC_DATA" }
      );
      setLocalAnalysisResult(result);
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAnalysisError(`Live change analysis failed: ${msg}`);
      setLocalAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Phase 5A: Semantic Query Handoff to Sentinel-2 Discovery
  const handleSemanticSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!semanticQuery.trim()) return;

    setIsSemanticSearching(true);
    setSemanticSearchError(null);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: semanticQuery.trim(), top_k: 4 }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setSemanticResults(data.results);
      } else {
        setSemanticResults([]);
        setSemanticSearchError(data.message || "No matching catalog locations found for this query.");
      }
    } catch (err: unknown) {
      setSemanticSearchError("Semantic search failed. You can still define AOI manually or select a preset.");
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const handleSelectSemanticLocation = (location: any) => {
    if (!location || !location.bounding_box) {
      setSemanticSearchError("Selected location lacks valid geographic bounding coordinates.");
      return;
    }
    const bbox: BoundingBox = {
      min_lat: location.bounding_box.min_lat,
      min_lon: location.bounding_box.min_lon,
      max_lat: location.bounding_box.max_lat,
      max_lon: location.bounding_box.max_lon,
    };
    onAoiChange(bbox);
    setManualMinLat(bbox.min_lat.toString());
    setManualMinLon(bbox.min_lon.toString());
    setManualMaxLat(bbox.max_lat.toString());
    setManualMaxLon(bbox.max_lon.toString());
    setManualError(null);
    setSemanticResults([]);
    // Immediately execute satellite scene search for the target AOI
    handleSearchScenes(bbox);
  };

  // Phase 5A: Cluster Selection & Adjudication Handlers
  const handleSelectCluster = (clusterId: string) => {
    setInternalSelectedClusterId(clusterId);
    if (onSelectCluster) {
      onSelectCluster(clusterId);
    }
    const existing = analystReviews[clusterId];
    setCurrentAnalystNote(existing?.notes || "");
  };

  const handleAdjudicate = (clusterId: string, decision: "CONFIRMED" | "REJECTED" | "UNREVIEWED") => {
    setAnalystReviews((prev) => ({
      ...prev,
      [clusterId]: {
        decision,
        notes: currentAnalystNote,
        timestamp: new Date().toISOString(),
      },
    }));
  };

  const handleSaveNotes = (clusterId: string) => {
    setAnalystReviews((prev) => {
      const current = prev[clusterId] || { decision: "UNREVIEWED", notes: "", timestamp: new Date().toISOString() };
      return {
        ...prev,
        [clusterId]: {
          ...current,
          notes: currentAnalystNote,
          timestamp: new Date().toISOString(),
        },
      };
    });
  };

  // Phase 5A: Evidence Report Export
  const handleExportEvidence = async (format: "markdown" | "json") => {
    if (!activeAnalysis) return;
    setIsExporting(true);
    setExportNotice(null);

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          live_analysis: activeAnalysis,
          aoi,
          before_scene: selectedBeforeScene,
          after_scene: selectedAfterScene,
          analyst_reviews: analystReviews,
        }),
      });

      if (!res.ok) throw new Error("Export endpoint returned HTTP " + res.status);
      const data = await res.json();

      const contentStr = typeof data.content === "string" ? data.content : JSON.stringify(data.content, null, 2);
      const mimeType = format === "markdown" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8";
      const blob = new Blob([contentStr], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || `terralens_live_evidence.${format === "markdown" ? "md" : "json"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice(`Exported evidence dossier: ${a.download}`);
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setExportNotice(`Export failed: ${msg}`);
      setTimeout(() => setExportNotice(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Mode Status Header Banner */}
      <div className="p-3.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-lg shadow-emerald-950/20">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-mono font-bold tracking-wider">LIVE PUBLIC DATA MODE ACTIVE</span>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-500/30">
          COPERNICUS SENTINEL-2 L2A
        </span>
      </div>

      {/* Phase 5A: Semantic Target Discovery Handoff Card */}
      <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-semibold text-xs uppercase tracking-wider">
            <Search className="w-4 h-4" />
            <span>Semantic Target Retrieval Handoff (CLIP ViT-B/32)</span>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
            NATURAL LANGUAGE QUERY → AOI
          </span>
        </div>

        <p className="text-[11px] text-slate-300 font-mono leading-relaxed">
          Type a natural language description to match candidate catalog locations, extract spatial coordinates, and seed the live Sentinel-2 acquisition pipeline.
        </p>

        <form onSubmit={handleSemanticSearch} className="flex gap-2">
          <input
            type="text"
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
            placeholder='e.g. "new construction near Hyderabad", "solar park in desert", "reservoir shrinkage"'
            className="flex-1 bg-tactical-900 border border-tactical-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            disabled={isSemanticSearching || !semanticQuery.trim()}
            className="px-4 py-2 rounded-lg bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {isSemanticSearching ? (
              <>
                <Search className="w-3.5 h-3.5 animate-spin" />
                <span>SEARCHING...</span>
              </>
            ) : (
              <>
                <Search className="w-3.5 h-3.5" />
                <span>RETRIEVE</span>
              </>
            )}
          </button>
        </form>

        {semanticSearchError && (
          <p className="text-xs text-amber-400 font-mono p-2 rounded bg-amber-950/30 border border-amber-500/30">
            {semanticSearchError}
          </p>
        )}

        {semanticResults.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-tactical-750">
            <span className="text-[10px] font-mono uppercase text-slate-400 block">
              Retrieved Target Candidates ({semanticResults.length}) — Click to Seed AOI & Discover Scenes:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {semanticResults.map((item: any, idx: number) => {
                const loc = item.location;
                if (!loc) return null;
                return (
                  <div
                    key={loc.location_id || idx}
                    className="p-2.5 rounded bg-tactical-900 border border-tactical-750 hover:border-cyan-500/60 transition-all space-y-1.5 text-xs font-mono"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 truncate">{loc.name}</span>
                      <span className="text-[10px] text-cyan-300 font-bold">
                        Sim: {(item.similarity_score ?? 0.25).toFixed(3)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2">{loc.description}</p>
                    <button
                      type="button"
                      onClick={() => handleSelectSemanticLocation(loc)}
                      className="w-full mt-1 py-1 px-2 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>LOAD AOI & DISCOVER SCENES</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 2. Area of Interest (AOI) Definition Card */}
      <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-semibold text-xs uppercase tracking-wider">
            <Crosshair className="w-4 h-4" />
            <span>Area of Interest (AOI)</span>
          </div>

          {/* Toggle Draw vs Manual */}
          <div className="flex rounded-md bg-tactical-900 p-0.5 border border-tactical-750 text-[11px] font-mono">
            <button
              onClick={() => setAoiMode("draw")}
              className={`px-2.5 py-1 rounded transition-colors ${
                aoiMode === "draw" ? "bg-cyan-500/30 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Map Draw
            </button>
            <button
              onClick={() => setAoiMode("manual")}
              className={`px-2.5 py-1 rounded transition-colors ${
                aoiMode === "manual" ? "bg-cyan-500/30 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Manual Bounds
            </button>
          </div>
        </div>

        {/* AOI Method A: Map Draw */}
        {aoiMode === "draw" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleDrawingAoi(!isDrawingAoi)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-semibold transition-all shadow-sm ${
                  isDrawingAoi
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse"
                    : "bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                }`}
              >
                <Crosshair className="w-4 h-4" />
                <span>{isDrawingAoi ? "CLICK 2 POINTS ON MAP (CANCEL)" : "DRAW RECTANGLE ON MAP"}</span>
              </button>

              {aoi && (
                <button
                  onClick={() => onAoiChange(null)}
                  className="px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono transition-colors"
                  title="Clear current AOI"
                >
                  Clear AOI
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              {isDrawingAoi
                ? "Click top-left corner on the map, move cursor, then click bottom-right corner to complete."
                : "Click the button above to draw an AOI rectangle directly on the interactive map."}
            </p>
          </div>
        ) : (
          /* AOI Method B: Manual Bounds */
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Min Lat</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="17.3600"
                  value={manualMinLat}
                  onChange={(e) => setManualMinLat(e.target.value)}
                  className="w-full bg-tactical-900 border border-tactical-700 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Min Lon</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="78.4000"
                  value={manualMinLon}
                  onChange={(e) => setManualMinLon(e.target.value)}
                  className="w-full bg-tactical-900 border border-tactical-700 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Max Lat</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="17.5200"
                  value={manualMaxLat}
                  onChange={(e) => setManualMaxLat(e.target.value)}
                  className="w-full bg-tactical-900 border border-tactical-700 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono text-slate-400 uppercase">Max Lon</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="78.5600"
                  value={manualMaxLon}
                  onChange={(e) => setManualMaxLon(e.target.value)}
                  className="w-full bg-tactical-900 border border-tactical-700 rounded px-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {manualError && (
              <p className="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                <span>{manualError}</span>
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleApplyManualAoi}
                className="flex-1 py-1.5 px-3 rounded bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-semibold transition-colors"
              >
                APPLY BOUNDING BOX
              </button>
              {aoi && (
                <button
                  onClick={() => {
                    onAoiChange(null);
                    setManualMinLat("");
                    setManualMinLon("");
                    setManualMaxLat("");
                    setManualMaxLon("");
                  }}
                  className="px-3 py-1.5 rounded bg-tactical-800 hover:bg-tactical-750 text-slate-400 text-xs font-mono"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Preset AOI Selector */}
        <div className="pt-2 border-t border-tactical-750">
          <div className="text-[10px] font-mono text-slate-400 uppercase mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>Preset Target Areas</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_AOIS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(preset)}
                className="text-left px-2 py-1.5 rounded bg-tactical-900/90 hover:bg-tactical-800 border border-tactical-700/60 hover:border-cyan-500/40 transition-colors"
              >
                <div className="text-[11px] font-semibold text-slate-200 truncate">{preset.name}</div>
                <div className="text-[9px] font-mono text-slate-400 truncate">{preset.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Active AOI Coordinates Display */}
        {aoi ? (
          <div className="p-2.5 rounded bg-tactical-900/80 border border-cyan-500/30 font-mono text-[11px] text-cyan-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              <span>ACTIVE AOI:</span>
            </div>
            <div className="text-slate-300">
              [{aoi.min_lat.toFixed(4)}, {aoi.min_lon.toFixed(4)}] to [{aoi.max_lat.toFixed(4)}, {aoi.max_lon.toFixed(4)}]
            </div>
          </div>
        ) : (
          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 font-mono text-[11px] text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>No AOI defined. Please draw or select a preset to search satellite archives.</span>
          </div>
        )}
      </div>

      {/* 3. Search Filters Form */}
      <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-md space-y-3">
        <div className="flex items-center gap-2 text-cyan-400 font-mono font-semibold text-xs uppercase tracking-wider">
          <Filter className="w-4 h-4" />
          <span>STAC Discovery Parameters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>Start Date</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full mt-1 bg-tactical-900 border border-tactical-700 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>End Date</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full mt-1 bg-tactical-900 border border-tactical-700 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Cloud className="w-3 h-3 text-cyan-400" />
              <span>Max Cloud ({maxCloudCover}%)</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={maxCloudCover}
              onChange={(e) => setMaxCloudCover(parseInt(e.target.value, 10))}
              className="w-full mt-2 accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>Limit ({limit})</span>
            </label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value, 10))}
              className="w-full mt-1 bg-tactical-900 border border-tactical-700 rounded px-2 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="5">5 Scenes</option>
              <option value="10">10 Scenes</option>
              <option value="20">20 Scenes</option>
              <option value="30">30 Scenes</option>
            </select>
          </div>
        </div>

        {/* Action Buttons: Search & Discover Pairs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleSearchScenes}
            disabled={isSearching || !aoi}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Search className="w-4 h-4" />
            <span>{isSearching ? "SEARCHING PUBLIC ARCHIVE..." : "SEARCH SATELLITE IMAGERY"}</span>
          </button>

          <button
            onClick={handleFindPairs}
            disabled={isFindingPairs || !aoi}
            className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-tactical-800 hover:bg-tactical-750 text-emerald-300 border border-emerald-500/40 hover:border-emerald-500/60 font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Clock className="w-4 h-4" />
            <span>{isFindingPairs ? "DISCOVERING PAIRS..." : "FIND TEMPORAL PAIRS"}</span>
          </button>
        </div>

        {/* Honest Error Banners */}
        {searchError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold">Live Data Error</p>
              <p className="text-[11px] text-rose-300/80">{searchError}</p>
            </div>
          </div>
        )}

        {pairError && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold">Temporal Discovery Error</p>
              <p className="text-[11px] text-rose-300/80">{pairError}</p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Active Scene Selection Overview (Before & After) */}
      <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-md space-y-3">
        <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider">
          <div className="text-cyan-400 font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Selected Temporal Pair For Analysis</span>
          </div>
          {(selectedBeforeScene || selectedAfterScene) && (
            <button
              onClick={() => {
                onSelectScene(null, "before");
                onSelectScene(null, "after");
                onSelectPair(null);
              }}
              className="text-[11px] text-slate-400 hover:text-rose-400 font-mono transition-colors"
            >
              Reset Selection
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Before Scene Box */}
          <div className="p-3 rounded-lg bg-tactical-900 border border-tactical-750 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                BEFORE SCENE (T1)
              </span>
              {selectedBeforeScene && (
                <button
                  onClick={() => onSelectScene(null, "before")}
                  className="text-slate-500 hover:text-rose-400 text-xs font-mono"
                >
                  ✕
                </button>
              )}
            </div>
            {selectedBeforeScene ? (
              <div className="space-y-1">
                <div className="font-mono text-xs font-bold text-slate-200 truncate" title={selectedBeforeScene.sceneId}>
                  {selectedBeforeScene.sceneId}
                </div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Date: {selectedBeforeScene.acquisitionDate.split("T")[0]}</span>
                  <span>Cloud: {selectedBeforeScene.cloudCoverPercentage.toFixed(1)}%</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  {selectedBeforeScene.platform} • {selectedBeforeScene.sourceProvider}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono italic">
                No before scene selected. Choose from the acquisitions below.
              </p>
            )}
          </div>

          {/* After Scene Box */}
          <div className="p-3 rounded-lg bg-tactical-900 border border-tactical-750 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                AFTER SCENE (T2)
              </span>
              {selectedAfterScene && (
                <button
                  onClick={() => onSelectScene(null, "after")}
                  className="text-slate-500 hover:text-rose-400 text-xs font-mono"
                >
                  ✕
                </button>
              )}
            </div>
            {selectedAfterScene ? (
              <div className="space-y-1">
                <div className="font-mono text-xs font-bold text-slate-200 truncate" title={selectedAfterScene.sceneId}>
                  {selectedAfterScene.sceneId}
                </div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between">
                  <span>Date: {selectedAfterScene.acquisitionDate.split("T")[0]}</span>
                  <span>Cloud: {selectedAfterScene.cloudCoverPercentage.toFixed(1)}%</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-400">
                  {selectedAfterScene.platform} • {selectedAfterScene.sourceProvider}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono italic">
                No after scene selected. Choose from the acquisitions below.
              </p>
            )}
          </div>
        </div>

        {selectedBeforeScene && selectedAfterScene && aoi && (
          <div className="pt-2 border-t border-tactical-750 space-y-3">
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrepareAnalysis}
                disabled={isPreparing}
                className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md flex items-center justify-center gap-2"
              >
                <Cpu className={`w-4 h-4 ${isPreparing ? "animate-spin" : ""}`} />
                <span>
                  {isPreparing ? "VERIFYING RASTER ASSETS & ALIGNMENT..." : "PREPARE FOR ANALYSIS (PHASE 4A)"}
                </span>
              </button>
            </div>

            {prepareError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <p className="font-bold">Analysis Preparation Error</p>
                  <p className="text-[11px] text-rose-300/80">{prepareError}</p>
                </div>
              </div>
            )}

            {prepareResult && (
              <div className="p-3.5 rounded-lg bg-tactical-900 border border-tactical-700 space-y-3 font-mono">
                {/* Header with overall readiness badge */}
                <div className="flex items-center justify-between pb-2 border-b border-tactical-800">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      ANALYSIS READINESS ASSESSMENT
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                      prepareResult.status === "READY_FOR_ANALYSIS"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    }`}
                  >
                    {prepareResult.status}
                  </span>
                </div>

                {/* Structured 10-point audit specification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Before Scene</span>
                    <span className="text-blue-300 truncate block font-semibold" title={prepareResult.beforeScene.sceneId}>
                      {prepareResult.beforeScene.sceneId}
                    </span>
                    <span className="text-[10px] text-slate-500">{prepareResult.beforeScene.acquisitionDate.split("T")[0]}</span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">After Scene</span>
                    <span className="text-amber-300 truncate block font-semibold" title={prepareResult.afterScene.sceneId}>
                      {prepareResult.afterScene.sceneId}
                    </span>
                    <span className="text-[10px] text-slate-500">{prepareResult.afterScene.acquisitionDate.split("T")[0]}</span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Analysis Asset</span>
                    <span className="text-emerald-300 font-semibold truncate block">
                      {prepareResult.analysisAssets.before[0]?.title || "True Color COG (10m)"}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {prepareResult.analysisAssets.before.length} analysis bands verified
                    </span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Resolution & CRS</span>
                    <span className="text-cyan-300 font-semibold block">
                      {prepareResult.alignment.targetResolution} m • {prepareResult.alignment.targetCrs}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      CRS Match: {prepareResult.alignment.crsMatch ? "EXACT" : "REPROJECTION"}
                    </span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Spatial Coverage</span>
                    <span className="text-slate-200 font-semibold block">
                      {prepareResult.alignment.aoiIntersectionPercentage}% AOI Overlap
                    </span>
                    <span className="text-[10px] text-slate-500">Both scenes cover target area</span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Temporal Gap</span>
                    <span className="text-purple-300 font-semibold block">
                      {prepareResult.temporalSeparationDays} days baseline
                    </span>
                    <span className="text-[10px] text-slate-500">Chronological order verified</span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Raster Readiness</span>
                    <span className="text-emerald-400 font-semibold block">READY</span>
                    <span className="text-[10px] text-slate-500">Cloud-Optimized GeoTIFFs (COGs)</span>
                  </div>

                  <div className="bg-tactical-950 p-2 rounded border border-tactical-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Alignment Readiness</span>
                    <span className="text-emerald-400 font-semibold block">
                      {prepareResult.alignment.status}
                    </span>
                    <span className="text-[10px] text-slate-500 truncate block" title={prepareResult.alignment.dimensionReconciliation.method}>
                      {prepareResult.alignment.dimensionReconciliation.method}
                    </span>
                  </div>
                </div>

                {/* Provenance Evidence Chain */}
                <div className="p-2.5 rounded bg-tactical-950 border border-tactical-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Binary className="w-3.5 h-3.5 text-cyan-400" />
                      <span>PROVENANCE EVIDENCE RECORD:</span>
                    </span>
                    <span className="font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                      {prepareResult.provenance.provenanceId}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-0.5">
                    <div><span className="text-slate-500">Processing Level:</span> {prepareResult.provenance.processingLevel}</div>
                    <div><span className="text-slate-500">Timestamp:</span> {prepareResult.provenance.timestamp}</div>
                    <div>
                      <span className="text-slate-500">Chain:</span>{" "}
                      {prepareResult.provenance.processingChain.join(" → ")}
                    </div>
                  </div>
                </div>

                {/* Scientific Rule Notice */}
                <div className="p-2 rounded bg-cyan-950/30 border border-cyan-500/30 text-[10px] text-cyan-300/90 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 flex-shrink-0 animate-pulse"></span>
                  <span>
                    Scientific Rule Enforced: True-color / NIR Cloud-Optimized GeoTIFFs selected. Preview JPEG/PNGs excluded from scientific processing. Staged for Phase 4B change detection.
                  </span>
                </div>

                {/* Phase 4B: Run Change Analysis Trigger */}
                {prepareResult.status === "READY_FOR_ANALYSIS" && (
                  <div className="pt-3 border-t border-tactical-800 space-y-3">
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzing}
                      className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-mono font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2 animate-pulse"
                    >
                      <Activity className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                      <span>
                        {isAnalyzing ? "ACQUIRING COGs & EXECUTING RASTER ANALYSIS..." : "RUN BI-TEMPORAL CHANGE ANALYSIS (PHASE 4B)"}
                      </span>
                    </button>

                    {analysisError && (
                      <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                        <div>
                          <p className="font-bold">Live Change Analysis Error</p>
                          <p className="text-[11px] text-rose-300/80">{analysisError}</p>
                        </div>
                      </div>
                    )}

                    {/* LIVE CHANGE ANALYSIS DASHBOARD */}
                    {activeAnalysis && activeAnalysis.status === "ANALYZED" && (
                      <div className="p-3.5 rounded-lg bg-tactical-950 border border-cyan-500/40 space-y-3 shadow-xl">
                        {/* Status Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-tactical-800">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-xs font-bold font-mono tracking-wider text-slate-100 uppercase">
                              LIVE SATELLITE CHANGE ANALYSIS RESULTS
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                            {activeAnalysis.status}
                          </span>
                        </div>

                        {/* Top Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
                          {/* Quality */}
                          <div className="bg-tactical-900 p-2.5 rounded border border-tactical-800">
                            <span className="text-slate-400 block text-[10px] uppercase">Valid Coverage</span>
                            <span className="text-emerald-300 text-sm font-bold block">
                              {activeAnalysis.quality?.validPercentage}%
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {activeAnalysis.quality?.validPixels?.toLocaleString()} pixels valid
                            </span>
                          </div>

                          {/* Changed Area */}
                          <div className="bg-tactical-900 p-2.5 rounded border border-tactical-800">
                            <span className="text-slate-400 block text-[10px] uppercase">Changed Area</span>
                            <span className="text-amber-300 text-sm font-bold block">
                              {activeAnalysis.change?.changedAreaHa} ha
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {activeAnalysis.change?.changedAreaKm2} km² ({activeAnalysis.change?.changedPixels} px)
                            </span>
                          </div>

                          {/* Adaptive Threshold */}
                          <div className="bg-tactical-900 p-2.5 rounded border border-tactical-800">
                            <span className="text-slate-400 block text-[10px] uppercase">Change Threshold</span>
                            <span className="text-cyan-300 text-sm font-bold block">
                              {activeAnalysis.change?.threshold}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Suppressed: {activeAnalysis.change?.falseAlarmsSuppressed} px
                            </span>
                          </div>

                          {/* Detected Clusters */}
                          <div className="bg-tactical-900 p-2.5 rounded border border-tactical-800">
                            <span className="text-slate-400 block text-[10px] uppercase">Spatial Clusters</span>
                            <span className="text-purple-300 text-sm font-bold block">
                              {activeAnalysis.clusters?.length || 0} Sites
                            </span>
                            <span className="text-[10px] text-slate-500">
                              Resolution: {activeAnalysis.change?.resolutionMeters || 10}m
                            </span>
                          </div>
                        </div>

                        {/* Classified Change Clusters Summary */}
                        <div className="space-y-1.5 font-mono">
                          <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                            Change Classification Breakdown
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                            {/* Construction */}
                            <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30 text-rose-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-rose-400" />
                                <span>Construction:</span>
                              </span>
                              <span className="font-bold">
                                {activeAnalysis.clusters?.filter((c: any) => c.changeClass.includes("CONSTRUCTION")).length || 0}
                              </span>
                            </div>

                            {/* Vegetation Loss */}
                            <div className="p-2 rounded bg-amber-950/30 border border-amber-500/30 text-amber-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-amber-400" />
                                <span>Clearance:</span>
                              </span>
                              <span className="font-bold">
                                {activeAnalysis.clusters?.filter((c: any) => c.changeClass.includes("LOSS") || c.changeClass.includes("CLEARANCE")).length || 0}
                              </span>
                            </div>

                            {/* Vegetation Growth */}
                            <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Trees className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Greening:</span>
                              </span>
                              <span className="font-bold">
                                {activeAnalysis.clusters?.filter((c: any) => c.changeClass.includes("GROWTH")).length || 0}
                              </span>
                            </div>

                            {/* Water Variation */}
                            <div className="p-2 rounded bg-blue-950/30 border border-blue-500/30 text-blue-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <Droplets className="w-3.5 h-3.5 text-blue-400" />
                                <span>Water Dynamics:</span>
                              </span>
                              <span className="font-bold">
                                {activeAnalysis.clusters?.filter((c: any) => c.changeClass.includes("WATER")).length || 0}
                              </span>
                            </div>

                            {/* Other / Uncertain */}
                            <div className="p-2 rounded bg-purple-950/30 border border-purple-500/30 text-purple-300 flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                                <span>Uncertain:</span>
                              </span>
                              <span className="font-bold">
                                {activeAnalysis.clusters?.filter((c: any) => c.changeClass.includes("UNCERTAIN") || c.changeClass.includes("OTHER")).length || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Phase 5A: Interactive Detected Clusters List */}
                        {activeAnalysis.clusters && activeAnalysis.clusters.length > 0 && (
                          <div className="space-y-2 font-mono">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-bold">
                                Detected Spatial Change Clusters ({activeAnalysis.clusters.length})
                              </span>
                              <span className="text-[9px] text-cyan-400">
                                Click cluster to inspect & adjudicate
                              </span>
                            </div>

                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                              {activeAnalysis.clusters.map((clust: any) => {
                                const isSelected = activeClusterId === clust.clusterId;
                                const review = analystReviews[clust.clusterId] || { decision: "UNREVIEWED", notes: "" };

                                return (
                                  <div
                                    key={clust.clusterId}
                                    onClick={() => handleSelectCluster(clust.clusterId)}
                                    className={`p-2.5 rounded border transition-all cursor-pointer text-[11px] space-y-1.5 ${
                                      isSelected
                                        ? "bg-cyan-950/40 border-cyan-400 ring-1 ring-cyan-400 shadow-md"
                                        : "bg-tactical-900 border-tactical-800 hover:border-slate-500"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className={`font-bold ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                                          {clust.clusterId}
                                        </span>
                                        <span className="text-slate-300 font-semibold">{clust.changeClass}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {/* Analyst Status Badge */}
                                        <span
                                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                            review.decision === "CONFIRMED"
                                              ? "bg-emerald-950 text-emerald-300 border-emerald-500/50"
                                              : review.decision === "REJECTED"
                                              ? "bg-rose-950 text-rose-300 border-rose-500/50"
                                              : "bg-tactical-800 text-slate-400 border-tactical-700"
                                          }`}
                                        >
                                          {review.decision}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-tactical-800 text-slate-300 border border-tactical-700">
                                          Conf: {typeof clust.confidenceScore === "number" ? clust.confidenceScore.toFixed(2) : clust.confidenceScore}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                                      <span>Area: {clust.areaHa} ha ({clust.pixelCount} px)</span>
                                      <span>Centroid: [{clust.centroid[0].toFixed(4)}, {clust.centroid[1].toFixed(4)}]</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 leading-tight italic">
                                      {clust.classificationRationale}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Phase 5A: Selected Cluster Evidence & Analyst Adjudication Station */}
                        {activeClusterId && (() => {
                          const cluster = activeAnalysis.clusters?.find((c: any) => c.clusterId === activeClusterId);
                          if (!cluster) return null;
                          const currentReview = analystReviews[cluster.clusterId] || { decision: "UNREVIEWED", notes: "" };

                          return (
                            <div className="p-3.5 rounded-lg bg-tactical-900 border border-cyan-500/50 space-y-3 font-mono">
                              <div className="flex items-center justify-between pb-2 border-b border-tactical-800">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-cyan-300 uppercase">
                                    CLUSTER EVIDENCE: #{cluster.clusterId}
                                  </span>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-tactical-800 text-slate-200 border border-tactical-700">
                                    {cluster.changeClass}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                                    currentReview.decision === "CONFIRMED"
                                      ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                                      : currentReview.decision === "REJECTED"
                                      ? "bg-rose-950 text-rose-300 border-rose-500"
                                      : "bg-tactical-800 text-amber-300 border-amber-500/40"
                                  }`}
                                >
                                  {currentReview.decision}
                                </span>
                              </div>

                              {/* Cluster Detailed Metrics */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                                <div className="p-2 rounded bg-tactical-950 border border-tactical-800">
                                  <span className="text-slate-400 block uppercase">Area</span>
                                  <span className="text-slate-200 font-bold block">{cluster.areaHa} ha</span>
                                  <span className="text-slate-500">{(cluster.pixelCount * 100).toLocaleString()} m²</span>
                                </div>
                                <div className="p-2 rounded bg-tactical-950 border border-tactical-800">
                                  <span className="text-slate-400 block uppercase">Confidence Score</span>
                                  <span className="text-cyan-300 font-bold block">
                                    {typeof cluster.confidenceScore === "number" ? cluster.confidenceScore.toFixed(2) : cluster.confidenceScore}
                                  </span>
                                  <span className="text-slate-500">Heuristic metric</span>
                                </div>
                                <div className="p-2 rounded bg-tactical-950 border border-tactical-800">
                                  <span className="text-slate-400 block uppercase">Centroid [Lat, Lon]</span>
                                  <span className="text-slate-200 font-bold block">
                                    {cluster.centroid[0].toFixed(4)}, {cluster.centroid[1].toFixed(4)}
                                  </span>
                                  <span className="text-slate-500">WGS84 EPSG:4326</span>
                                </div>
                                <div className="p-2 rounded bg-tactical-950 border border-tactical-800">
                                  <span className="text-slate-400 block uppercase">Change Score</span>
                                  <span className="text-amber-300 font-bold block">
                                    {cluster.meanChangeScore ?? cluster.confidenceScore}
                                  </span>
                                  <span className="text-slate-500">Spectral difference</span>
                                </div>
                              </div>

                              {/* Explainable Rationale */}
                              <div className="p-2 rounded bg-tactical-950 border border-tactical-800 text-[11px] space-y-1">
                                <span className="text-[10px] text-slate-400 uppercase block font-bold">
                                  Classification Rationale (Explainable Spectral Heuristic):
                                </span>
                                <p className="text-slate-300 italic">{cluster.classificationRationale}</p>
                              </div>

                              {/* Multi-Temporal Evidence Chips */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                                <div className="p-2 rounded bg-tactical-950 border border-blue-500/30 flex items-center justify-between">
                                  <div>
                                    <span className="text-blue-400 font-bold block">BEFORE ACQUISITION (T1)</span>
                                    <span className="text-slate-300 truncate block max-w-[180px]">
                                      {selectedBeforeScene?.sceneId || "T1 Scene"}
                                    </span>
                                    <span className="text-slate-500">
                                      Date: {selectedBeforeScene?.acquisitionDate?.split("T")[0] || "N/A"}
                                    </span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 text-[9px] border border-blue-500/30">
                                    PREVIEW
                                  </span>
                                </div>
                                <div className="p-2 rounded bg-tactical-950 border border-amber-500/30 flex items-center justify-between">
                                  <div>
                                    <span className="text-amber-400 font-bold block">AFTER ACQUISITION (T2)</span>
                                    <span className="text-slate-300 truncate block max-w-[180px]">
                                      {selectedAfterScene?.sceneId || "T2 Scene"}
                                    </span>
                                    <span className="text-slate-500">
                                      Date: {selectedAfterScene?.acquisitionDate?.split("T")[0] || "N/A"}
                                    </span>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 text-[9px] border border-amber-500/30">
                                    PREVIEW
                                  </span>
                                </div>
                              </div>

                              {/* Analyst Adjudication Station (Confirm / Reject / Notes) */}
                              <div className="p-3 rounded bg-tactical-950 border border-tactical-800 space-y-2.5">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-bold text-slate-300 uppercase">
                                    Analyst Adjudication Station
                                  </span>
                                  <span className="text-[10px] text-slate-500">
                                    Default: UNREVIEWED
                                  </span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAdjudicate(cluster.clusterId, "CONFIRMED")}
                                    className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                      currentReview.decision === "CONFIRMED"
                                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-950"
                                        : "bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/40"
                                    }`}
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    <span>CONFIRM CHANGE</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAdjudicate(cluster.clusterId, "REJECTED")}
                                    className={`flex-1 py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                      currentReview.decision === "REJECTED"
                                        ? "bg-rose-600 text-white shadow-md shadow-rose-950"
                                        : "bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-500/40"
                                    }`}
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>REJECT CHANGE</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleAdjudicate(cluster.clusterId, "UNREVIEWED")}
                                    className={`py-1.5 px-3 rounded text-xs transition-all ${
                                      currentReview.decision === "UNREVIEWED"
                                        ? "bg-tactical-800 text-slate-300 border border-tactical-700"
                                        : "bg-tactical-900 hover:bg-tactical-850 text-slate-400 border border-tactical-800"
                                    }`}
                                  >
                                    RESET
                                  </button>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[10px] text-slate-400 uppercase block">
                                    Analyst Inspection Notes:
                                  </label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={currentAnalystNote}
                                      onChange={(e) => setCurrentAnalystNote(e.target.value)}
                                      placeholder="e.g., Construction confirmed via road expansion; reflectance jump aligns with satellite foundation work."
                                      className="flex-1 bg-tactical-900 border border-tactical-750 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveNotes(cluster.clusterId)}
                                      className="px-3 py-1.5 rounded bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors"
                                    >
                                      SAVE
                                    </button>
                                  </div>
                                </div>

                                {currentReview.timestamp && (
                                  <div className="text-[9px] text-slate-500 flex items-center justify-between pt-1">
                                    <span>Adjudicated: {currentReview.decision}</span>
                                    <span>Timestamp: {currentReview.timestamp}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Phase 5A: Processing Provenance Chain Drawer */}
                        {activeAnalysis.provenance && (
                          <div className="p-3 rounded bg-tactical-900 border border-tactical-800 font-mono text-[10px] text-slate-400 space-y-1.5">
                            <div className="flex items-center justify-between text-cyan-300">
                              <span className="font-bold flex items-center gap-1.5">
                                <Binary className="w-3.5 h-3.5" />
                                <span>PROCESSING PROVENANCE RECORD:</span>
                              </span>
                              <span className="bg-cyan-950 px-1.5 py-0.5 rounded border border-cyan-500/30 font-bold">
                                {activeAnalysis.provenance.provenanceId}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-slate-400">
                              <div><span className="text-slate-500">Sensor:</span> Sentinel-2 MSI Level-2A BOA</div>
                              <div><span className="text-slate-500">Execution:</span> {activeAnalysis.provenance.timestamp}</div>
                              <div><span className="text-slate-500">Analysis Assets:</span> B04 (Red 10m), B08 (NIR 10m), SCL Quality (20m)</div>
                              <div><span className="text-slate-500">Cutoff:</span> {activeAnalysis.change?.thresholdMethod} ({activeAnalysis.change?.threshold})</div>
                            </div>
                            <div>
                              <span className="text-slate-500">Processing Chain:</span>{" "}
                              {activeAnalysis.provenance.processingChain?.join(" → ")}
                            </div>
                          </div>
                        )}

                        {/* Phase 5A: Export Evidence Report Action Bar */}
                        <div className="pt-2 border-t border-tactical-800 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-slate-300 uppercase flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-cyan-400" />
                              <span>Analyst Evidence Dossier Export</span>
                            </span>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleExportEvidence("markdown")}
                                disabled={isExporting}
                                className="py-1.5 px-3 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>EXPORT DOSSIER (.MD)</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleExportEvidence("json")}
                                disabled={isExporting}
                                className="py-1.5 px-3 rounded bg-tactical-800 hover:bg-tactical-750 text-slate-300 border border-tactical-700 text-xs font-mono font-bold transition-all flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>EXPORT JSON</span>
                              </button>
                            </div>
                          </div>

                          {exportNotice && (
                            <p className="text-xs font-mono text-emerald-300 bg-emerald-950/40 p-2 rounded border border-emerald-500/30">
                              {exportNotice}
                            </p>
                          )}
                        </div>

                        {/* Phase 5A: Scientific Disclosure Notice */}
                        <div className="p-2.5 rounded bg-tactical-950 border border-tactical-800 text-[10px] font-mono text-slate-400 space-y-1">
                          <span className="text-cyan-400 font-bold block uppercase">
                            Scientific & Analytical Disclosure:
                          </span>
                          <p className="leading-relaxed text-slate-400">
                            Live change classifications are explainable spectral heuristics derived from Sentinel-2 multispectral observations. Confidence scores are heuristic confidence indicators and are not calibrated probabilities. Analyst decisions are separate from automated detection.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. Temporal Pair Candidates List (if searched) */}
      {hasSearchedPairs && (
        <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-cyan-400 font-mono font-semibold text-xs uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>Recommended Temporal Pairs ({temporalPairs.length})</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
              STAC MULTI-TEMPORAL DISCOVERY
            </span>
          </div>

          {temporalPairs.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {temporalPairs.map((pair, idx) => {
                const isSelected =
                  selectedBeforeScene?.sceneId === pair.beforeScene.sceneId &&
                  selectedAfterScene?.sceneId === pair.afterScene.sceneId;

                return (
                  <div
                    key={`${pair.beforeScene.sceneId}_${pair.afterScene.sceneId}_${idx}`}
                    className={`p-3 rounded-lg border transition-all ${
                      isSelected
                        ? "bg-cyan-950/30 border-cyan-400 shadow-md"
                        : "bg-tactical-900 border-tactical-750 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {pair.recommended && (
                          <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                            ★ RECOMMENDED
                          </span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-200">
                          {pair.daysDifference} Days Interval
                        </span>
                      </div>

                      <button
                        onClick={() => handleApplyPair(pair)}
                        className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-colors ${
                          isSelected
                            ? "bg-cyan-500 text-tactical-900"
                            : "bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40"
                        }`}
                      >
                        {isSelected ? "PAIR SELECTED" : "SELECT PAIR"}
                      </button>
                    </div>

                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="p-1.5 rounded bg-tactical-850/80 border border-tactical-800">
                        <span className="text-blue-400 font-bold">T1:</span>{" "}
                        <span className="text-slate-300">{pair.beforeScene.acquisitionDate.split("T")[0]}</span>
                        <div className="text-[10px] text-slate-500 truncate">{pair.beforeScene.sceneId}</div>
                      </div>

                      <div className="p-1.5 rounded bg-tactical-850/80 border border-tactical-800">
                        <span className="text-amber-400 font-bold">T2:</span>{" "}
                        <span className="text-slate-300">{pair.afterScene.acquisitionDate.split("T")[0]}</span>
                        <div className="text-[10px] text-slate-500 truncate">{pair.afterScene.sceneId}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 font-mono italic p-3 bg-tactical-900 rounded-lg">
              No suitable Sentinel-2 temporal pair found for the selected AOI and constraints.
            </p>
          )}
        </div>
      )}

      {/* 6. Live STAC Scene Acquisitions List */}
      <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-cyan-400 font-mono font-semibold text-xs uppercase tracking-wider">
            <SatelliteSceneIcon className="w-4 h-4" />
            <span>Copernicus Sentinel-2 Acquisitions ({scenes.length})</span>
          </div>

          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
            LIVE PUBLIC DATA
          </span>
        </div>

        {isSearching && (
          <div className="p-8 text-center space-y-2 bg-tactical-900/60 rounded-lg border border-tactical-750">
            <div className="inline-block animate-spin text-cyan-400">
              <Search className="w-6 h-6" />
            </div>
            <div className="text-xs font-mono font-bold text-cyan-300 tracking-wider">
              SEARCHING PUBLIC SENTINEL-2 ARCHIVE...
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              Querying Planetary Computer STAC endpoint for L2A surface reflectance tiles
            </p>
          </div>
        )}

        {!isSearching && scenes.length > 0 && (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {scenes.map((scene) => {
              const isBefore = selectedBeforeScene?.sceneId === scene.sceneId;
              const isAfter = selectedAfterScene?.sceneId === scene.sceneId;

              return (
                <div
                  key={scene.sceneId}
                  className={`p-3 rounded-lg border transition-all ${
                    isBefore || isAfter
                      ? "bg-tactical-800/90 border-cyan-400 shadow-md"
                      : "bg-tactical-900 border-tactical-750 hover:border-slate-500"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    {/* Scene Thumbnail Preview */}
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 rounded overflow-hidden bg-tactical-950 border border-tactical-700 flex-shrink-0">
                        {scene.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={scene.thumbnailUrl}
                            alt="Scene preview"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-600 font-mono text-[9px]">
                            NO PREVIEW
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 bg-tactical-950/80 text-[8px] font-mono px-1 text-slate-400">
                          Preview
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="font-mono text-xs font-bold text-slate-200 truncate max-w-xs sm:max-w-md" title={scene.sceneId}>
                          {scene.sceneId}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-400">
                          <span>{scene.acquisitionDate.split("T")[0]}</span>
                          <span>•</span>
                          <span>{scene.platform}</span>
                          <span>•</span>
                          <span
                            className={
                              scene.cloudCoverPercentage < 10
                                ? "text-emerald-400"
                                : scene.cloudCoverPercentage < 30
                                ? "text-amber-400"
                                : "text-rose-400"
                            }
                          >
                            Cloud: {scene.cloudCoverPercentage.toFixed(1)}%
                          </span>
                          {scene.mgrsTile && (
                            <>
                              <span>•</span>
                              <span>MGRS: {scene.mgrsTile}</span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Source: {scene.sourceProvider}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons: Set Before / After */}
                    <div className="flex sm:flex-col items-center gap-1.5 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleSetBefore(scene)}
                        className={`w-full sm:w-28 py-1 px-2 rounded text-[11px] font-mono font-semibold transition-colors ${
                          isBefore
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30"
                        }`}
                      >
                        {isBefore ? "SELECTED BEFORE" : "SET AS BEFORE"}
                      </button>

                      <button
                        onClick={() => handleSetAfter(scene)}
                        className={`w-full sm:w-28 py-1 px-2 rounded text-[11px] font-mono font-semibold transition-colors ${
                          isAfter
                            ? "bg-amber-600 text-white font-bold"
                            : "bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {isAfter ? "SELECTED AFTER" : "SET AS AFTER"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isSearching && scenes.length === 0 && hasSearched && (
          <div className="p-6 text-center text-slate-400 font-mono text-xs bg-tactical-900 rounded-lg">
            No Sentinel-2 scenes matched your criteria. Try widening your date range or increasing the cloud cover limit.
          </div>
        )}

        {!isSearching && !hasSearched && (
          <div className="p-6 text-center text-slate-500 font-mono text-xs bg-tactical-900/50 rounded-lg border border-dashed border-tactical-750">
            Define an AOI and click &quot;SEARCH SATELLITE IMAGERY&quot; to discover real public Sentinel-2 L2A acquisitions.
          </div>
        )}
      </div>
    </div>
  );
}

function SatelliteSceneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M4.93 4.93l4.24 4.24" />
      <path d="M14.83 14.83l4.24 4.24" />
      <path d="M14.83 9.17l4.24-4.24" />
      <path d="M4.93 19.07l4.24-4.24" />
    </svg>
  );
}
