"use client";

import React, { useEffect, useRef, useState } from "react";
import { Location } from "@/types";
import {
  Satellite,
  Map as MapIcon,
  Search,
  X,
  Maximize2,
  Minimize2,
  Compass,
  Crosshair,
  Loader2,
  Layers,
} from "lucide-react";
import { BoundingBox } from "@/types";
import { SatelliteScene, TemporalPairCandidate } from "@/lib/providers/satelliteProvider";

interface TacticalMapProps {
  locations: Location[];
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
  // Phase 3 Live Public Data Mode props
  isLiveMode?: boolean;
  aoi?: BoundingBox | null;
  onAoiChange?: (aoi: BoundingBox | null) => void;
  isDrawingAoi?: boolean;
  onToggleDrawingAoi?: (drawing: boolean) => void;
  selectedScene?: SatelliteScene | null;
  selectedPair?: TemporalPairCandidate | null;
}

type MapMode = "google-hybrid" | "google-streets" | "esri-satellite" | "tactical";

interface SearchResultItem {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  boundingbox?: [number, number, number, number];
}

export function TacticalMap({
  locations,
  selectedLocationId,
  onSelectLocation,
  isLiveMode = false,
  aoi = null,
  onAoiChange,
  isDrawingAoi = false,
  onToggleDrawingAoi,
  selectedScene = null,
  selectedPair = null,
}: TacticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const layersRef = useRef<{ [key in MapMode]?: any }>({});
  const searchMarkerRef = useRef<any>(null);
  const aoiLayerRef = useRef<any>(null);
  const sceneFootprintRef = useRef<any>(null);
  const drawPreviewRef = useRef<any>(null);
  const startPointRef = useRef<any>(null);

  const [mapMode, setMapMode] = useState<MapMode>("google-hybrid");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [pinnedPlace, setPinnedPlace] = useState<{ name: string; lat: number; lon: number } | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Fix standard leaflet icon path issues in React
      const DefaultIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = DefaultIcon;

      const cartoKey = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim() || "";

      if (!mapInstanceRef.current) {
        // Initialize map centered on India / South Asia
        const map = L.map(mapContainerRef.current, {
          center: [20.5937, 78.9629],
          zoom: 5,
          zoomControl: true,
          attributionControl: true,
        });

        // 1. Google Maps Hybrid (Satellite Imagery + Full Roads, Borders & Place Labels)
        const googleHybridLayer = L.tileLayer(
          "https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          {
            subdomains: ["0", "1", "2", "3"],
            maxZoom: 22,
            maxNativeZoom: 20,
            attribution: "&copy; Google Maps",
          }
        );

        // 2. Google Maps Street/Road Map (Every Place, City, Highway & POI worldwide)
        const googleStreetsLayer = L.tileLayer(
          "https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          {
            subdomains: ["0", "1", "2", "3"],
            maxZoom: 22,
            maxNativeZoom: 20,
            attribution: "&copy; Google Maps",
          }
        );

        // 3. Esri World Imagery (High-Resolution Satellite) + Reference Labels
        const esriBase = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 20,
            maxNativeZoom: 18,
            attribution:
              "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
          }
        );
        const esriLabels = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 20,
            maxNativeZoom: 18,
          }
        );
        const esriLayerGroup = L.layerGroup([esriBase, esriLabels]);

        // 4. Tactical Basemap: CARTO Voyager if key configured, otherwise graceful OSM fallback
        const tacticalLayer = cartoKey
          ? L.tileLayer(
              `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`,
              {
                maxZoom: 19,
                subdomains: "abcd",
                attribution:
                  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>',
              }
            )
          : L.tileLayer(
              "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
              {
                maxZoom: 19,
                attribution:
                  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
              }
            );

        layersRef.current = {
          "google-hybrid": googleHybridLayer,
          "google-streets": googleStreetsLayer,
          "esri-satellite": esriLayerGroup,
          "tactical": tacticalLayer,
        };

        // Add default Google Hybrid layer (displays satellite + all places just like Google Maps)
        googleHybridLayer.addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear previous markers
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      // Add markers & bounding boxes for each location in catalog
      locations.forEach((loc) => {
        const isSelected = loc.location_id === selectedLocationId;

        const customMarkerHtml = `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: ${isSelected ? "34px" : "26px"};
            height: ${isSelected ? "34px" : "26px"};
            border-radius: 50%;
            background: ${isSelected ? "#00e5ff" : "rgba(15, 23, 42, 0.88)"};
            border: 2px solid ${isSelected ? "#ffffff" : "#00e5ff"};
            color: ${isSelected ? "#090d16" : "#00e5ff"};
            font-size: 11px;
            font-weight: bold;
            box-shadow: 0 0 16px ${isSelected ? "rgba(0,229,255,0.95)" : "rgba(0,0,0,0.75)"};
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            ${loc.location_id.split("_")[1] || "LOC"}
          </div>
        `;

        const divIcon = L.divIcon({
          html: customMarkerHtml,
          className: "tactical-marker",
          iconSize: isSelected ? [34, 34] : [26, 26],
          iconAnchor: isSelected ? [17, 17] : [13, 13],
        });

        const marker = L.marker([loc.latitude, loc.longitude], { icon: divIcon }).addTo(map);

        marker.on("click", () => {
          onSelectLocation(loc.location_id);
        });

        marker.bindTooltip(
          `<strong>${loc.name}</strong><br/>Sensor: ${loc.primary_sensor}<br/>Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)}`,
          { className: "tactical-tooltip", direction: "top" }
        );

        // Bounding box rectangle for satellite scene
        if (loc.bounding_box) {
          const bounds: [[number, number], [number, number]] = [
            [loc.bounding_box.min_lat, loc.bounding_box.min_lon],
            [loc.bounding_box.max_lat, loc.bounding_box.max_lon],
          ];
          const rect = L.rectangle(bounds, {
            color: isSelected ? "#00e5ff" : "#38bdf8",
            weight: isSelected ? 2.5 : 1.2,
            fillColor: isSelected ? "#00e5ff" : "#0284c7",
            fillOpacity: isSelected ? 0.3 : 0.12,
            dashArray: isSelected ? undefined : "4, 4",
          }).addTo(map);

          markersRef.current[`rect_${loc.location_id}`] = rect;
        }

        markersRef.current[loc.location_id] = marker;
      });

      // Fly to selected location with high-resolution detail
      const selectedLoc = locations.find((l) => l.location_id === selectedLocationId);
      if (selectedLoc) {
        if (selectedLoc.bounding_box) {
          map.fitBounds(
            [
              [selectedLoc.bounding_box.min_lat, selectedLoc.bounding_box.min_lon],
              [selectedLoc.bounding_box.max_lat, selectedLoc.bounding_box.max_lon],
            ],
            { padding: [40, 40], maxZoom: 13, duration: 1.2 }
          );
        } else {
          map.flyTo([selectedLoc.latitude, selectedLoc.longitude], 12, {
            duration: 1.2,
          });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [locations, selectedLocationId, onSelectLocation]);

  // Synchronize Analyst AOI Rectangle on Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let isMounted = true;
    import("leaflet").then((L) => {
      if (!isMounted) return;

      if (aoiLayerRef.current) {
        aoiLayerRef.current.remove();
        aoiLayerRef.current = null;
      }

      if (aoi) {
        const bounds: [[number, number], [number, number]] = [
          [aoi.min_lat, aoi.min_lon],
          [aoi.max_lat, aoi.max_lon],
        ];
        const rect = L.rectangle(bounds, {
          color: "#f59e0b", // Amber for analyst AOI
          weight: 2.5,
          fillColor: "#f59e0b",
          fillOpacity: 0.15,
          dashArray: "6, 6",
        }).addTo(map);

        rect.bindTooltip(
          `<strong>ANALYST AOI</strong><br/>[${aoi.min_lat.toFixed(4)}, ${aoi.min_lon.toFixed(4)}] to [${aoi.max_lat.toFixed(4)}, ${aoi.max_lon.toFixed(4)}]`,
          { permanent: false, direction: "top", className: "tactical-tooltip" }
        );

        aoiLayerRef.current = rect;

        if (isLiveMode) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, duration: 1.0 });
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [aoi, isLiveMode]);

  // Handle Interactive Map AOI Drawing
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!isDrawingAoi) {
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = "";
      }
      map.dragging.enable();
      if (drawPreviewRef.current) {
        drawPreviewRef.current.remove();
        drawPreviewRef.current = null;
      }
      startPointRef.current = null;
      return;
    }

    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = "crosshair";
    }
    map.dragging.disable();

    let LInstance: any = null;
    import("leaflet").then((L) => {
      LInstance = L;
    });

    const onMouseDown = (e: any) => {
      startPointRef.current = e.latlng;
    };

    const onMouseMove = (e: any) => {
      if (!startPointRef.current || !LInstance) return;
      const start = startPointRef.current;
      const curr = e.latlng;
      const bounds: [[number, number], [number, number]] = [
        [Math.min(start.lat, curr.lat), Math.min(start.lng, curr.lng)],
        [Math.max(start.lat, curr.lat), Math.max(start.lng, curr.lng)],
      ];

      if (!drawPreviewRef.current) {
        drawPreviewRef.current = LInstance.rectangle(bounds, {
          color: "#00e5ff",
          weight: 2,
          fillColor: "#00e5ff",
          fillOpacity: 0.2,
          dashArray: "4, 4",
        }).addTo(map);
      } else {
        drawPreviewRef.current.setBounds(bounds);
      }
    };

    const onMouseUp = (e: any) => {
      if (!startPointRef.current) return;
      const start = startPointRef.current;
      const end = e.latlng;

      const minLat = Math.min(start.lat, end.lat);
      const minLon = Math.min(start.lng, end.lng);
      const maxLat = Math.max(start.lat, end.lat);
      const maxLon = Math.max(start.lng, end.lng);

      if (drawPreviewRef.current) {
        drawPreviewRef.current.remove();
        drawPreviewRef.current = null;
      }
      startPointRef.current = null;

      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = "";
      }
      map.dragging.enable();

      if (Math.abs(maxLat - minLat) > 0.001 && Math.abs(maxLon - minLon) > 0.001) {
        if (onAoiChange) {
          onAoiChange({
            min_lat: parseFloat(minLat.toFixed(5)),
            min_lon: parseFloat(minLon.toFixed(5)),
            max_lat: parseFloat(maxLat.toFixed(5)),
            max_lon: parseFloat(maxLon.toFixed(5)),
          });
        }
      }

      if (onToggleDrawingAoi) {
        onToggleDrawingAoi(false);
      }
    };

    map.on("mousedown", onMouseDown);
    map.on("mousemove", onMouseMove);
    map.on("mouseup", onMouseUp);

    return () => {
      map.off("mousedown", onMouseDown);
      map.off("mousemove", onMouseMove);
      map.off("mouseup", onMouseUp);
      map.dragging.enable();
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = "";
      }
      if (drawPreviewRef.current) {
        drawPreviewRef.current.remove();
        drawPreviewRef.current = null;
      }
      startPointRef.current = null;
    };
  }, [isDrawingAoi, onAoiChange, onToggleDrawingAoi]);

  // Synchronize Live Sentinel-2 Scene Footprint
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const targetScene = selectedScene || selectedPair?.afterScene || selectedPair?.beforeScene;
    if (!targetScene) {
      if (sceneFootprintRef.current) {
        sceneFootprintRef.current.remove();
        sceneFootprintRef.current = null;
      }
      return;
    }

    let isMounted = true;
    import("leaflet").then((L) => {
      if (!isMounted) return;

      if (sceneFootprintRef.current) {
        sceneFootprintRef.current.remove();
        sceneFootprintRef.current = null;
      }

      const [minLon, minLat, maxLon, maxLat] = targetScene.bbox;
      if (minLat !== 0 || maxLat !== 0) {
        const bounds: [[number, number], [number, number]] = [
          [minLat, minLon],
          [maxLat, maxLon],
        ];

        const footprint = L.rectangle(bounds, {
          color: "#10b981", // Emerald for live Sentinel-2 scene
          weight: 3,
          fillColor: "#10b981",
          fillOpacity: 0.18,
        }).addTo(map);

        footprint.bindTooltip(
          `<strong>SENTINEL-2 FOOTPRINT</strong><br/>${targetScene.sceneId}<br/>Acquired: ${targetScene.acquisitionDate.split("T")[0]}<br/>Cloud: ${targetScene.cloudCoverPercentage.toFixed(1)}%`,
          { permanent: false, direction: "top", className: "tactical-tooltip" }
        );

        sceneFootprintRef.current = footprint;
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12, duration: 1.2 });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedScene, selectedPair]);

  // Handle layer switching
  const switchLayer = (newMode: MapMode) => {
    setMapMode(newMode);
    const map = mapInstanceRef.current;
    if (!map || !layersRef.current) return;

    // Remove all layers
    Object.values(layersRef.current).forEach((layer: any) => {
      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });

    // Add selected layer
    const activeLayer = layersRef.current[newMode];
    if (activeLayer) {
      activeLayer.addTo(map);
    }
  };

  // Re-size map when expanded
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [isExpanded]);

  // Search any place worldwide (like Google Maps)
  const handlePlaceSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setIsDropdownOpen(false);

    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const results: SearchResultItem[] = data.results || [];

      if (results.length === 1) {
        // Direct jump
        selectPlace(results[0]);
      } else if (results.length > 1) {
        setSearchResults(results);
        setIsDropdownOpen(true);
      } else {
        alert(`No location found for "${query}". Try city name, district, or coordinates (e.g. 17.385, 78.486).`);
      }
    } catch (err) {
      console.error("Geocoding failed:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Select place from search and fly there
  const selectPlace = (place: SearchResultItem) => {
    setIsDropdownOpen(false);
    setSearchQuery(place.name);
    setPinnedPlace({ name: place.name, lat: place.lat, lon: place.lon });

    const map = mapInstanceRef.current;
    if (!map) return;

    import("leaflet").then((L) => {
      // Remove old search pin if any
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove();
        searchMarkerRef.current = null;
      }

      // Create distinctive tactical pinpoint
      const searchPinHtml = `
        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f43f5e;
          border: 2px solid #ffffff;
          color: #ffffff;
          box-shadow: 0 0 20px rgba(244, 63, 94, 0.95);
          animation: pulse 1.5s infinite;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path>
          </svg>
        </div>
      `;

      const searchPinIcon = L.divIcon({
        html: searchPinHtml,
        className: "search-pin",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([place.lat, place.lon], { icon: searchPinIcon }).addTo(map);

      marker
        .bindPopup(
          `<div style="font-family: sans-serif; font-size: 12px; color: #0f172a; max-width: 240px;">
            <b style="color: #e11d48; font-size: 13px;">${place.name}</b><br/>
            <span style="color: #64748b; font-size: 11px;">${place.display_name}</span><br/>
            <hr style="margin: 6px 0; border: none; border-top: 1px solid #e2e8f0;"/>
            <b>Coordinates:</b> ${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}
          </div>`
        )
        .openPopup();

      searchMarkerRef.current = marker;

      // Fly to location
      if (place.boundingbox && place.boundingbox.length === 4) {
        map.fitBounds(
          [
            [place.boundingbox[0], place.boundingbox[2]],
            [place.boundingbox[1], place.boundingbox[3]],
          ],
          { padding: [50, 50], maxZoom: 15, duration: 1.5 }
        );
      } else {
        map.flyTo([place.lat, place.lon], 13, { duration: 1.5 });
      }
    });
  };

  const clearPinnedPlace = () => {
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
    setPinnedPlace(null);
    setSearchQuery("");
  };

  const resetToTargetAOIs = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.flyTo([20.5937, 78.9629], 5, { duration: 1.2 });
  };

  const hasCartoKey = Boolean(process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim());

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border border-tactical-700 shadow-xl bg-tactical-900 transition-all duration-300 ${
        isExpanded ? "h-[540px]" : "h-[390px]"
      }`}
    >
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Place Search Bar (Global Google Maps-style Geocoding) */}
      <div className="absolute top-2.5 left-2.5 z-[25] w-[calc(100%-120px)] max-w-sm">
        <form onSubmit={handlePlaceSearch} className="relative flex items-center">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any place or coords (e.g. Mumbai, Tokyo)..."
              className="w-full pl-8 pr-16 py-1.5 bg-tactical-950/90 backdrop-blur-md border border-tactical-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 shadow-lg font-mono"
            />
            <Search className="w-3.5 h-3.5 text-cyan-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />

            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearPinnedPlace}
                  className="p-1 hover:text-white text-slate-400"
                  title="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching}
                className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[10px] uppercase font-mono tracking-wider transition-all disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "FIND"}
              </button>
            </div>
          </div>
        </form>

        {/* Search Results Dropdown */}
        {isDropdownOpen && searchResults.length > 0 && (
          <div className="absolute left-0 right-0 mt-1 bg-tactical-950/95 backdrop-blur-md border border-tactical-700 rounded-lg shadow-2xl overflow-hidden max-h-56 overflow-y-auto z-[30]">
            <div className="p-1.5 border-b border-tactical-800 text-[10px] font-mono text-slate-400 uppercase tracking-wider flex justify-between items-center">
              <span>Matching Locations ({searchResults.length})</span>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectPlace(item)}
                className="w-full text-left px-2.5 py-1.5 hover:bg-tactical-800 transition-colors border-b border-tactical-800/50 last:border-b-0"
              >
                <div className="text-xs font-semibold text-cyan-300 truncate">{item.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{item.display_name}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Mode AOI Telemetry Bar */}
      {isLiveMode && (
        <div className="absolute top-12 left-2.5 z-[25] flex flex-wrap items-center gap-1.5 font-mono text-[10px] max-w-[calc(100%-20px)] pointer-events-auto">
          {isDrawingAoi ? (
            <div className="bg-amber-500/90 text-slate-950 font-bold px-2.5 py-1 rounded shadow-md animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-950" />
              <span>DRAG TO DRAW AOI RECTANGLE ON MAP</span>
            </div>
          ) : aoi ? (
            <div className="bg-tactical-950/95 border border-amber-500/50 text-amber-300 px-2 py-0.5 rounded shadow-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>
                AOI: [{aoi.min_lat.toFixed(2)}, {aoi.min_lon.toFixed(2)}] to [{aoi.max_lat.toFixed(2)}, {aoi.max_lon.toFixed(2)}]
              </span>
              {onAoiChange && (
                <button
                  type="button"
                  onClick={() => onAoiChange(null)}
                  className="hover:text-rose-400 text-slate-400 ml-1 px-1 font-bold"
                  title="Clear AOI"
                >
                  ✕
                </button>
              )}
            </div>
          ) : (
            <div className="bg-tactical-950/85 border border-slate-700 text-slate-400 px-2 py-0.5 rounded shadow-md">
              LIVE SATELLITE DISCOVERY MODE
            </div>
          )}

          {selectedScene && (
            <div className="bg-emerald-950/95 border border-emerald-500/50 text-emerald-300 px-2 py-0.5 rounded shadow-md flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="truncate max-w-[180px]">SCENE: {selectedScene.sceneId}</span>
            </div>
          )}
        </div>
      )}

      {/* Top-Right Quick Actions: Expand/Collapse & Reset View */}
      <div className="absolute top-2.5 right-2.5 z-[25] flex items-center gap-1.5">
        <button
          type="button"
          onClick={resetToTargetAOIs}
          className="p-1.5 bg-tactical-950/90 backdrop-blur-md rounded-lg border border-tactical-700 text-slate-300 hover:text-cyan-400 hover:bg-tactical-800 shadow-md text-xs transition-all flex items-center gap-1 font-mono"
          title="Reset to All Monitored AOIs"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline text-[10px]">AOIs</span>
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 bg-tactical-950/90 backdrop-blur-md rounded-lg border border-tactical-700 text-slate-300 hover:text-cyan-400 hover:bg-tactical-800 shadow-md transition-all"
          title={isExpanded ? "Collapse map" : "Expand map size"}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Layer Mode Switcher Controls (Bottom-Left) */}
      <div className="absolute bottom-2.5 left-2.5 z-[25] flex items-center bg-tactical-950/95 backdrop-blur-md rounded-lg p-0.5 border border-tactical-700 shadow-xl text-[10px] font-mono">
        <button
          type="button"
          onClick={() => switchLayer("google-hybrid")}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
            mapMode === "google-hybrid"
              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-tactical-800"
          }`}
          title="Google Satellite Hybrid (Satellite Imagery + Full Street & Place Labels)"
        >
          <Satellite className="w-3 h-3" />
          <span>SATELLITE</span>
        </button>

        <button
          type="button"
          onClick={() => switchLayer("google-streets")}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
            mapMode === "google-streets"
              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-tactical-800"
          }`}
          title="Google Maps (Every place, street, and landmark worldwide)"
        >
          <MapIcon className="w-3 h-3" />
          <span>MAPS</span>
        </button>

        <button
          type="button"
          onClick={() => switchLayer("esri-satellite")}
          className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded transition-all ${
            mapMode === "esri-satellite"
              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-tactical-800"
          }`}
          title="Esri World Imagery (High-Resolution Orbital Satellite)"
        >
          <Layers className="w-3 h-3" />
          <span>ESRI</span>
        </button>

        <button
          type="button"
          onClick={() => switchLayer("tactical")}
          className={`flex items-center gap-1 px-2 py-1 rounded transition-all ${
            mapMode === "tactical"
              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-tactical-800"
          }`}
          title={hasCartoKey ? "CARTO Voyager Tactical Basemap" : "Tactical Basemap (OpenStreetMap Fallback)"}
        >
          <Crosshair className="w-3 h-3" />
          <span>TACTICAL</span>
        </button>
      </div>

      {/* Active Layer Telemetry Badge (Bottom-Right) */}
      <div className="absolute bottom-2.5 right-2.5 bg-tactical-950/90 backdrop-blur-md px-2 py-1 rounded border border-tactical-700 text-[10px] font-mono text-cyan-300 z-[25] pointer-events-none flex items-center gap-1.5 shadow-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="hidden sm:inline">
          {mapMode === "google-hybrid"
            ? "GOOGLE SATELLITE HYBRID • EPSG:3857"
            : mapMode === "google-streets"
            ? "GOOGLE MAPS STREETS • EPSG:3857"
            : mapMode === "esri-satellite"
            ? "ESRI WORLD IMAGERY • EPSG:4326"
            : hasCartoKey
            ? "CARTO VOYAGER • EPSG:4326"
            : "OPENSTREETMAP • EPSG:4326"}
        </span>
        <span className="sm:hidden">
          {mapMode === "google-hybrid"
            ? "SATELLITE"
            : mapMode === "google-streets"
            ? "MAPS"
            : mapMode === "esri-satellite"
            ? "ESRI"
            : "TACTICAL"}
        </span>
      </div>

      {/* Target location active toast */}
      {pinnedPlace && (
        <div className="absolute bottom-11 right-2.5 z-[25] bg-rose-950/90 border border-rose-600/60 text-rose-200 px-2.5 py-1 rounded text-[10px] font-mono shadow-lg flex items-center gap-2">
          <span>TARGET: {pinnedPlace.name}</span>
          <button
            type="button"
            onClick={clearPinnedPlace}
            className="text-rose-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
