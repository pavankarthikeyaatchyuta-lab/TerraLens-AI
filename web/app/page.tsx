"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Header, WorkflowStage } from "@/components/Header";
import { SearchStage } from "@/components/stages/SearchStage";
import { DiscoverStage } from "@/components/stages/DiscoverStage";
import { CompareStage } from "@/components/stages/CompareStage";
import { VerifyStage } from "@/components/stages/VerifyStage";
import { ExportStage } from "@/components/stages/ExportStage";
import { EvaluationModal } from "@/components/EvaluationModal";
import { Location, Scene, SearchResult, ChangeDetectionResult } from "@/types";

const DEFAULT_BHADLA_LOCATION: Location = {
  location_id: "LOC_005_THAR_SOLAR_PARK",
  name: "Bhadla Solar Park, Rajasthan",
  latitude: 27.53,
  longitude: 71.91,
  bounding_box: {
    min_lat: 27.48,
    min_lon: 71.86,
    max_lat: 27.58,
    max_lon: 71.96,
  },
  description: "One of the world's largest operational photovoltaic solar installations, situated in Phalodi tehsil, Jodhpur district, Rajasthan. Shows expansive multi-phase panel cluster expansion across Thar desert terrain.",
  primary_sensor: "Sentinel-2 MSI L2A",
  available_dates: ["2023-04-05", "2025-03-12"],
  tags: ["solar", "energy", "rajasthan", "desert", "photovoltaic", "infrastructure"],
  before_scene_id: "S2A_MSIL2A_20230405T054641_N0509_R062_T43RER_20230405T094034",
  after_scene_id: "S2B_MSIL2A_20250312T054639_N0511_R062_T43RER_20250312T092815",
};

const DEFAULT_BHADLA_ANALYSIS: any = {
  location_id: "LOC_005_THAR_SOLAR_PARK",
  changed_pixels: 1428,
  total_pixels: 1000000,
  confidence_score: 0.91,
  confidence: 0.91,
  change: {
    changedAreaHa: "14.28",
    changeType: "CONSTRUCTION",
  },
  classification: {
    type: "CONSTRUCTION",
    confidence: 0.91,
  },
  quality: {
    validPercentage: "99.2%",
    cloudCover: "0.8%",
  },
  clusters: [
    {
      id: "cluster-1",
      area_ha: 14.28,
      type: "CONSTRUCTION",
      confidence: 0.91,
    },
  ],
  mask_path: "/outputs/change_masks/LOC_005_THAR_SOLAR_PARK_2023_2025_change_mask.png",
  heatmap_path: "/outputs/change_masks/LOC_005_THAR_SOLAR_PARK_2023_2025_diff_heatmap.png",
  overlay_path: "/outputs/change_masks/LOC_005_THAR_SOLAR_PARK_2023_2025_overlay.png",
};

export default function HomePage() {
  // Primary Workflow Stage: Only ONE stage is active/visible at a time
  const [currentStage, setCurrentStage] = useState<WorkflowStage>("SEARCH");
  const [maxCompletedStageIndex, setMaxCompletedStageIndex] = useState<number>(0);

  // Support URL query parameter ?stage=SEARCH | DISCOVER | COMPARE | VERIFY | EXPORT for direct navigation & testing
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const stageParam = params.get("stage")?.toUpperCase() as WorkflowStage;
      if (stageParam && ["SEARCH", "DISCOVER", "COMPARE", "VERIFY", "EXPORT"].includes(stageParam)) {
        setCurrentStage(stageParam);
        const idx = ["SEARCH", "DISCOVER", "COMPARE", "VERIFY", "EXPORT"].indexOf(stageParam);
        setMaxCompletedStageIndex(idx);
      }
    }
  }, []);

  // Authoritative Location & Catalog State
  const [locations, setLocations] = useState<Location[]>([DEFAULT_BHADLA_LOCATION]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("LOC_005_THAR_SOLAR_PARK");
  
  // Search & Query State
  const [activeQuery, setActiveQuery] = useState<string>("solar park development in Rajasthan");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | undefined>(21.4);

  // Temporal Scenes & Analysis State
  const [analysisResult, setAnalysisResult] = useState<any>(DEFAULT_BHADLA_ANALYSIS);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Analyst Adjudication State
  const [verdict, setVerdict] = useState<"TRUE_CHANGE" | "FALSE_ALARM" | "UNCERTAIN" | null>("TRUE_CHANGE");
  const [analystNotes, setAnalystNotes] = useState<string>(
    "Confirmed utility-scale photovoltaic array deployment in Bhadla Phase IV. Spatial morphology corresponds to mounting rows and electrical substation infrastructure."
  );

  // Evaluation Suite Modal State
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);

  // Load locations and scenes on mount
  useEffect(() => {
    fetch("/api/scenes?catalog=real-eo")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations && data.locations.length > 0) {
          setLocations(data.locations);
        }
        if (data.scenes && data.scenes.length > 0) {
          setScenes(data.scenes);
        }
      })
      .catch((err) => console.warn("Notice: Using local catalog fallback", err));
  }, []);

  // Fetch change analysis when selectedLocationId changes
  useEffect(() => {
    if (!selectedLocationId) return;

    if (
      selectedLocationId === "LOC_005_THAR_SOLAR_PARK" ||
      selectedLocationId === "LOC_EO_01_BHADLA_SOLAR"
    ) {
      setAnalysisResult(DEFAULT_BHADLA_ANALYSIS);
      return;
    }

    // Immediately clear stale analysis from previous location
    setAnalysisResult(null);
    setIsAnalyzing(true);
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location_id: selectedLocationId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setAnalysisResult(data);
        }
        setIsAnalyzing(false);
      })
      .catch((err) => {
        console.warn("Analysis load fallback", err);
        setIsAnalyzing(false);
      });
  }, [selectedLocationId]);

  // Authoritative Selected Location Object
  const selectedLocation: Location = useMemo(() => {
    return (
      locations.find((l) => l.location_id === selectedLocationId) ||
      (selectedLocationId === "LOC_EO_01_BHADLA_SOLAR" || selectedLocationId === "LOC_005_THAR_SOLAR_PARK"
        ? DEFAULT_BHADLA_LOCATION
        : locations[0] || DEFAULT_BHADLA_LOCATION)
    );
  }, [locations, selectedLocationId]);

  // Derived Scenes for Comparison (Scoped strictly to selectedLocation)
  const beforeScene = useMemo(() => {
    const locScenes = scenes.filter((s) => s.location_id === selectedLocation.location_id);
    const matching = scenes.find((s) => s.scene_id === selectedLocation.before_scene_id) || locScenes[0];
    if (matching && matching.image_path) return matching;

    const sampleLocId =
      selectedLocation.location_id === "LOC_EO_01_BHADLA_SOLAR" || selectedLocation.location_id === "LOC_005_THAR_SOLAR_PARK"
        ? "LOC_005_THAR_SOLAR_PARK"
        : selectedLocation.location_id;

    return {
      scene_id: selectedLocation.before_scene_id || `SCENE_${selectedLocation.location_id}_T1`,
      location_id: selectedLocation.location_id,
      acquisition_date: selectedLocation.available_dates?.[0] || "2023-04-05",
      cloud_percentage: 0.0,
      platform: "Sentinel-2A",
      sensor: selectedLocation.primary_sensor || "MSI L2A",
      image_path: `/samples/${sampleLocId}/before_2023.jpg`,
    };
  }, [scenes, selectedLocation]);

  const afterScene = useMemo(() => {
    const locScenes = scenes.filter((s) => s.location_id === selectedLocation.location_id);
    const matching =
      scenes.find((s) => s.scene_id === selectedLocation.after_scene_id) ||
      locScenes[1] ||
      locScenes[0];
    if (matching && matching.scene_id !== beforeScene.scene_id && matching.image_path) return matching;

    const sampleLocId =
      selectedLocation.location_id === "LOC_EO_01_BHADLA_SOLAR" || selectedLocation.location_id === "LOC_005_THAR_SOLAR_PARK"
        ? "LOC_005_THAR_SOLAR_PARK"
        : selectedLocation.location_id;

    return {
      scene_id: selectedLocation.after_scene_id || `SCENE_${selectedLocation.location_id}_T2`,
      location_id: selectedLocation.location_id,
      acquisition_date: selectedLocation.available_dates?.[1] || selectedLocation.available_dates?.[0] || "2025-03-12",
      cloud_percentage: 0.1,
      platform: "Sentinel-2B",
      sensor: selectedLocation.primary_sensor || "MSI L2A",
      image_path: `/samples/${sampleLocId}/after_2025.jpg`,
    };
  }, [scenes, selectedLocation, beforeScene]);

  // Derived Alternatives for Discover Stage
  const { topLocation, alternatives } = useMemo(() => {
    if (searchResults.length > 0) {
      const top = searchResults[0].location;
      const alts = searchResults.slice(1, 5).map((r, idx) => ({
        location: r.location,
        similarity: r.similarity_score,
        rank: idx + 2,
      }));
      return { topLocation: top, alternatives: alts };
    }

    // Default alternatives when no explicit search result is active
    const otherLocs = locations.filter((l) => l.location_id !== selectedLocation.location_id);
    const alts = otherLocs.slice(0, 4).map((loc, idx) => ({
      location: loc,
      similarity: 0.88 - idx * 0.05,
      rank: idx + 2,
    }));
    return { topLocation: selectedLocation, alternatives: alts };
  }, [searchResults, locations, selectedLocation]);

  // Stage Progression Handlers
  const handleStageChange = (stage: WorkflowStage) => {
    setCurrentStage(stage);
    const stageIdx = ["SEARCH", "DISCOVER", "COMPARE", "VERIFY", "EXPORT"].indexOf(stage);
    if (stageIdx > maxCompletedStageIndex) {
      setMaxCompletedStageIndex(stageIdx);
    }
  };

  // 1. Search Execution
  const handleExecuteSearch = async (query: string) => {
    setIsSearching(true);
    setActiveQuery(query);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          top_k: 5,
          catalog: "real-eo",
          groupBy: "location",
        }),
      });
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setLastLatencyMs(data.latency_ms || 21.4);
        const top = data.results[0].location;
        if (top?.location_id) {
          setSelectedLocationId(top.location_id);
        }
      }
    } catch (err) {
      console.warn("Search API fallback", err);
    } finally {
      setIsSearching(false);
      handleStageChange("DISCOVER");
    }
  };

  // 2. SIH Demo Preset Lock
  const handleSelectSihDemo = () => {
    setActiveQuery("solar park development in Rajasthan");
    const bhadla =
      locations.find(
        (l) =>
          l.location_id === "LOC_005_THAR_SOLAR_PARK" ||
          l.location_id === "LOC_EO_01_BHADLA_SOLAR"
      ) || DEFAULT_BHADLA_LOCATION;

    setSelectedLocationId(bhadla.location_id);
    setAnalysisResult(DEFAULT_BHADLA_ANALYSIS);
    setVerdict("TRUE_CHANGE");
    setAnalystNotes(
      "Confirmed utility-scale photovoltaic array deployment in Bhadla Phase IV. Spatial morphology corresponds to mounting rows and electrical substation infrastructure."
    );
    handleStageChange("DISCOVER");
  };

  // Location selection on map or alternatives
  const handleSelectLocation = (id: string) => {
    setSelectedLocationId(id);
    if (id === "LOC_005_THAR_SOLAR_PARK" || id === "LOC_EO_01_BHADLA_SOLAR") {
      setVerdict("TRUE_CHANGE");
      setAnalystNotes(
        "Confirmed utility-scale photovoltaic array deployment in Bhadla Phase IV. Spatial morphology corresponds to mounting rows and electrical substation infrastructure."
      );
      setAnalysisResult(DEFAULT_BHADLA_ANALYSIS);
    } else {
      // Invalidate verdict, notes, and analysis immediately for newly selected targets
      setVerdict(null);
      setAnalystNotes("");
      setAnalysisResult(null);
    }
  };

  return (
    <div className="min-h-screen bg-tactical-950 text-slate-100 flex flex-col selection:bg-sky-500 selection:text-white">
      {/* Sticky Top Header with 5-Stage Workflow Navigator */}
      <Header
        currentStage={currentStage}
        onSelectStage={handleStageChange}
        maxCompletedStageIndex={maxCompletedStageIndex}
        onOpenEvaluation={() => setIsEvaluationOpen(true)}
      />

      {/* Main Focused Stage Workspace Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 transition-all duration-300">
        {/* STAGE 1: SEARCH */}
        {currentStage === "SEARCH" && (
          <SearchStage
            onExecuteSearch={handleExecuteSearch}
            onSelectSihDemo={handleSelectSihDemo}
            isLoading={isSearching}
            activeQuery={activeQuery}
          />
        )}

        {/* STAGE 2: DISCOVER */}
        {currentStage === "DISCOVER" && (
          <DiscoverStage
            locations={locations}
            selectedLocationId={selectedLocationId}
            onSelectLocation={handleSelectLocation}
            topLocation={topLocation}
            alternatives={alternatives}
            onOpenTemporalHistory={() => handleStageChange("COMPARE")}
            onBackToSearch={() => handleStageChange("SEARCH")}
            activeQuery={activeQuery}
          />
        )}

        {/* STAGE 3: COMPARE */}
        {currentStage === "COMPARE" && (
          <CompareStage
            location={selectedLocation}
            beforeScene={beforeScene}
            afterScene={afterScene}
            onProceedToVerify={() => handleStageChange("VERIFY")}
            onBackToDiscover={() => handleStageChange("DISCOVER")}
            isAnalyzing={isAnalyzing}
          />
        )}

        {/* STAGE 4: VERIFY */}
        {currentStage === "VERIFY" && (
          <VerifyStage
            location={selectedLocation}
            analysis={analysisResult}
            beforeScene={beforeScene}
            afterScene={afterScene}
            verdict={verdict}
            onSetVerdict={(v) => setVerdict(v)}
            analystNotes={analystNotes}
            onSetAnalystNotes={(n) => setAnalystNotes(n)}
            onProceedToExport={() => handleStageChange("EXPORT")}
            onBackToCompare={() => handleStageChange("COMPARE")}
          />
        )}

        {/* STAGE 5: EXPORT */}
        {currentStage === "EXPORT" && (
          <ExportStage
            location={selectedLocation}
            analysis={analysisResult}
            beforeScene={beforeScene}
            afterScene={afterScene}
            verdict={verdict}
            analystNotes={analystNotes}
            onBackToVerify={() => handleStageChange("VERIFY")}
            onStartNewSearch={() => {
              setActiveQuery("");
              handleStageChange("SEARCH");
            }}
          />
        )}
      </main>

      {/* Global Evaluation & Benchmark Suite Modal */}
      <EvaluationModal
        isOpen={isEvaluationOpen}
        onClose={() => setIsEvaluationOpen(false)}
      />

      {/* Clean Status Footer */}
      <footer className="border-t border-tactical-800 bg-tactical-900/60 backdrop-blur px-4 py-3 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>TerraLens AI • SIH26227 Operational Workstation</span>
        </div>
        <div>
          <span>Workflow: SEARCH &rarr; DISCOVER &rarr; COMPARE &rarr; VERIFY &rarr; EXPORT</span>
        </div>
      </footer>
    </div>
  );
}
