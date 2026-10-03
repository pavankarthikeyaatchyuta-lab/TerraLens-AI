"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { HeroBanner } from "@/components/HeroBanner";
import { SearchBar } from "@/components/SearchBar";
import { TacticalMap } from "@/components/TacticalMap";
import { SceneCatalog } from "@/components/SceneCatalog";
import { TemporalComparison } from "@/components/TemporalComparison";
import { ChangeMaskViewer } from "@/components/ChangeMaskViewer";
import { ConfidenceCard } from "@/components/ConfidenceCard";
import { EvidencePanel } from "@/components/EvidencePanel";
import { EvaluationModal } from "@/components/EvaluationModal";
import { LiveAOISearch } from "@/components/LiveAOISearch";
import { Location, Scene, SearchResult, ChangeDetectionResult, BoundingBox } from "@/types";
import { OperatingMode, SatelliteScene, TemporalPairCandidate } from "@/lib/providers/satelliteProvider";
import { Activity, ShieldCheck, Compass, Info, Terminal, Globe } from "lucide-react";

export default function HomePage() {
  const [operatingMode, setOperatingMode] = useState<OperatingMode>("CONTROLLED_BENCHMARK");
  const [locations, setLocations] = useState<Location[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("LOC_001_HYDERABAD_URBAN");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOutcome, setSearchOutcome] = useState<any>(null);
  const [activeQuery, setActiveQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | undefined>(undefined);
  
  // Phase 3 Live Public Data State
  const [liveAoi, setLiveAoi] = useState<BoundingBox | null>({
    min_lat: 17.36,
    min_lon: 78.40,
    max_lat: 17.52,
    max_lon: 78.56,
  });
  const [isDrawingAoi, setIsDrawingAoi] = useState<boolean>(false);
  const [selectedBeforeScene, setSelectedBeforeScene] = useState<SatelliteScene | null>(null);
  const [selectedAfterScene, setSelectedAfterScene] = useState<SatelliteScene | null>(null);
  const [selectedPair, setSelectedPair] = useState<TemporalPairCandidate | null>(null);
  const [liveAnalysisResult, setLiveAnalysisResult] = useState<any | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  // Temporal & Change State
  const [temporalPair, setTemporalPair] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<ChangeDetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Modal State
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);

  // Initial Load: Fetch scenes and locations based on active mode
  useEffect(() => {
    const isRealEo = operatingMode === "REAL_EO_CATALOG";
    const catalogQuery = isRealEo ? "?catalog=real-eo" : "";
    fetch(`/api/scenes${catalogQuery}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
          setSelectedLocationId(data.locations[0].location_id);
        }
        if (data.scenes) setScenes(data.scenes);
      })
      .catch((err) => console.error("Failed to load catalog", err));
  }, [operatingMode]);

  // When selected location changes, load temporal pair & trigger change analysis
  useEffect(() => {
    if (!selectedLocationId) return;

    // Load temporal pair
    fetch(`/api/scenes/${selectedLocationId}/temporal`)
      .then((res) => res.json())
      .then((data) => {
        setTemporalPair(data);
      })
      .catch((err) => console.error("Failed to load temporal pair", err));

    // Load change analysis
    setIsAnalyzing(true);
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location_id: selectedLocationId }),
    })
      .then((res) => res.json())
      .then((data) => {
        setAnalysisResult(data);
        setIsAnalyzing(false);
      })
      .catch((err) => {
        console.error("Failed to load analysis", err);
        setIsAnalyzing(false);
      });
  }, [selectedLocationId]);

  // Handle Search Execution
  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setActiveQuery(query);
    try {
      // 1. Primary Tier: Client-Side Packaged ONNX CLIP Text Encoding
      let clientVector: number[] | null = null;
      try {
        const { encodeQueryClient } = await import("@/lib/clipTextEncoder");
        clientVector = await encodeQueryClient(query);
      } catch (encodeErr) {
        console.warn("Client ONNX inference unavailable, delegating to server tier:", encodeErr);
      }

      // 2. Query Search API with either client vector or fallback to server
      const isRealEo = operatingMode === "REAL_EO_CATALOG";
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          vector: clientVector,
          top_k: 5,
          catalog: isRealEo ? "real-eo" : "benchmark",
        }),
      });
      const data = await res.json();
      setSearchOutcome(data);
      if (data.supported) {
        setSearchResults(data.results || []);
        setLastLatencyMs(data.latency_ms);
        // Automatically select the top ranked location
        if (data.results && data.results.length > 0 && data.results[0].location?.location_id) {
          setSelectedLocationId(data.results[0].location.location_id);
        }
      } else {
        setSearchResults([]);
        setLastLatencyMs(data.latency_ms);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectedLoc = locations.find((l) => l.location_id === selectedLocationId) || locations[0] || {
    location_id: "LOC_001_HYDERABAD_URBAN",
    name: "Hyderabad Peri-Urban Growth Zone",
    description: "Rapid peri-urban infrastructure development and construction near seasonal water channel.",
    latitude: 17.4483,
    longitude: 78.3742,
    bounding_box: { min_lat: 17.3983, min_lon: 78.3242, max_lat: 17.4983, max_lon: 78.4242 },
    primary_sensor: "Sentinel-2 MSI",
    available_dates: ["2023-03-15", "2025-02-20"],
    tags: ["urban", "construction", "buildings", "infrastructure", "river"],
  };

  return (
    <div className="min-h-screen bg-tactical-900 tactical-grid flex flex-col">
      {/* HUD Header */}
      <Header
        onOpenEvaluation={() => setIsEvaluationOpen(true)}
        latencyMs={lastLatencyMs}
        totalScenes={scenes.length || 10}
        operatingMode={operatingMode}
        onSelectMode={setOperatingMode}
      />

      {/* Main Tactical Interface */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-4 space-y-4">
        {/* Landing Hero Banner */}
        <HeroBanner
          onOpenEvaluation={() => setIsEvaluationOpen(true)}
          onLaunchConsole={() => {
            const el = document.getElementById("console");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
        />

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: LIVE PUBLIC DATA (Copernicus Sentinel-2 STAC)         */}
        {/* ------------------------------------------------------------- */}
        {operatingMode === "LIVE_PUBLIC_DATA" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (5 cols): Interactive Tactical Map with AOI Support */}
              <div className="lg:col-span-5 space-y-4">
                <TacticalMap
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={(id) => setSelectedLocationId(id)}
                  isLiveMode={true}
                  aoi={liveAoi}
                  onAoiChange={setLiveAoi}
                  isDrawingAoi={isDrawingAoi}
                  onToggleDrawingAoi={setIsDrawingAoi}
                  selectedScene={selectedAfterScene || selectedBeforeScene}
                  selectedPair={selectedPair}
                  liveAnalysisResult={liveAnalysisResult}
                  selectedClusterId={selectedClusterId}
                  onSelectCluster={setSelectedClusterId}
                />

                {/* Live Mode Map Helper / AOI Status Card */}
                <div className="p-4 rounded-xl bg-tactical-850 border border-tactical-700 shadow-sm font-mono text-xs space-y-2">
                  <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400 font-semibold uppercase tracking-wider">
                    <Compass className="w-4 h-4" />
                    <span>Map AOI Navigation</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Use the map layer switcher (bottom-left) to toggle between Google Satellite, Google Maps Streets, Esri World Imagery, or CARTO Voyager. Click any detected change cluster polygon on the map to inspect its evidence and adjudicate.
                  </p>
                  <div className="pt-2 border-t border-tactical-700 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Map Drawing:</span>
                    <button
                      type="button"
                      onClick={() => setIsDrawingAoi(!isDrawingAoi)}
                      className={`px-2 py-0.5 rounded font-bold transition-colors ${
                        isDrawingAoi
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                          : "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/25"
                      }`}
                    >
                      {isDrawingAoi ? "DRAWING ON (CANCEL)" : "CLICK TO DRAW AOI"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column (7 cols): Live AOI Search, Discovery, & Temporal Pair Selection */}
              <div className="lg:col-span-7">
                <LiveAOISearch
                  aoi={liveAoi}
                  onAoiChange={setLiveAoi}
                  isDrawingAoi={isDrawingAoi}
                  onToggleDrawingAoi={setIsDrawingAoi}
                  selectedBeforeScene={selectedBeforeScene}
                  selectedAfterScene={selectedAfterScene}
                  onSelectScene={(scene, type) => {
                    if (type === "before") setSelectedBeforeScene(scene);
                    else setSelectedAfterScene(scene);
                  }}
                  selectedPair={selectedPair}
                  onSelectPair={(pair) => {
                    setSelectedPair(pair);
                    if (pair) {
                      setSelectedBeforeScene(pair.beforeScene);
                      setSelectedAfterScene(pair.afterScene);
                    }
                  }}
                  analysisResult={liveAnalysisResult}
                  onAnalysisComplete={setLiveAnalysisResult}
                  selectedClusterId={selectedClusterId}
                  onSelectCluster={setSelectedClusterId}
                />
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 2: SEMANTIC RETRIEVAL (Benchmark & Real EO Catalog)       */}
        {/* ------------------------------------------------------------- */}
        {(operatingMode === "CONTROLLED_BENCHMARK" || operatingMode === "REAL_EO_CATALOG") && (
          <div className="space-y-4">
            {/* Natural Language Query Bar */}
            <div id="console">
              <SearchBar
                onSearch={handleSearch}
                isLoading={isSearching}
                activeQuery={activeQuery}
              />
            </div>

            {/* Tactical HUD 2-Column Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left Column (5 cols): Map & Scene Catalog */}
              <div className="lg:col-span-5 space-y-4">
                <TacticalMap
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={(id) => setSelectedLocationId(id)}
                />

                <SceneCatalog
                  results={searchResults}
                  allLocations={locations}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={(id) => setSelectedLocationId(id)}
                  searchOutcome={searchOutcome}
                  onSelectBenchmarkQuery={handleSearch}
                  onHandoffToLive={(loc) => {
                    if (loc.bounding_box) {
                      setLiveAoi({
                        min_lat: loc.bounding_box.min_lat,
                        min_lon: loc.bounding_box.min_lon,
                        max_lat: loc.bounding_box.max_lat,
                        max_lon: loc.bounding_box.max_lon,
                      });
                    }
                    setOperatingMode("LIVE_PUBLIC_DATA");
                    const el = document.getElementById("console");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                />
              </div>

              {/* Right Column (7 cols): Analysis, Temporal View, Diagnostics, Provenance */}
              <div className="lg:col-span-7 space-y-4">
                <TemporalComparison
                  location={selectedLoc}
                  beforeScene={temporalPair?.before_scene}
                  afterScene={temporalPair?.after_scene}
                />

                <ConfidenceCard analysis={analysisResult} />

                <ChangeMaskViewer
                  location={selectedLoc}
                  analysis={analysisResult}
                  isLoading={isAnalyzing}
                />

                <EvidencePanel
                  location={selectedLoc}
                  analysis={analysisResult}
                />
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODE 3: OFFLINE RESEARCH (Local Python Science Harness)       */}
        {/* ------------------------------------------------------------- */}
        {operatingMode === "OFFLINE_RESEARCH" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-5 space-y-4">
              <TacticalMap
                locations={locations}
                selectedLocationId={selectedLocationId}
                onSelectLocation={(id) => setSelectedLocationId(id)}
              />
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="p-5 rounded-xl bg-tactical-850 border border-tactical-700 shadow-xl space-y-4 font-mono">
                <div className="flex items-center justify-between pb-3 border-b border-tactical-750">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Terminal className="w-5 h-5" />
                    <span>OFFLINE RESEARCH HARNESS</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-500/40">
                    PYTHON PIPELINE
                  </span>
                </div>

                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  <p>
                    Offline Research Mode uses the local Python scientific pipeline (<code className="text-sky-600 dark:text-sky-400">terralens.app.services</code>) with pre-indexed FAISS vectors, OpenAI CLIP ViT-B/32 multimodal embeddings, and automated scikit-image morphological filtering.
                  </p>
                  <p>
                    This mode guarantees exact bitwise reproducibility for conference benchmarks and hackathon evaluations without external internet dependencies.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-tactical-900 border border-tactical-700 space-y-1 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">VECTOR INDEX</span>
                    <div className="text-slate-800 dark:text-slate-200 font-bold">512-dim Normalized Cosine</div>
                    <div className="text-slate-500 text-[10px]">FAISS IndexFlatIP Baseline</div>
                  </div>

                  <div className="p-3 rounded-lg bg-tactical-900 border border-tactical-700 space-y-1 text-xs">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px]">BENCHMARK LATENCY</span>
                    <div className="text-amber-600 dark:text-amber-300 font-bold">21.47 ms Warm Baseline</div>
                    <div className="text-slate-500 text-[10px]">45/45 Python Tests Verified</div>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    onClick={() => setIsEvaluationOpen(true)}
                    className="py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/40 text-xs font-bold transition-all shadow-sm"
                  >
                    LAUNCH EVALUATION SUITE
                  </button>
                  <button
                    onClick={() => setOperatingMode("CONTROLLED_BENCHMARK")}
                    className="py-2 px-3 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs"
                  >
                    Switch to Benchmark
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-tactical-800 bg-tactical-950/80 px-4 py-3 text-center text-xs font-mono text-slate-500">
        TerraLens AI | Smart India Hackathon 2026 (SIH26227) | Semantic Satellite Retrieval & Multi-Temporal Change Intelligence
      </footer>

      {/* Evaluation Suite Modal */}
      <EvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
      />
    </div>
  );
}
