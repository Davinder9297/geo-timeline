"use client";

import React, { useEffect, useRef, useState } from "react";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { CONFIG } from "@/config";
import { useCrm } from "@/context/CrmContext";
import { LiveLocationStatus, RawLocationPoint } from "@/types";
import { decodePolyline, getSessionColor } from "@/utils";

declare global {
  interface Window {
    gm_authFailure?: () => void;
    initGoogleMaps?: () => void;
    google?: any;
  }
}

declare const google: any;

const getMarkerColor = (status: LiveLocationStatus, isStale: boolean) => {
  // Staleness only matters while someone is supposed to be active — once
  // checked out, going stale is expected, so don't let it mask the
  // CHECKED_OUT color (mirrors the same rule in LeftPanel.tsx).
  if (isStale && status !== LiveLocationStatus.CHECKED_OUT) return "#9E9E9E";
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
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [point];
    } else {
      currentSegment.push(point);
    }
  }

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  return segments;
};

export const Map = () => {
  const { employees, selectedEmployee, timeline, playbackTime, selectedSessionId } = useCrm();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const polylinesRef = useRef<any[]>([]);
  const playbackMarkerRef = useRef<any>(null);
  const sequenceMarkersRef = useRef<any[]>([]);
  const rawPointsRef = useRef<RawLocationPoint[]>([]);
  const [viewMode, setViewMode] = useState<"route" | "sequence">("route");
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const initMap = () => {
      console.log("[Map] Initializing Google Maps...");
      console.log("[Map] API Key from config:", CONFIG.GOOGLE_MAPS_API_KEY ? `${CONFIG.GOOGLE_MAPS_API_KEY.substring(0, 10)}...` : "NOT SET");
      
      // Use new @googlemaps/js-api-loader API
      window.gm_authFailure = () => {
        console.error("[Map] Google Maps auth failed");
      };

      const scriptId = "google-maps-script";
      if (!document.getElementById(scriptId)) {
        const script = document.createElement("script");
        script.id = scriptId;
        const scriptUrl = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_MAPS_API_KEY}&libraries=geometry,marker&loading=async&callback=initGoogleMaps`;
        console.log("[Map] Loading Google Maps script from:", scriptUrl);
        script.src = scriptUrl;
        window.initGoogleMaps = () => {
          console.log("[Map] Google Maps loaded successfully!");
          const googleObj = (window as any).google;
          if (mapRef.current && googleObj) {
            const map = new googleObj.maps.Map(mapRef.current, {
              zoom: 12,
              center: { lat: 40.7128, lng: -74.006 },
              ...(CONFIG.GOOGLE_MAPS_MAP_ID ? { mapId: CONFIG.GOOGLE_MAPS_MAP_ID } : {}),
            });
            mapInstanceRef.current = map;
            setMapsLoaded(true);
          }
        };
        document.body.appendChild(script);
      } else {
        const googleObj = (window as any).google;
        if (googleObj?.maps && mapRef.current) {
          console.log("[Map] Google Maps already loaded, creating map...");
          const map = new googleObj.maps.Map(mapRef.current, {
            zoom: 12,
            center: { lat: 40.7128, lng: -74.006 },
            ...(CONFIG.GOOGLE_MAPS_MAP_ID ? { mapId: CONFIG.GOOGLE_MAPS_MAP_ID } : {}),
          });
          mapInstanceRef.current = map;
          setMapsLoaded(true);
        }
      }
    };
    initMap();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current || !mapsLoaded) return;
    markersRef.current.forEach((m) => m.map = null);
    markersRef.current = [];

    employees.forEach((emp) => {
      const markerElement = document.createElement("div");
      markerElement.style.width = "20px";
      markerElement.style.height = "20px";
      markerElement.style.borderRadius = "50%";
      markerElement.style.backgroundColor = getMarkerColor(emp.status, emp.isStale);
      markerElement.style.opacity = emp.isStale ? "0.5" : "1";
      markerElement.style.border = "2px solid white";
      markerElement.title = emp.name;

      const googleObj = (window as any).google;
      const marker = new googleObj.maps.marker.AdvancedMarkerElement({
        position: {
          lat: emp.lastLocation.latitude,
          lng: emp.lastLocation.longitude,
        },
        map: mapInstanceRef.current!,
        content: markerElement,
      });
      markersRef.current.push(marker);
    });

    if (clustererRef.current) clustererRef.current.clearMarkers();
    clustererRef.current = new MarkerClusterer({
      map: mapInstanceRef.current!,
      markers: markersRef.current,
    });

    if (employees.length > 0 && !selectedEmployee) {
      const googleObj = (window as any).google;
      const bounds = new googleObj.maps.LatLngBounds();
      employees.forEach((emp) =>
        bounds.extend(
          new googleObj.maps.LatLng(
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
      sequenceMarkersRef.current.forEach((m) => (m.map = null));
      sequenceMarkersRef.current = [];
      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.map = null;
        playbackMarkerRef.current = null;
      }
      return;
    }

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];
    sequenceMarkersRef.current.forEach((m) => (m.map = null));
    sequenceMarkersRef.current = [];

    const rawPoints = timeline.rawPoints || [];
    rawPointsRef.current = rawPoints;

    // Determine session order chronologically (first appearance in rawPoints,
    // falling back to attendance.sessions order if rawPoints lack a session).
    const sessionOrder: string[] = [];
    rawPoints.forEach((p: RawLocationPoint) => {
      if (p.sessionId && !sessionOrder.includes(p.sessionId)) {
        sessionOrder.push(p.sessionId);
      }
    });
    const sessionColor = (sessionId: string | undefined) => {
      const idx = sessionId ? sessionOrder.indexOf(sessionId) : -1;
      return getSessionColor(idx >= 0 ? idx : 0);
    };

    const googleObj = (window as any).google;
    const bounds = new googleObj.maps.LatLngBounds();
    let firstPathPoint: { lat: number; lng: number } | null = null;

    if (rawPoints.length > 0 && sessionOrder.length > 0) {
      // Draw one polyline group per session, each in its own color.
      sessionOrder.forEach((sessionId, idx) => {
        const sessionPoints = rawPoints.filter((p: RawLocationPoint) => p.sessionId === sessionId);
        const path = sessionPoints.map((p: RawLocationPoint) => ({ lat: p.latitude, lng: p.longitude }));
        if (path.length === 0) return;
        if (!firstPathPoint) firstPathPoint = path[0];

        const segments = buildPathSegments(path, 250);
        const isDimmed = !!selectedSessionId && selectedSessionId !== sessionId;
        const color = sessionColor(sessionId);

        segments.forEach((segment) => {
          const segmentPolyline = new googleObj.maps.Polyline({
            path: segment,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: isDimmed ? 0.25 : 0.85,
            strokeWeight: 4,
          });
          segmentPolyline.setMap(mapInstanceRef.current);
          polylinesRef.current.push(segmentPolyline);
          segment.forEach((p) => bounds.extend(new googleObj.maps.LatLng(p.lat, p.lng)));
        });

        if (viewMode === "sequence") {
          sessionPoints.forEach((point: RawLocationPoint) => {
            const markerElement = document.createElement("div");
            markerElement.style.width = "28px";
            markerElement.style.height = "28px";
            markerElement.style.borderRadius = "50%";
            markerElement.style.backgroundColor = color;
            markerElement.style.opacity = isDimmed ? "0.35" : "1";
            markerElement.style.color = "white";
            markerElement.style.display = "flex";
            markerElement.style.alignItems = "center";
            markerElement.style.justifyContent = "center";
            markerElement.style.fontSize = "11px";
            markerElement.style.fontWeight = "bold";
            markerElement.style.border = "2px solid white";
            markerElement.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
            markerElement.textContent = point.sequenceNo.toString();
            markerElement.title = `Session ${idx + 1} · Point #${point.sequenceNo} - ${new Date(point.capturedAt).toLocaleString()}`;

            const marker = new googleObj.maps.marker.AdvancedMarkerElement({
              position: { lat: point.latitude, lng: point.longitude },
              map: mapInstanceRef.current,
              content: markerElement,
            });
            sequenceMarkersRef.current.push(marker);
          });
        }
      });
    } else {
      // Fallback: no per-point sessionId available, use processed/raw encoded polyline as a single route.
      const polyline = timeline.processedRoute?.encodedProcessedPolyline;
      if (polyline) {
        const path = decodePolyline(polyline).map(([lat, lng]) => ({ lat, lng }));
        firstPathPoint = path[0] || null;
        const segments = buildPathSegments(path, 250);
        segments.forEach((segment) => {
          const segmentPolyline = new googleObj.maps.Polyline({
            path: segment,
            geodesic: true,
            strokeColor: "#2196F3",
            strokeOpacity: 0.8,
            strokeWeight: 4,
          });
          segmentPolyline.setMap(mapInstanceRef.current);
          polylinesRef.current.push(segmentPolyline);
          segment.forEach((p) => bounds.extend(new googleObj.maps.LatLng(p.lat, p.lng)));
        });
      }
    }

    if (!bounds.isEmpty()) {
      mapInstanceRef.current?.fitBounds(bounds);
    }

    if (firstPathPoint) {
      // Create playback marker and ensure it's on top
      const playbackMarkerElement = document.createElement("div");
      playbackMarkerElement.style.width = "20px";
      playbackMarkerElement.style.height = "20px";
      playbackMarkerElement.style.borderRadius = "50%";
      playbackMarkerElement.style.backgroundColor = "#2196F3";
      playbackMarkerElement.style.border = "2px solid white";
      playbackMarkerElement.title = "Playback";
      playbackMarkerElement.style.position = "relative";
      playbackMarkerElement.style.zIndex = "9999";

      playbackMarkerRef.current = new googleObj.maps.marker.AdvancedMarkerElement({
        position: firstPathPoint,
        map: mapInstanceRef.current,
        content: playbackMarkerElement,
        zIndex: 9999,
      });

      // Reinforce marker visibility after a short delay since map panes
      // or other markers may still be initializing on first load.
      setTimeout(() => {
        try {
          if (playbackMarkerRef.current) {
            playbackMarkerRef.current.map = mapInstanceRef.current;
            if (playbackMarkerRef.current.content instanceof HTMLElement) {
              playbackMarkerRef.current.content.style.zIndex = '9999';
            }
          }
        } catch (e) {
          // ignore
        }
      }, 150);
    }
  }, [timeline, viewMode, selectedSessionId, mapsLoaded]);

  useEffect(() => {
    if (!timeline || !playbackMarkerRef.current || rawPointsRef.current.length === 0) {
      return;
    }

    const points = rawPointsRef.current;
    const firstTime = new Date(points[0].capturedAt).getTime();
    const targetTime = firstTime + playbackTime * 1000;

    let nearest = points[0];
    for (let i = 0; i < points.length; i += 1) {
      const pointTime = new Date(points[i].capturedAt).getTime();
      if (pointTime <= targetTime) {
        nearest = points[i];
      } else {
        break;
      }
    }

    playbackMarkerRef.current.position = {
      lat: nearest.latitude,
      lng: nearest.longitude,
    };
    if (playbackMarkerRef.current.content instanceof HTMLElement) {
      playbackMarkerRef.current.content.title = `Playback - Seq ${nearest.sequenceNo}`;
    }
  }, [playbackTime, timeline]);

  const sessionLegend = React.useMemo(() => {
    const rawPoints = timeline?.rawPoints || [];
    const order: string[] = [];
    rawPoints.forEach((p: RawLocationPoint) => {
      if (p.sessionId && !order.includes(p.sessionId)) order.push(p.sessionId);
    });
    return order;
  }, [timeline]);

  return (
    <div className="flex-1 h-full relative">
      <div ref={mapRef} className="w-full h-full" />
      {selectedEmployee && timeline && (
        <div className="absolute top-4 right-4 bg-white dark:bg-slate-900 p-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 flex flex-col gap-3 min-w-[180px]">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode("route")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                viewMode === "route"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Route
            </button>
            <button
              onClick={() => setViewMode("sequence")}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                viewMode === "sequence"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              Sequence
            </button>
          </div>

          {sessionLegend.length > 1 && (
            <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-2">
              {sessionLegend.map((sessionId, idx) => (
                <div key={sessionId} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: getSessionColor(idx) }}
                  />
                  Session {idx + 1}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
