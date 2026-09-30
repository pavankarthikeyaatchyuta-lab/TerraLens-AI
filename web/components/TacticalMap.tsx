"use client";

import React, { useEffect, useRef } from "react";
import { Location } from "@/types";

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

      if (!mapInstanceRef.current) {
        // Initialize map centered on India
        const map = L.map(mapContainerRef.current, {
          center: [20.5937, 78.9629],
          zoom: 5,
          zoomControl: true,
          attributionControl: false,
        });

        // Dark tactical CartoDB basemap
        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            subdomains: "abcd",
          }
        ).addTo(map);

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
            width: ${isSelected ? "32px" : "24px"};
            height: ${isSelected ? "32px" : "24px"};
            border-radius: 50%;
            background: ${isSelected ? "#00e5ff" : "#1e293b"};
            border: 2px solid ${isSelected ? "#ffffff" : "#00e5ff"};
            color: ${isSelected ? "#090d16" : "#00e5ff"};
            font-size: 11px;
            font-weight: bold;
            box-shadow: 0 0 14px ${isSelected ? "rgba(0,229,255,0.8)" : "rgba(0,0,0,0.5)"};
            cursor: pointer;
            transition: all 0.2s ease;
          ">
            ${loc.location_id.split("_")[1] || "LOC"}
          </div>
        `;

        const divIcon = L.divIcon({
          html: customMarkerHtml,
          className: "tactical-marker",
          iconSize: isSelected ? [32, 32] : [24, 24],
          iconAnchor: isSelected ? [16, 16] : [12, 12],
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
            color: isSelected ? "#00e5ff" : "#475569",
            weight: isSelected ? 2 : 1,
            fillColor: isSelected ? "#00e5ff" : "#334155",
            fillOpacity: isSelected ? 0.25 : 0.08,
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

  return (
    <div className="relative w-full h-[320px] rounded-xl overflow-hidden border border-tactical-700 shadow-xl bg-tactical-900">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute top-2 right-2 bg-tactical-900/85 backdrop-blur-md px-2.5 py-1 rounded border border-tactical-700 text-[10px] font-mono text-cyan-300 z-[1000] pointer-events-none">
        MAP TELEMETRY: CARTO-VOYAGER / EPSG:4326
      </div>
    </div>
  );
}
