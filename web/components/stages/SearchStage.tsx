"use client";

import React, { useState, useRef } from "react";
import {
  Search,
  Loader2,
  ArrowRight,
  Zap,
  Compass,
  Upload,
  Image as ImageIcon,
  Filter,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  MapPin,
  Calendar,
} from "lucide-react";
import { SearchFilters } from "@/types";

export interface SearchStageProps {
  onExecuteSearch: (
    query: string,
    options?: {
      imageFile?: File | null;
      imageSceneId?: string;
      filters?: SearchFilters;
    }
  ) => void;
  onSelectSihDemo: () => void;
  isLoading: boolean;
  activeQuery: string;
}

const PRESET_QUERIES = [
  { label: "Urban Expansion", query: "urban expansion and new construction near river" },
  { label: "Reservoir Drying", query: "water reservoir shoreline drying and lake shrinkage" },
  { label: "Forest Clearance", query: "forest road clearing corridor and tree removal" },
  { label: "Coastal Port", query: "coastal port reclamation and ocean harbor pier" },
];

const CATALOG_REFERENCE_SCENES = [
  {
    sceneId: "SCENE_EO_01_01",
    name: "Bhadla Solar Park Array",
    region: "Rajasthan (Thar Desert)",
    thumbnail: "/samples/LOC_EO_01_BHADLA_SOLAR/after_2025.jpg",
    tags: "Solar Farm · Photovoltaic · Arid",
  },
  {
    sceneId: "SCENE_EO_02_01",
    name: "Pavagada Solar Complex",
    region: "Karnataka (Tumakuru)",
    thumbnail: "/samples/LOC_EO_02_PAVAGADA_SOLAR/after_2025.jpg",
    tags: "Clean Energy · Semi-Arid · Grid",
  },
  {
    sceneId: "SCENE_EO_05_01",
    name: "HITEC City & Gachibowli",
    region: "Telangana (Hyderabad)",
    thumbnail: "/samples/LOC_EO_05_HYDERABAD_HITEC/after_2025.jpg",
    tags: "Urban Development · Infrastructure",
  },
  {
    sceneId: "SCENE_002_2025",
    name: "Godavari Reservoir Basin",
    region: "Telangana / AP Border",
    thumbnail: "/samples/LOC_002_GODAVARI_RESERVOIR/after_2025.jpg",
    tags: "Surface Hydrology · Water Body",
  },
];

const AOI_REGIONS = [
  { label: "All India (Nationwide)", bbox: undefined },
  {
    label: "North India (Rajasthan / NCR / Punjab)",
    bbox: { min_lat: 25.0, min_lon: 70.0, max_lat: 32.0, max_lon: 78.0 },
  },
  {
    label: "South India (Karnataka / AP / Tamil Nadu)",
    bbox: { min_lat: 8.0, min_lon: 74.0, max_lat: 18.0, max_lon: 82.0 },
  },
  {
    label: "Western Coastal Corridor",
    bbox: { min_lat: 15.0, min_lon: 72.0, max_lat: 24.0, max_lon: 75.0 },
  },
];

export function SearchStage({
  onExecuteSearch,
  onSelectSihDemo,
  isLoading,
  activeQuery,
}: SearchStageProps) {
  const [searchMode, setSearchMode] = useState<"text" | "image" | "scene">("text");
  const [queryInput, setQueryInput] = useState(activeQuery || "");
  const [showFilters, setShowFilters] = useState(false);

  // Metadata filter state
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number>(0);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");

  // Image Upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const buildActiveFilters = (): SearchFilters | undefined => {
    const region = AOI_REGIONS[selectedRegionIndex];
    const hasSpatial = Boolean(region.bbox);
    const hasTemporal = Boolean(startDate || endDate);
    const hasPlatform = Boolean(selectedPlatform);

    if (!hasSpatial && !hasTemporal && !hasPlatform) return undefined;

    return {
      spatialFilter: region.bbox ? { bbox: region.bbox } : undefined,
      temporalFilter: hasTemporal ? { startDate: startDate || undefined, endDate: endDate || undefined } : undefined,
      platformFilter: hasPlatform ? { platform: selectedPlatform } : undefined,
    };
  };

  const activeFilterCount =
    (selectedRegionIndex > 0 ? 1 : 0) +
    (startDate || endDate ? 1 : 0) +
    (selectedPlatform ? 1 : 0);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (queryInput.trim()) {
      onExecuteSearch(queryInput.trim(), { filters: buildActiveFilters() });
    }
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      const url = URL.createObjectURL(file);
      setImagePreviewUrl(url);
    }
  };

  const handleClearImage = () => {
    setUploadedFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExecuteImageSearch = () => {
    if (uploadedFile) {
      onExecuteSearch(`Image Query: ${uploadedFile.name}`, {
        imageFile: uploadedFile,
        filters: buildActiveFilters(),
      });
    }
  };

  const handleSelectReferenceScene = (scene: typeof CATALOG_REFERENCE_SCENES[0]) => {
    onExecuteSearch(`Visual Match: ${scene.name}`, {
      imageSceneId: scene.sceneId,
      filters: buildActiveFilters(),
    });
  };

  const handleResetFilters = () => {
    setSelectedRegionIndex(0);
    setStartDate("");
    setEndDate("");
    setSelectedPlatform("");
  };

  return (
    <div className="max-w-4xl mx-auto py-8 md:py-12 space-y-6 font-mono">
      {/* Primary Workspace Title */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-600/10 border border-sky-500/30 text-sky-400 text-xs font-semibold tracking-wider uppercase">
          <Compass className="w-3.5 h-3.5" />
          <span>STAGE 1: MULTIMODAL SATELLITE DISCOVERY</span>
        </div>
        <h2 className="text-3xl md:text-5xl font-black tracking-tight text-slate-100 uppercase">
          What are you looking for?
        </h2>
        <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto font-sans">
          Search arbitrary Earth-observation activity in natural language or by visual satellite reference.
          Powered by 512-dimensional CLIP embeddings with sub-25ms vector retrieval.
        </p>
      </div>

      {/* Multimodal Mode Selector Tabs */}
      <div className="flex items-center justify-center gap-2 border-b border-tactical-800 pb-3">
        <button
          type="button"
          onClick={() => setSearchMode("text")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            searchMode === "text"
              ? "bg-sky-600 text-white shadow-md"
              : "bg-tactical-900 text-slate-400 hover:text-white border border-tactical-800"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>NATURAL LANGUAGE QUERY</span>
        </button>

        <button
          type="button"
          onClick={() => setSearchMode("image")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            searchMode === "image"
              ? "bg-sky-600 text-white shadow-md"
              : "bg-tactical-900 text-slate-400 hover:text-white border border-tactical-800"
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>IMAGE-TO-IMAGE SEARCH</span>
        </button>

        <button
          type="button"
          onClick={() => setSearchMode("scene")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            searchMode === "scene"
              ? "bg-sky-600 text-white shadow-md"
              : "bg-tactical-900 text-slate-400 hover:text-white border border-tactical-800"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>CATALOG REFERENCE SCENE</span>
        </button>
      </div>

      {/* MODE 1: Natural Language Text Search */}
      {searchMode === "text" && (
        <form onSubmit={handleTextSubmit} className="relative">
          <div className="relative flex items-center shadow-lg rounded-2xl bg-tactical-900 border-2 border-tactical-700 focus-within:border-sky-500 transition-colors">
            <Search className="absolute left-5 w-6 h-6 text-slate-500" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="e.g. solar park development in Rajasthan, reservoir drying, forest corridor..."
              className="w-full bg-transparent pl-14 pr-36 py-4 text-base md:text-lg text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
              autoFocus
            />
            <button
              type="submit"
              disabled={isLoading || !queryInput.trim()}
              className="absolute right-2 px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-tactical-800 disabled:text-slate-600 text-white font-bold text-xs md:text-sm tracking-wider transition-all flex items-center gap-2 shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SEARCHING...</span>
                </>
              ) : (
                <>
                  <span>SEARCH</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* MODE 2: Upload Reference Image Dropzone */}
      {searchMode === "image" && (
        <div className="bg-tactical-900 border-2 border-dashed border-tactical-700 hover:border-sky-500/60 rounded-2xl p-6 transition-colors text-center space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/tiff"
            onChange={handleImageFileChange}
            className="hidden"
            id="sat-image-upload"
          />

          {!imagePreviewUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer space-y-3 py-6"
            >
              <div className="w-12 h-12 mx-auto rounded-full bg-sky-600/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                <Upload className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-200">
                  Click or drag and drop a satellite tile to find visually similar sites
                </p>
                <p className="text-xs text-slate-500">
                  Supports GeoTIFF, PNG, JPEG (10m - 30m resolution chips)
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative inline-block border-2 border-sky-500 rounded-xl overflow-hidden shadow-lg max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreviewUrl}
                  alt="Uploaded Tile Preview"
                  className="w-full h-44 object-cover"
                />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <p className="text-xs text-slate-400 font-sans">
                  Selected Tile: <span className="text-sky-300 font-mono font-bold">{uploadedFile?.name}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleExecuteImageSearch}
                disabled={isLoading}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs tracking-wider transition-all inline-flex items-center gap-2 shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>EMBEDDING & MATCHING...</span>
                  </>
                ) : (
                  <>
                    <span>FIND SIMILAR SATELLITE SITES</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: Catalog Reference Scene Quick Picker */}
      {searchMode === "scene" && (
        <div className="bg-tactical-900 border border-tactical-750 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-bold text-slate-300 uppercase tracking-wider">
              Select Reference Observation Tile:
            </span>
            <span>Precomputed 512-D L2-Normalized Vectors</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {CATALOG_REFERENCE_SCENES.map((scene) => (
              <div
                key={scene.sceneId}
                onClick={() => handleSelectReferenceScene(scene)}
                className="group cursor-pointer bg-tactical-950 border border-tactical-800 hover:border-sky-500 rounded-xl p-2.5 transition-all hover:scale-[1.02] shadow-sm space-y-2"
              >
                <div className="h-28 rounded-lg overflow-hidden bg-slate-900 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={scene.thumbnail}
                    alt={scene.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-tactical-950 via-transparent to-transparent opacity-60"></div>
                  <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-tactical-950/80 border border-tactical-700 text-sky-300 font-bold">
                    {scene.sceneId}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200 group-hover:text-sky-300 truncate">
                    {scene.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 truncate">{scene.region}</p>
                  <p className="text-[9px] text-slate-500 truncate mt-0.5">{scene.tags}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Metadata Filters Section */}
      <div className="bg-tactical-900/60 border border-tactical-800 rounded-xl overflow-hidden transition-all">
        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-sky-400" />
            <span className="font-bold tracking-wider uppercase">
              METADATA CONSTRAINTS (AOI, DATE RANGE, SENSOR)
            </span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-sky-600 text-white text-[10px] font-bold">
                {activeFilterCount} Active
              </span>
            )}
          </div>
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFilters && (
          <div className="p-4 border-t border-tactical-800 space-y-4 text-xs font-mono bg-tactical-950/50">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filter 1: Spatial AOI */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                  <MapPin className="w-3 h-3 text-sky-400" />
                  <span>SPATIAL AOI (BOUNDING BOX):</span>
                </label>
                <select
                  value={selectedRegionIndex}
                  onChange={(e) => setSelectedRegionIndex(Number(e.target.value))}
                  className="w-full bg-tactical-900 border border-tactical-700 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {AOI_REGIONS.map((r, idx) => (
                    <option key={r.label} value={idx}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter 2: Date Range */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                  <Calendar className="w-3 h-3 text-sky-400" />
                  <span>TEMPORAL WINDOW:</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-tactical-900 border border-tactical-700 rounded-lg px-2 py-1.5 text-slate-200 text-[11px] focus:outline-none focus:border-sky-500"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-tactical-900 border border-tactical-700 rounded-lg px-2 py-1.5 text-slate-200 text-[11px] focus:outline-none focus:border-sky-500"
                    placeholder="End Date"
                  />
                </div>
              </div>

              {/* Filter 3: Platform / Sensor */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 flex items-center gap-1 font-bold">
                  <Layers className="w-3 h-3 text-sky-400" />
                  <span>CONSTELLATION / SENSOR:</span>
                </label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  className="w-full bg-tactical-900 border border-tactical-700 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="">All Sensors (Multi-Mission)</option>
                  <option value="Sentinel-2">Copernicus Sentinel-2 MSI (10m L2A)</option>
                  <option value="Sentinel-1">Copernicus Sentinel-1 C-SAR</option>
                  <option value="Landsat">Landsat-8/9 OLI (30m)</option>
                </select>
              </div>
            </div>

            {activeFilterCount > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[10px] text-slate-400 hover:text-white underline"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SIH Deterministic Judge Preset Card */}
      <div className="bg-tactical-900/90 border border-sky-500/40 rounded-2xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold tracking-wider uppercase">
              SIH JUDGE DEMO PATH
            </span>
            <span className="text-xs text-slate-400">Deterministic Multi-Temporal Evaluation</span>
          </div>
          <h3 className="text-base font-bold text-slate-100">
            &ldquo;solar park development in Rajasthan&rdquo;
          </h3>
          <p className="text-xs text-slate-400 font-sans">
            Resolves directly to Bhadla Solar Park • 710-day Sentinel-2 observation baseline (2023-04-05 &rarr; 2025-03-15) • 60.22 ha detected change.
          </p>
        </div>

        <button
          type="button"
          onClick={onSelectSihDemo}
          className="px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs tracking-wider transition-all flex items-center justify-center gap-2 shadow-md hover:scale-105 active:scale-95 whitespace-nowrap shrink-0"
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>LAUNCH SIH DEMO — SOLAR</span>
        </button>
      </div>

      {/* Secondary Exploration Chips */}
      <div className="space-y-2 pt-1">
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block text-center">
          Or explore verified semantic concepts:
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {PRESET_QUERIES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setQueryInput(preset.query);
                onExecuteSearch(preset.query, { filters: buildActiveFilters() });
              }}
              className="px-3.5 py-1.5 rounded-lg bg-tactical-900 hover:bg-tactical-800 border border-tactical-700 hover:border-slate-500 text-xs text-slate-300 transition-colors"
            >
              &rarr; {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sovereign Tech Architecture Pill */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500 font-mono pt-2">
        <Cpu className="w-3.5 h-3.5 text-sky-400" />
        <span>Packaged Client ONNX/WASM CLIP ViT-B/32 · Sub-25ms Vector Retrieval · Zero Cloud API Dependencies</span>
      </div>
    </div>
  );
}
