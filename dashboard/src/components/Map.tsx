"use client";

import React, { useEffect, useRef, useState } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { CONFIG } from "@/config";
import { useCrm } from "@/context/CrmContext";
import type { LiveEmployee } from "@/types";
import { LiveLocationStatus } from "@/types";
import { decodePolyline } from "@/utils";

const getMarkerColor = (status: LiveLocationStatus, isStale: boolean) => {
  if (isStale) return "#9E9E9E";
  switch (status) {
    case LiveLocationStatus.WORKING:
      return "#4CAF50";
    case LiveLocationStatus.ON_BREAK:
      return "#FF9800";
    case LiveLocationStatus.OFFLINE:
      return "#607D8B";
    case LiveLocationStatus.CHECKED_OUT:
      return "#F44336";
    default:
      return "#2196F3";
  }
};

export const Map = () => {
  const { employees, selectedEmployee, timeline } = useCrm();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const playbackMarkerRef = useRef<google.maps.Marker | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const initMap = () => {
      console.log("[Map] Initializing Google Maps...");
      console.log("[Map] API Key from config:", CONFIG.GOOGLE_MAPS_API_KEY ? `${CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : "NOT SET");
      
      // Use new @googlemaps/js-api-loader API
      (window as any).gm_authFailure = () => {
        console.error("[Map] Google Maps auth failed");
      };

      const scriptId = "google-maps-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=geometry&loading=async&callback=initGoogleMaps`;
        console.log("[Map] Loading Google Maps script from:", scriptUrl);
        script.src = scriptUrl;
        (window as any).initGoogleMaps = () => {
          console.log("[Map] Google Maps loaded successfully!");
          if (mapRef.current) {
            const map = new google.maps.Map(mapRef.current, {
              zoom: 12,
              center: { lat: 40.7128, lng: -74.006 },
            });
            mapInstanceRef.current = map;
            setMapsLoaded(true);
          }
        };
        document.body.appendChild(script);
      } else if (typeof google !== "undefined" && google.maps && mapRef.current) {
        console.log("[Map] Google Maps already loaded, creating map...");
        // If already loaded
        const map = new google.maps.Map(mapRef.current, {
          zoom: 12,
          center: { lat: 40.7128, lng: -74.006 },
        });
        mapInstanceRef.current = map;
        setMapsLoaded(true);
      }
    };
    initMap();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    employees.forEach((emp) => {
      const marker = new google.maps.Marker({
        position: {
          lat: emp.lastLocation.latitude,
          lng: emp.lastLocation.longitude,
        },
        map: mapInstanceRef.current!,
        title: emp.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: getMarkerColor(emp.status, emp.isStale),
          fillOpacity: emp.isStale ? 0.5 : 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 10,
        },
      });
      markersRef.current.push(marker);
    });

    if (clustererRef.current) clustererRef.current.clearMarkers();
    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current!,
      markers: markersRef.current,
    });

    if (employees.length > 0 && !selectedEmployee) {
      const bounds = new google.maps.LatLngBounds();
      employees.forEach((emp) =>
        bounds.extend(
          new google.maps.LatLng(
            emp.lastLocation.latitude,
            emp.lastLocation.longitude
          )
        )
      );
      mapInstanceRef.current?.fitBounds(bounds);
    }
  }, [employees, selectedEmployee, mapsLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !timeline || !mapsLoaded) {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.setMap(null);
        playbackMarkerRef.current = null;
      }
      return;
    }

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const polyline = showRaw
      ? timeline.processedRoute?.encodedRawPolyline
      : timeline.processedRoute?.encodedProcessedPolyline;
    if (polyline) {
      const path = decodePolyline(polyline).map(([lat, lng]) => ({ lat, lng }));
      const poly = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#2196F3",
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
      poly.setMap(mapInstanceRef.current);
      polylinesRef.current.push(poly);

      const bounds = new google.maps.LatLngBounds();
      path.forEach((p) => bounds.extend(new google.maps.LatLng(p.lat, p.lng)));
      mapInstanceRef.current?.fitBounds(bounds);

      playbackMarkerRef.current = new google.maps.Marker({
        position: path[0],
        map: mapInstanceRef.current,
        title: "Playback",
      });
    }
  }, [timeline, showRaw, mapsLoaded]);

  return (
    <div className="flex-1 h-full relative">
      <div ref={mapRef} className="w-full h-full" />
      {selectedEmployee && timeline && (
        <div className="absolute top-4 right-4 bg-white p-3 rounded-md shadow-md flex items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={showRaw}
              onChange={(e) => setShowRaw(e.target.checked)}
            />
            Show Raw Path
          </label>
        </div>
      )}
    </div>
  );
};
