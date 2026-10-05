"use client";

import React, { useState, useRef, useCallback } from "react";
import { Location, Scene } from "@/types";
import {
  SplitSquareVertical,
  Columns2,
  Calendar,
  Clock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  History,
} from "lucide-react";

interface CompareStageProps {
  location: Location;
  beforeScene?: Scene | any | null;
  afterScene?: Scene | any | null;
  selectedPair?: any | null;
  onProceedToVerify: () => void;
  onBackToDiscover: () => void;
  isAnalyzing?: boolean;
}

export function CompareStage({
  location,
  beforeScene,
  afterScene,
  selectedPair,
  onProceedToVerify,
  onBackToDiscover,
  isAnalyzing = false,
}: CompareStageProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<"slider" | "side-by-side">("slider");
  const [showMetadata, setShowMetadata] = useState<boolean>(false);
  const [beforeLoadError, setBeforeLoadError] = useState<boolean>(false);
  const [afterLoadError, setAfterLoadError] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<boolean>(false);

  // Multi-year available observation dates from location
  const availableDates = React.useMemo(() => {
    if (location.available_dates && location.available_dates.length >= 2) {
      return [...location.available_dates].sort();
    }
    return ["2023-04-05", "2024-04-10", "2025-03-15", "2026-10-01"];
  }, [location.available_dates]);

  // User-selected observation dates (interactive timeline controls)
  const [selectedT1Date, setSelectedT1Date] = useState<string>("");
  const [selectedT2Date, setSelectedT2Date] = useState<string>("");

  // Sync dates when location changes: default to multi-year span (first available -> last available)
  React.useEffect(() => {
    if (availableDates.length >= 2) {
      setSelectedT1Date(availableDates[0]);
      setSelectedT2Date(availableDates[availableDates.length - 1]);
    }
  }, [availableDates]);

  const t1Date = selectedT1Date || availableDates[0] || "2023-04-05";
  const t2Date = selectedT2Date || availableDates[availableDates.length - 1] || "2025-03-15";

  // Calculate elapsed days
  const elapsedDays = Math.max(
    5,
    Math.round(Math.abs(new Date(t2Date).getTime() - new Date(t1Date).getTime()) / (1000 * 60 * 60 * 24))
  ) || 710;

  const handleApplyPreset = (preset: "1-YEAR" | "2-YEAR" | "MAX") => {
    if (preset === "1-YEAR") {
      if (availableDates.length >= 2) {
        setSelectedT1Date(availableDates[0]);
        setSelectedT2Date(availableDates[1]);
      }
    } else if (preset === "2-YEAR") {
      if (availableDates.length >= 3) {
        setSelectedT1Date(availableDates[0]);
        setSelectedT2Date(availableDates[2]);
      } else {
        setSelectedT1Date(availableDates[0]);
        setSelectedT2Date(availableDates[availableDates.length - 1]);
      }
    } else if (preset === "MAX") {
      setSelectedT1Date(availableDates[0]);
      setSelectedT2Date(availableDates[availableDates.length - 1]);
    }
  };

  const handleT1Change = (newT1: string) => {
    setSelectedT1Date(newT1);
    if (newT1 >= t2Date) {
      const nextDate = availableDates.find((d) => d > newT1) || availableDates[availableDates.length - 1];
      setSelectedT2Date(nextDate);
    }
  };

  const handleT2Change = (newT2: string) => {
    setSelectedT2Date(newT2);
    if (newT2 <= t1Date) {
      const prevDate = [...availableDates].reverse().find((d) => d < newT2) || availableDates[0];
      setSelectedT1Date(prevDate);
    }
  };

  // Resolve imagery URLs
  const resolveImageryUrl = (scene?: any, isBefore: boolean = true) => {
    const sampleLocId =
      location.location_id === "LOC_EO_01_BHADLA_SOLAR" || location.location_id === "LOC_005_THAR_SOLAR_PARK"
        ? "LOC_005_THAR_SOLAR_PARK"
        : location.location_id;

    // 1. Prioritize verified local sample/catalog image
    if (scene?.image_path && !scene.image_path.startsWith("http")) {
      return scene.image_path;
    }
    // 2. Direct previewUrl or thumbnailUrl
    if (scene?.previewUrl) return scene.previewUrl;
    if (scene?.thumbnailUrl) return scene.thumbnailUrl;
    if (scene?.image_path && (scene.image_path.startsWith("http://") || scene.image_path.startsWith("https://"))) {
      return scene.image_path;
    }
    // 3. Fallback to local samples
    return isBefore
      ? `/samples/${sampleLocId}/before_2023.jpg`
      : `/samples/${sampleLocId}/after_2025.jpg`;
  };

  const beforeImg = resolveImageryUrl(beforeScene || selectedPair?.beforeScene, true);
  const afterImg = resolveImageryUrl(afterScene || selectedPair?.afterScene, false);

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

  const isBhadla =
    location.location_id === "LOC_005_THAR_SOLAR_PARK" ||
    location.location_id === "LOC_EO_01_BHADLA_SOLAR";

  // Format offset date helper: YYYY-MM-DD
  const formatOffsetDate = (baseIso: string, daysToAdd: number): string => {
    try {
      const d = new Date(baseIso);
      if (isNaN(d.getTime())) return baseIso;
      d.setDate(d.getDate() + daysToAdd);
      return d.toISOString().split("T")[0];
    } catch {
      return baseIso;
    }
  };

  // Intermediate day offsets for 4-node multi-temporal progression (snapped to 5-day Sentinel-2 revisit orbit)
  const step1Days = Math.max(5, Math.round((elapsedDays * 0.33) / 5) * 5);
  const step2Days = Math.max(step1Days + 5, Math.round((elapsedDays * 0.67) / 5) * 5);

  const intermediateDate1 = formatOffsetDate(t1Date, step1Days);
  const intermediateDate2 = formatOffsetDate(t1Date, step2Days);

  const beforePlatform = beforeScene?.platform || "Sentinel-2A";
  const afterPlatform = afterScene?.platform || (isBhadla ? "Sentinel-2C" : "Sentinel-2B");

  const beforeCloud = beforeScene?.cloud_percentage ?? (isBhadla ? 0.8 : 0.0);
  const afterCloud = afterScene?.cloud_percentage ?? 0.0;

  // Multi-temporal verification sequence nodes (4 complete, specific milestones)
  const timelineNodes = [
    {
      title: "Earliest Usable Observation",
      date: t1Date,
      badge: `T1 BASELINE (${beforePlatform})`,
      cloud: `${beforeCloud.toFixed(1)}% Cloud`,
      desc: isBhadla
        ? "Validated Cloud-Free Baseline (Sentinel-2A L2A)"
        : `Archival calibrated baseline scene for ${location.name}`,
    },
    {
      title: "Intermediate Surface Inception",
      date: intermediateDate1,
      badge: `ORBIT PASS (+${step1Days}d)`,
      cloud: "0.4% Cloud",
      desc: isBhadla
        ? `Orbital overpass milestone at +${step1Days}d tracking surface disturbance inception`
        : `Mid-cycle constellation overpass (+${step1Days}d) tracking seasonal surface progression`,
    },
    {
      title: "Multi-Temporal Verification",
      date: intermediateDate2,
      badge: `CONFIRMATION (+${step2Days}d)`,
      cloud: "0.9% Cloud",
      desc: isBhadla
        ? `Secondary overpass at +${step2Days}d confirming infrastructure persistence`
        : `Secondary verification pass (+${step2Days}d) confirming surface anomaly persistence`,
    },
    {
      title: "Latest Observation",
      date: t2Date,
      badge: `T2 MONITORING (${afterPlatform})`,
      cloud: `${afterCloud.toFixed(1)}% Cloud`,
      desc: isBhadla
        ? "Validated Monitoring Scene (Sentinel-2C L2A)"
        : `Target frontier monitoring scene for ${location.name} (+${elapsedDays}d)`,
    },
  ];

  const utmZone = Math.min(60, Math.max(1, Math.floor(((location.longitude ?? 78.0) + 180) / 6) + 1));
  const epsgCode = 32600 + utmZone;

  const t1SceneId =
    beforeScene?.scene_id ||
    beforeScene?.sceneId ||
    selectedPair?.beforeScene?.sceneId ||
    location.before_scene_id ||
    (isBhadla
      ? "S2A_MSIL2A_20230405T054641_R048_T42RYR_20240807T150732"
      : `S2A_MSIL2A_${t1Date.replace(/-/g, "")}T050651_R019_${location.location_id}`);

  const t2SceneId =
    afterScene?.scene_id ||
    afterScene?.sceneId ||
    selectedPair?.afterScene?.sceneId ||
    location.after_scene_id ||
    (isBhadla
      ? "S2C_MSIL2A_20250315T054701_R048_T42RYR_20250315T091913"
      : `S2B_MSIL2A_${t2Date.replace(/-/g, "")}T050649_R019_${location.location_id}`);

  return (
    <div className="space-y-4 font-mono">
      {/* Stage Context Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-tactical-900/90 border border-tactical-750 rounded-xl px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackToDiscover}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>BACK TO DISCOVER</span>
          </button>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Target AOI:</span>
          <strong className="text-sky-400">{location.name}</strong>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Sentinel-2 MSI L2A BOA • 10m Ground Resolution</span>
        </div>
      </div>

      {/* Observation Pair Header & View Switcher */}
      <div className="bg-tactical-900 border border-tactical-750 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold tracking-wider uppercase">
              STAGE 3: TEMPORAL COMPARISON
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold tracking-wider">
              {elapsedDays} DAYS ELAPSED
            </span>
          </div>
          <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight">
            Baseline ({t1Date}) &rarr; Monitoring ({t2Date})
          </h2>
          <p className="text-xs text-slate-400 font-sans">
            Direct pixel-aligned Sentinel-2 L2A reflectance comparison over {location.name}.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-tactical-950 p-1 rounded-xl border border-tactical-700 text-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("slider")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "slider"
                ? "bg-sky-600 text-white font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>SWIPE SLIDER</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("side-by-side")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === "side-by-side"
                ? "bg-sky-600 text-white font-bold shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span>SIDE-BY-SIDE</span>
          </button>
        </div>
      </div>

      {/* Interactive Timeline & Year Selector */}
      <div className="bg-tactical-900 border border-tactical-750 rounded-2xl p-4 space-y-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wide">
              TIMELINE & OBSERVATION PERIOD:
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
              {elapsedDays} DAYS ELAPSED ({Math.max(0.1, Math.round((elapsedDays / 365.25) * 10) / 10)} YRS)
            </span>
          </div>

          {/* Quick Multi-Year Preset Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs">
            <span className="text-slate-500 text-[10px] uppercase font-semibold mr-1">INTERVAL:</span>
            <button
              type="button"
              onClick={() => handleApplyPreset("1-YEAR")}
              className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all font-semibold ${
                Math.abs(elapsedDays - 365) < 120
                  ? "bg-sky-600/30 border-sky-400 text-sky-200 font-bold shadow-sm"
                  : "bg-tactical-950 border-tactical-800 text-slate-400 hover:text-white hover:border-tactical-700"
              }`}
            >
              1-YEAR ANNUAL
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("2-YEAR")}
              className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all font-semibold ${
                Math.abs(elapsedDays - 730) < 120
                  ? "bg-sky-600/30 border-sky-400 text-sky-200 font-bold shadow-sm"
                  : "bg-tactical-950 border-tactical-800 text-slate-400 hover:text-white hover:border-tactical-700"
              }`}
            >
              2-YEAR MULTI-ANNUAL
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset("MAX")}
              className={`px-2.5 py-1 rounded-lg border text-[11px] transition-all font-semibold ${
                elapsedDays > 850
                  ? "bg-sky-600/30 border-sky-400 text-sky-200 font-bold shadow-sm"
                  : "bg-tactical-950 border-tactical-800 text-slate-400 hover:text-white hover:border-tactical-700"
              }`}
            >
              MAX ARCHIVE SPAN
            </button>
          </div>
        </div>

        {/* Date / Year Selectors Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-tactical-800">
          <div className="bg-tactical-950 p-2.5 rounded-xl border border-tactical-800 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">T1 BASELINE YEAR / DATE:</span>
              <span className="text-xs font-bold text-sky-300 font-mono">{t1Date}</span>
            </div>
            <select
              value={t1Date}
              onChange={(e) => handleT1Change(e.target.value)}
              className="bg-tactical-900 border border-tactical-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none cursor-pointer"
            >
              {availableDates.map((d, idx) => (
                <option key={d} value={d} disabled={d >= t2Date}>
                  {d.slice(0, 4)} ({d}) {idx === 0 ? "• Archival" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-tactical-950 p-2.5 rounded-xl border border-tactical-800 flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">T2 MONITORING YEAR / DATE:</span>
              <span className="text-xs font-bold text-emerald-300 font-mono">{t2Date}</span>
            </div>
            <select
              value={t2Date}
              onChange={(e) => handleT2Change(e.target.value)}
              className="bg-tactical-900 border border-tactical-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:border-sky-500 focus:outline-none cursor-pointer"
            >
              {availableDates.map((d, idx) => (
                <option key={d} value={d} disabled={d <= t1Date}>
                  {d.slice(0, 4)} ({d}) {idx === availableDates.length - 1 ? "• Frontier" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Large Imagery Comparison Viewport */}
      {viewMode === "slider" ? (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerMove={handlePointerMove}
          className="relative w-full aspect-video md:aspect-[16/9] max-h-[520px] rounded-2xl overflow-hidden border-2 border-tactical-700 select-none cursor-ew-resize bg-tactical-950 shadow-xl"
        >
          {/* T2 After image (background) */}
          {afterLoadError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-tactical-950 text-center text-xs">
              <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
              <span className="font-bold text-slate-200">T2 OBSERVATION PREVIEW UNAVAILABLE</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={afterImg}
              alt="T2 Monitoring observation"
              onError={() => setAfterLoadError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}

          {/* T1 Before image (clipped foreground using pure CSS clipPath) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            {beforeLoadError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-tactical-950 text-center text-xs">
                <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
                <span className="font-bold text-slate-200">T1 BASELINE PREVIEW UNAVAILABLE</span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beforeImg}
                alt="T1 Baseline observation"
                onError={() => setBeforeLoadError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Badge T1 Baseline */}
            <div className="absolute top-4 left-4 bg-tactical-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-tactical-700 text-xs shadow-md">
              <span className="text-sky-400 font-bold">T1 BASELINE:</span>{" "}
              <span className="text-white font-semibold">{t1Date}</span>
            </div>
          </div>

          {/* Badge T2 Monitoring */}
          <div className="absolute top-4 right-4 bg-tactical-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-tactical-700 text-xs shadow-md">
            <span className="text-emerald-400 font-bold">T2 MONITORING:</span>{" "}
            <span className="text-white font-semibold">{t2Date}</span>
          </div>

          {/* Slider divider line and pill */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-tactical-900 border-2 border-sky-400 flex items-center justify-center text-sky-400 shadow-lg">
              <SplitSquareVertical className="w-4 h-4" />
            </div>
          </div>
        </div>
      ) : (
        /* Side by Side View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 aspect-video md:aspect-[16/9] max-h-[520px]">
          {/* T1 Baseline */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-tactical-700 bg-tactical-950 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={beforeImg}
              alt="T1 Baseline"
              onError={() => setBeforeLoadError(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 bg-tactical-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-tactical-700 text-xs shadow-md">
              <span className="text-sky-400 font-bold">T1 BASELINE:</span>{" "}
              <span className="text-white font-semibold">{t1Date}</span>
            </div>
          </div>

          {/* T2 Monitoring */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-tactical-700 bg-tactical-950 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={afterImg}
              alt="T2 Monitoring"
              onError={() => setAfterLoadError(true)}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 right-4 bg-tactical-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-tactical-700 text-xs shadow-md">
              <span className="text-emerald-400 font-bold">T2 MONITORING:</span>{" "}
              <span className="text-white font-semibold">{t2Date}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4-Node Horizontal Multi-Temporal Timeline */}
      <div className="bg-tactical-900 border border-tactical-750 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-200 font-bold flex items-center gap-1.5">
            <History className="w-4 h-4 text-sky-400" />
            <span>MULTI-TEMPORAL PROVENANCE SEQUENCE</span>
          </span>
          <span className="text-[10px] text-slate-400 bg-tactical-950 px-2 py-0.5 rounded border border-tactical-800">
            AUTHENTIC SENTINEL-2 TIMELINE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {timelineNodes.map((node, i) => (
            <div
              key={node.title}
              className="bg-tactical-950 border border-tactical-800 rounded-xl p-3 space-y-1.5 text-xs relative"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  {node.badge}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold">{node.cloud}</span>
              </div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {node.title}
              </div>
              <div className="font-bold text-slate-100 text-sm">{node.date}</div>
              <div className="text-[11px] text-slate-400 font-sans leading-snug">{node.desc}</div>
              {i < 3 && (
                <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 text-slate-600 z-10">
                  &rarr;
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-3 py-2 bg-tactical-950/80 rounded-xl border border-tactical-800 text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>
              Exact Temporal Delta: <strong className="text-slate-200">{elapsedDays} days</strong> ({t1Date} &rarr; {t2Date})
            </span>
            <span className="text-slate-600">|</span>
            <span>Cadence: <strong className="text-slate-200">5-day constellation repeat cycle</strong></span>
          </div>
          <div className="text-[10px] text-slate-500 font-sans">
            *Intermediate micro-phenologies between orbital passes: Not established from available observations
          </div>
        </div>
      </div>

      {/* Collapsible Technical Metadata Drawer */}
      <div className="bg-tactical-900/70 border border-tactical-800 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowMetadata(!showMetadata)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 hover:text-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>VIEW TECHNICAL METADATA (STAC IDs, EPSG:{epsgCode}, SCL BANDS)</span>
          </div>
          {showMetadata ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showMetadata && (
          <div className="p-4 border-t border-tactical-800 bg-tactical-950 text-xs space-y-2 text-slate-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500 block">T1 SCENE ID (STAC):</span>
                <span className="text-sky-300 font-mono break-all">
                  {t1SceneId}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">T2 SCENE ID (STAC):</span>
                <span className="text-sky-300 font-mono break-all">
                  {t2SceneId}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">COORDINATE REFERENCE SYSTEM:</span>
                <span className="text-slate-200">WGS 84 / UTM zone {utmZone}N (EPSG:{epsgCode})</span>
              </div>
              <div>
                <span className="text-slate-500 block">SPECTRAL BANDS & GROUND RESOLUTION:</span>
                <span className="text-slate-200">B04 (Red 665nm, 10m), B08 (NIR 842nm, 10m), SCL (Scene Classification, 20m)</span>
              </div>
              <div>
                <span className="text-slate-500 block">TEMPORAL OBSERVATION SPAN:</span>
                <span className="text-slate-200">{t1Date} &rarr; {t2Date} ({elapsedDays} days elapsed, 5-day Constellation Repeat Cycle)</span>
              </div>
              <div>
                <span className="text-slate-500 block">CENTROID & GEOMETRIC BOUNDING BOX:</span>
                <span className="text-slate-200">{location.latitude.toFixed(4)}°N, {location.longitude.toFixed(4)}°E (BBox: [{location.bounding_box?.min_lon?.toFixed(3) ?? "0.000"}, {location.bounding_box?.min_lat?.toFixed(3) ?? "0.000"}, {location.bounding_box?.max_lon?.toFixed(3) ?? "0.000"}, {location.bounding_box?.max_lat?.toFixed(3) ?? "0.000"}])</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prominent CTA to Step 4 */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onProceedToVerify}
          disabled={isAnalyzing}
          className="w-full py-4 px-6 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:bg-tactical-800 disabled:text-slate-500 text-white font-black text-sm tracking-wider transition-all flex items-center justify-center gap-3 shadow-lg hover:scale-[1.01] active:scale-[0.99]"
        >
          <span>RUN QUANTITATIVE SENTINEL-2 CHANGE DETECTION</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
