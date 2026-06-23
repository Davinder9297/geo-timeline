"use client";

import React, { useEffect, useRef, useState } from "react";
import { CONFIG } from "@/config";
import type { RawLocationPoint, TimelineResponse } from "@/types";
import { decodePolyline, getSessionColor } from "@/utils";

declare global {
  interface Window {
    gm_authFailure?: () => void;
    initTrackerGoogleMaps?: () => void;
    google?: any;
  }
}

const buildPathSegments = (
  path: { lat: number; lng: number }[],
  maxDistanceMeters = 250,
): { lat: number; lng: number }[][] => {
  const segments: { lat: number; lng: number }[][] = [];
  let currentSegment: { lat: number; lng: number }[] = [];

  const googleObj = (window as any).google;
  const distanceBetween = (
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ) => {
    if (!googleObj?.maps?.geometry?.spherical?.computeDistanceBetween) {
      const latDiff = a.lat - b.lat;
      const lngDiff = a.lng - b.lng;
      return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111_000;
    }
    return googleObj.maps.geometry.spherical.computeDistanceBetween(
      new googleObj.maps.LatLng(a.lat, a.lng),
      new googleObj.maps.LatLng(b.lat, b.lng),
    );
  };

  for (let i = 0; i < path.length; i += 1) {
    const point = path[i];
    if (currentSegment.length === 0) {
      currentSegment.push(point);
      continue;
    }
    const prev = currentSegment[currentSegment.length - 1];
    const distance = distanceBetween(prev, point);
    if (distance > maxDistanceMeters) {
      if (currentSegment.length > 1) segments.push(currentSegment);
      currentSegment = [point];
    } else {
      currentSegment.push(point);
    }
  }
  if (currentSegment.length > 1) segments.push(currentSegment);
  return segments;
};

interface TrackerMapProps {
  timeline: TimelineResponse | null;
  selectedSessionId: string | null;
  currentLocation: { lat: number; lng: number } | null;
  viewMode: "route" | "sequence";
}

export const TrackerMap = ({
  timeline,
  selectedSessionId,
  currentLocation,
  viewMode,
}: TrackerMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const sequenceMarkersRef = useRef<any[]>([]);
  const liveMarkerRef = useRef<any>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const initMap = () => {
      window.gm_authFailure = () => {
        console.error("[TrackerMap] Google Maps auth failed");
      };

      const scriptId = "google-maps-script";
      const createMap = () => {
        const googleObj = (window as any).google;
        if (mapRef.current && googleObj) {
          const map = new googleObj.maps.Map(mapRef.current, {
            zoom: 14,
            center: { lat: 20.5937, lng: 78.9629 },
            ...(CONFIG.GOOGLE_MAPS_MAP_ID ? { mapId: CONFIG.GOOGLE_MAPS_MAP_ID } : {}),
          });
          mapInstanceRef.current = map;
          setMapsLoaded(true);
        }
      };

      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=geometry,marker&loading=async&callback=initTrackerGoogleMaps`;
        window.initTrackerGoogleMaps = createMap;
        document.body.appendChild(script);
      } else if ((window as any).google?.maps) {
        createMap();
      }
    };
    initMap();
  }, []);

  // Draw session route(s)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    sequenceMarkersRef.current.forEach((m) => (m.map = null));
    sequenceMarkersRef.current = [];

    if (!timeline) return;

    const rawPoints = timeline.rawPoints || [];
    const sessionOrder: string[] = [];
    rawPoints.forEach((p: RawLocationPoint) => {
      if (p.sessionId && !sessionOrder.includes(p.sessionId)) sessionOrder.push(p.sessionId);
    });

    const googleObj = (window as any).google;
    const bounds = new googleObj.maps.LatLngBounds();
    let hasBounds = false;

    const pointsToRender = selectedSessionId
      ? rawPoints.filter((p: RawLocationPoint) => p.sessionId === selectedSessionId)
      : rawPoints;

    if (pointsToRender.length > 0) {
      const sessionIdx = selectedSessionId ? sessionOrder.indexOf(selectedSessionId) : 0;
      const color = getSessionColor(sessionIdx >= 0 ? sessionIdx : 0);
      const path = pointsToRender.map((p: RawLocationPoint) => ({ lat: p.latitude, lng: p.longitude }));
      const segments = buildPathSegments(path, 250);

      segments.forEach((segment) => {
        const polyline = new googleObj.maps.Polyline({
          path: segment,
          geodesic: true,
          strokeColor: color,
          strokeOpacity: 0.85,
          strokeWeight: 4,
        });
        polyline.setMap(mapInstanceRef.current);
        polylinesRef.current.push(polyline);
        segment.forEach((p) => {
          bounds.extend(new googleObj.maps.LatLng(p.lat, p.lng));
          hasBounds = true;
        });
      });

      if (viewMode === "sequence") {
        pointsToRender.forEach((point: RawLocationPoint) => {
          const el = document.createElement("div");
          el.style.width = "26px";
          el.style.height = "26px";
          el.style.borderRadius = "50%";
          el.style.backgroundColor = color;
          el.style.color = "white";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.fontSize = "10px";
          el.style.fontWeight = "bold";
          el.style.border = "2px solid white";
          el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
          el.textContent = point.sequenceNo.toString();
          el.title = `Point #${point.sequenceNo} - ${new Date(point.capturedAt).toLocaleString()}`;

          const marker = new googleObj.maps.marker.AdvancedMarkerElement({
            position: { lat: point.latitude, lng: point.longitude },
            map: mapInstanceRef.current,
            content: el,
          });
          sequenceMarkersRef.current.push(marker);
        });
      }
    } else if (timeline.processedRoute?.encodedProcessedPolyline) {
      const path = decodePolyline(timeline.processedRoute.encodedProcessedPolyline).map(
        ([lat, lng]) => ({ lat, lng })
      );
      const segments = buildPathSegments(path, 250);
      segments.forEach((segment) => {
        const polyline = new googleObj.maps.Polyline({
          path: segment,
          geodesic: true,
          strokeColor: "#2196F3",
          strokeOpacity: 0.8,
          strokeWeight: 4,
        });
        polyline.setMap(mapInstanceRef.current);
        polylinesRef.current.push(polyline);
        segment.forEach((p) => {
          bounds.extend(new googleObj.maps.LatLng(p.lat, p.lng));
          hasBounds = true;
        });
      });
    }

    if (hasBounds) {
      mapInstanceRef.current.fitBounds(bounds);
    }
  }, [timeline, selectedSessionId, viewMode, mapsLoaded]);

  // Live "you are here" marker
  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;

    if (!currentLocation) {
      if (liveMarkerRef.current) {
        liveMarkerRef.current.map = null;
        liveMarkerRef.current = null;
      }
      return;
    }

    const googleObj = (window as any).google;

    if (!liveMarkerRef.current) {
      const el = document.createElement("div");
      el.style.width = "18px";
      el.style.height = "18px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = "#2563eb";
      el.style.border = "3px solid white";
      el.style.boxShadow = "0 0 0 4px rgba(37,99,235,0.25)";
      el.title = "You are here";

      liveMarkerRef.current = new googleObj.maps.marker.AdvancedMarkerElement({
        position: currentLocation,
        map: mapInstanceRef.current,
        content: el,
        zIndex: 9999,
      });

      // Center on first live fix if nothing else has set bounds yet.
      if (polylinesRef.current.length === 0) {
        mapInstanceRef.current.setCenter(currentLocation);
      }
    } else {
      liveMarkerRef.current.position = currentLocation;
    }
  }, [currentLocation, mapsLoaded]);

  const goToLiveLocation = () => {
    if (!mapInstanceRef.current || !currentLocation) return;
    mapInstanceRef.current.panTo(currentLocation);
    mapInstanceRef.current.setZoom(17);
  };

  return (
    <div className="absolute inset-0">
      <div ref={mapRef} className="absolute inset-0" />
      {currentLocation && (
        <button
          onClick={goToLiveLocation}
          title="Go to my live location"
          className="absolute bottom-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-slate-950/80 backdrop-blur border border-white/10 shadow-lg text-blue-400 hover:text-blue-300 hover:border-white/20 cursor-pointer transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
};
