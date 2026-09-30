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
import { Location, Scene, SearchResult, ChangeDetectionResult } from "@/types";
import { Activity, ShieldCheck, Compass, Info } from "lucide-react";

export default function HomePage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("LOC_001_HYDERABAD_URBAN");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOutcome, setSearchOutcome] = useState<any>(null);
  const [activeQuery, setActiveQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | undefined>(undefined);
  
  // Temporal & Change State
  const [temporalPair, setTemporalPair] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<ChangeDetectionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  // Modal State
  const [isEvaluationOpen, setIsEvaluationOpen] = useState<boolean>(false);

  // Initial Load: Fetch scenes and locations
  useEffect(() => {
    fetch("/api/scenes")
      .then((res) => res.json())
      .then((data) => {
        if (data.locations) setLocations(data.locations);
        if (data.scenes) setScenes(data.scenes);
      })
      .catch((err) => console.error("Failed to load catalog", err));
  }, []);

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
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, top_k: 5 }),
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
            {/* Interactive Leaflet AOI Map */}
            <TacticalMap
              locations={locations}
              selectedLocationId={selectedLocationId}
              onSelectLocation={(id) => setSelectedLocationId(id)}
            />

            {/* Candidate Locations & Ranked Retrieval Results */}
            <SceneCatalog
              results={searchResults}
              allLocations={locations}
              selectedLocationId={selectedLocationId}
              onSelectLocation={(id) => setSelectedLocationId(id)}
              searchOutcome={searchOutcome}
              onSelectBenchmarkQuery={handleSearch}
            />
          </div>

          {/* Right Column (7 cols): Analysis, Temporal View, Diagnostics, Provenance */}
          <div className="lg:col-span-7 space-y-4">
            {/* Multi-Temporal Imagery Comparison (Swipe Slider) */}
            <TemporalComparison
              location={selectedLoc}
              beforeScene={temporalPair?.before_scene}
              afterScene={temporalPair?.after_scene}
            />

            {/* Confidence & Pixel Telemetry */}
            <ConfidenceCard analysis={analysisResult} />

            {/* Change Mask, Heatmap & Cluster Overlay Viewer */}
            <ChangeMaskViewer
              location={selectedLoc}
              analysis={analysisResult}
              isLoading={isAnalyzing}
            />

            {/* Auditable Provenance & Analyst Review Dossier */}
            <EvidencePanel
              location={selectedLoc}
              analysis={analysisResult}
            />
          </div>
        </div>
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
