"use client";

import React, { useEffect, useRef, useState } from "react";
import { Location } from "@/types";
import { Satellite, Map as MapIcon } from "lucide-react";

interface TacticalMapProps {
  locations: Location[];
  selectedLocationId: string;
  onSelectLocation: (locationId: string) => void;
}

export function TacticalMap({
  locations,
  selectedLocationId,
  onSelectLocation,
}: TacticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const layersRef = useRef<{
    satelliteLayers?: any[];
    tacticalLayer?: any;
  }>({});
  const [mapMode, setMapMode] = useState<"satellite" | "tactical">("satellite");

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
        // Initialize map centered on India
        const map = L.map(mapContainerRef.current, {
          center: [20.5937, 78.9629],
          zoom: 5,
          zoomControl: true,
          attributionControl: true,
        });

        // 1. High-resolution Satellite Imagery (Esri World Imagery)
        const satelliteBase = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
            attribution:
              'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          }
        );

        // 2. High-contrast Place & Boundary Reference Labels
        const satelliteLabels = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
          {
            maxZoom: 19,
          }
        );

        // 3. Tactical Basemap: CARTO Voyager if key configured, otherwise graceful OSM fallback
        const tacticalBase = cartoKey
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
          satelliteLayers: [satelliteBase, satelliteLabels],
          tacticalLayer: tacticalBase,
        };

        // Add default layer (Satellite Mode)
        satelliteBase.addTo(map);
        satelliteLabels.addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      // Clear previous markers
      Object.values(markersRef.current).forEach((m: any) => m.remove());
      markersRef.current = {};

      // Add markers & bounding boxes for each location
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
            background: ${isSelected ? "#00e5ff" : "rgba(15, 23, 42, 0.85)"};
            border: 2px solid ${isSelected ? "#ffffff" : "#00e5ff"};
            color: ${isSelected ? "#090d16" : "#00e5ff"};
            font-size: 11px;
            font-weight: bold;
            box-shadow: 0 0 16px ${isSelected ? "rgba(0,229,255,0.9)" : "rgba(0,0,0,0.7)"};
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

        // Bounding box rectangle
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

      // Fly to selected location
      const selectedLoc = locations.find((l) => l.location_id === selectedLocationId);
      if (selectedLoc) {
        map.flyTo([selectedLoc.latitude, selectedLoc.longitude], 8, {
          duration: 1.2,
        });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [locations, selectedLocationId, onSelectLocation]);

  // Handle map mode toggling
  const toggleMapMode = (mode: "satellite" | "tactical") => {
    setMapMode(mode);
    const map = mapInstanceRef.current;
    if (!map || !layersRef.current) return;

    const { satelliteLayers, tacticalLayer } = layersRef.current;

    if (mode === "satellite") {
      if (tacticalLayer && map.hasLayer(tacticalLayer)) {
        map.removeLayer(tacticalLayer);
      }
      if (satelliteLayers) {
        satelliteLayers.forEach((l) => {
          if (!map.hasLayer(l)) l.addTo(map);
        });
      }
    } else {
      if (satelliteLayers) {
        satelliteLayers.forEach((l) => {
          if (map.hasLayer(l)) map.removeLayer(l);
        });
      }
      if (tacticalLayer && !map.hasLayer(tacticalLayer)) {
        tacticalLayer.addTo(map);
      }
    }
  };

  const hasCartoKey = Boolean(process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim());

  return (
    <div className="relative w-full h-[330px] rounded-xl overflow-hidden border border-tactical-700 shadow-xl bg-tactical-900">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Layer Mode Switcher Controls */}
      <div className="absolute top-2.5 left-2.5 z-[25] flex items-center bg-tactical-900/90 backdrop-blur-md rounded-lg p-0.5 border border-tactical-700 shadow-lg text-[11px] font-mono">
        <button
          type="button"
          onClick={() => toggleMapMode("satellite")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            mapMode === "satellite"
              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-tactical-800"
          }`}
          title="High-Resolution Orbital Satellite Imagery"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>SATELLITE</span>
        </button>
        <button
          type="button"
          onClick={() => toggleMapMode("tactical")}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            mapMode === "tactical"
              ? "bg-cyan-500 text-slate-950 font-bold shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-tactical-800"
          }`}
          title={hasCartoKey ? "CartoDB Tactical Basemap" : "Tactical Basemap (OpenStreetMap Fallback)"}
        >
          <MapIcon className="w-3.5 h-3.5" />
          <span>TACTICAL</span>
        </button>
      </div>

      {/* Telemetry Badge */}
      <div className="absolute top-2.5 right-2.5 bg-tactical-900/85 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-[10px] font-mono text-cyan-300 z-[25] pointer-events-none flex items-center gap-1.5 shadow-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>
          {mapMode === "satellite"
            ? "CONTEXT MAP: ESRI WORLD IMAGERY • EPSG:4326"
            : hasCartoKey
            ? "CONTEXT MAP: CARTO VOYAGER • EPSG:4326"
            : "CONTEXT MAP: OPENSTREETMAP (FALLBACK) • EPSG:4326"}
        </span>
      </div>

      {/* Non-blocking notice if tactical active without CARTO key */}
      {mapMode === "tactical" && !hasCartoKey && (
        <div className="absolute bottom-2.5 left-2.5 z-[25] bg-tactical-950/90 border border-tactical-700 text-slate-400 px-2.5 py-1 rounded text-[10px] font-mono shadow pointer-events-none">
          Tactical Mode (OSM Fallback — CARTO API key not configured)
        </div>
      )}
    </div>
  );
}
