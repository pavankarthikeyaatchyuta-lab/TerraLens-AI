"use client";

import React, { useState, useRef } from "react";
import { Search, Sparkles, X, Loader2, SlidersHorizontal, Image as ImageIcon, Upload, RotateCcw } from "lucide-react";

export interface SearchExecutionOptions {
  query?: string;
  image?: string;
  imageSceneId?: string;
  spatialFilter?: { bbox: { min_lat: number; min_lon: number; max_lat: number; max_lon: number } };
  temporalFilter?: { startDate?: string; endDate?: string };
  platformFilter?: { platform?: string };
  groupBy?: "scene" | "location";
}

interface SearchBarProps {
  onSearch: (options: string | SearchExecutionOptions) => void;
  isLoading: boolean;
  activeQuery: string;
  catalogMode?: "benchmark" | "real-eo";
}

const PRESET_QUERIES = [
  { label: "Urban Expansion", query: "urban expansion and new construction near river" },
  { label: "Reservoir Drought", query: "water reservoir shoreline drying and lake shrinkage" },
  { label: "Forest Corridor", query: "forest road clearing corridor and tree removal" },
  { label: "Coastal Port", query: "coastal port reclamation and ocean harbor pier" },
  { label: "Solar Park", query: "solar panel farm photovoltaic arrays in desert terrain" },
];

export function SearchBar({ onSearch, isLoading, activeQuery, catalogMode = "benchmark" }: SearchBarProps) {
  const [searchMode, setSearchMode] = useState<"text" | "image">("text");
  const [inputVal, setInputVal] = useState(activeQuery);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [filterMinLat, setFilterMinLat] = useState("");
  const [filterMinLon, setFilterMinLon] = useState("");
  const [filterMaxLat, setFilterMaxLat] = useState("");
  const [filterMaxLon, setFilterMaxLon] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterPlatform, setFilterPlatform] = useState<string>("ALL");
  const [groupBy, setGroupBy] = useState<"location" | "scene">("location");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFilterCount =
    (filterMinLat || filterMinLon || filterMaxLat || filterMaxLon ? 1 : 0) +
    (filterStartDate || filterEndDate ? 1 : 0) +
    (filterPlatform !== "ALL" ? 1 : 0) +
    (groupBy === "scene" ? 1 : 0);

  const handleResetFilters = () => {
    setFilterMinLat("");
    setFilterMinLon("");
    setFilterMaxLat("");
    setFilterMaxLon("");
    setFilterStartDate("");
    setFilterEndDate("");
    setFilterPlatform("ALL");
    setGroupBy("location");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = reader.result as string;
        setImageB64(b64);
        setImagePreview(b64);
      };
      reader.readAsDataURL(file);
    }
  };

  const executeSearch = (overrideQuery?: string) => {
    const spatial =
      filterMinLat && filterMinLon && filterMaxLat && filterMaxLon
        ? {
            bbox: {
              min_lat: parseFloat(filterMinLat),
              min_lon: parseFloat(filterMinLon),
              max_lat: parseFloat(filterMaxLat),
              max_lon: parseFloat(filterMaxLon),
            },
          }
        : undefined;

    const temporal =
      filterStartDate || filterEndDate
        ? {
            startDate: filterStartDate || undefined,
            endDate: filterEndDate || undefined,
          }
        : undefined;

    const platform = filterPlatform !== "ALL" ? { platform: filterPlatform } : undefined;

    if (searchMode === "image" && imageB64) {
      onSearch({
        image: imageB64,
        spatialFilter: spatial,
        temporalFilter: temporal,
        platformFilter: platform,
        groupBy,
      });
    } else {
      const q = overrideQuery !== undefined ? overrideQuery : inputVal;
      if (q.trim() || spatial || temporal || platform) {
        onSearch({
          query: q.trim(),
          spatialFilter: spatial,
          temporalFilter: temporal,
          platformFilter: platform,
          groupBy,
        });
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  const handleChipClick = (q: string) => {
    setInputVal(q);
    setSearchMode("text");
    executeSearch(q);
  };

  return (
    <div className="bg-tactical-850 border border-tactical-700 rounded-xl p-4 shadow-sm transition-colors space-y-3">
      {/* Mode Switcher & Filter Toggle */}
      <div className="flex items-center justify-between border-b border-tactical-700/60 pb-2.5">
        <div className="flex items-center gap-1.5 p-0.5 bg-tactical-900 border border-tactical-700 rounded-lg text-xs font-mono">
          <button
            type="button"
            onClick={() => setSearchMode("text")}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              searchMode === "text"
                ? "bg-sky-600 text-white font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>TEXT QUERY</span>
          </button>
          <button
            type="button"
            onClick={() => setSearchMode("image")}
            className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              searchMode === "image"
                ? "bg-indigo-600 text-white font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>IMAGE QUERY</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowFilters(!showFilters)}
          className={`px-3 py-1 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5 ${
            showFilters || activeFilterCount > 0
              ? "bg-sky-500/15 border-sky-500/50 text-sky-700 dark:text-sky-300 font-semibold"
              : "bg-tactical-900 border-tactical-700 text-slate-400 hover:text-slate-200"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>FILTERS</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-sky-500 text-slate-900 text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Search Input: Text or Image */}
      {searchMode === "text" ? (
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <Search className="absolute left-3.5 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Enter arbitrary natural-language query (e.g. 'flooded farmland near river', 'new urban construction')..."
            className="w-full bg-tactical-900 border border-tactical-700 rounded-lg pl-11 pr-28 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono transition-all"
          />

          {inputVal && (
            <button
              type="button"
              onClick={() => setInputVal("")}
              className="absolute right-24 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="absolute right-1.5 px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white rounded-md text-xs font-mono font-semibold tracking-wider transition-all flex items-center gap-1.5 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>ENCODING...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>RETRIEVE</span>
              </>
            )}
          </button>
        </form>
      ) : (
        /* Image Mode Input */
        <div className="flex flex-col sm:flex-row items-center gap-3 p-3 bg-tactical-900 border border-tactical-700 rounded-lg">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {imagePreview ? (
            <div className="relative group w-24 h-20 rounded-md overflow-hidden border border-tactical-700 shrink-0">
              <img
                src={imagePreview}
                alt="Query Reference"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setImageB64(null);
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                title="Remove image"
              >
                <X className="w-5 h-5 text-red-400" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto px-4 py-3 rounded-md border-2 border-dashed border-tactical-700 hover:border-indigo-500 bg-tactical-850/60 hover:bg-tactical-800 text-slate-400 hover:text-indigo-400 flex items-center justify-center gap-2 font-mono text-xs transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>UPLOAD REFERENCE SATELLITE IMAGE (PNG/JPG)</span>
            </button>
          )}

          <div className="flex-1 text-xs font-mono text-slate-400">
            {imagePreview ? (
              <span className="text-emerald-400 font-semibold">Image loaded ready for 512-dim CLIP visual embedding</span>
            ) : (
              <span>Or drag & drop imagery to discover visually/semantically similar Sentinel-2 scenes.</span>
            )}
          </div>

          <button
            type="button"
            disabled={isLoading || !imageB64}
            onClick={() => executeSearch()}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 text-white rounded-md text-xs font-mono font-semibold tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>ENCODING...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>SEARCH BY IMAGE</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Expandable Metadata Filters Drawer */}
      {showFilters && (
        <div className="p-3.5 bg-tactical-900/90 border border-tactical-700 rounded-lg text-xs font-mono space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-tactical-700/50 pb-2">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              <span>Metadata & Spatial Constraints</span>
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-slate-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Spatial Bounding Box */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 block font-semibold">
                AOI Bounding Box [min_lat, min_lon, max_lat, max_lon]
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min Lat"
                  value={filterMinLat}
                  onChange={(e) => setFilterMinLat(e.target.value)}
                  className="bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Min Lon"
                  value={filterMinLon}
                  onChange={(e) => setFilterMinLon(e.target.value)}
                  className="bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max Lat"
                  value={filterMaxLat}
                  onChange={(e) => setFilterMaxLat(e.target.value)}
                  className="bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Max Lon"
                  value={filterMaxLon}
                  onChange={(e) => setFilterMaxLon(e.target.value)}
                  className="bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Temporal Range */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 block font-semibold">
                Temporal Range (Acquisition Date)
              </label>
              <div className="space-y-1.5">
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="w-full bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="w-full bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            {/* Platform & Grouping */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 block font-semibold">
                Platform & Result Aggregation
              </label>
              <div className="space-y-2">
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="w-full bg-tactical-850 border border-tactical-700 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-sky-500"
                >
                  <option value="ALL">All Platforms (Sentinel-2A &amp; 2B)</option>
                  <option value="Sentinel-2A">Sentinel-2A Only</option>
                  <option value="Sentinel-2B">Sentinel-2B Only</option>
                </select>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-400">Group By:</span>
                  <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="groupBy"
                      value="location"
                      checked={groupBy === "location"}
                      onChange={() => setGroupBy("location")}
                    />
                    <span>Location</span>
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="groupBy"
                      value="scene"
                      checked={groupBy === "scene"}
                      onChange={() => setGroupBy("scene")}
                    />
                    <span>Scene</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Presets Chips (Text Mode) */}
      {searchMode === "text" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span>BENCHMARKS:</span>
          </span>
          {PRESET_QUERIES.map((item) => (
            <button
              key={item.label}
              onClick={() => handleChipClick(item.query)}
              className={`text-xs px-2.5 py-1 rounded-md font-mono border transition-all ${
                inputVal.toLowerCase() === item.query.toLowerCase()
                  ? "bg-sky-600/15 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500 font-bold"
                  : "bg-tactical-800 text-slate-700 dark:text-slate-300 border-tactical-700 hover:border-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Multimodal & Feature Notice */}
      <div className="pt-2 border-t border-tactical-700 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300">
          <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          <span>
            {searchMode === "text"
              ? "Multimodal 512-dim CLIP Text Encoder with FAISS IndexFlatIP Cosine Similarity & Metadata Filtering."
              : "Multimodal 512-dim CLIP Image-to-Image Search over Sentinel-2 MSI Catalog."}
          </span>
        </div>
      </div>
    </div>
  );
}
