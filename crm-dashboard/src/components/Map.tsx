import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { CONFIG } from '../config';
import { useCrm } from '../contexts/CrmContext';
import { LiveLocationStatus } from '../types';
import { decodePolyline } from '../utils';

declare var google: any;

const getMarkerColor = (status: LiveLocationStatus, isStale: boolean): string => {
  if (isStale) return '#9E9E9E';
  switch (status) {
    case LiveLocationStatus.WORKING:
      return '#4CAF50';
    case LiveLocationStatus.ON_BREAK:
      return '#FF9800';
    case LiveLocationStatus.OFFLINE:
      return '#607D8B';
    case LiveLocationStatus.CHECKED_OUT:
      return '#F44336';
    default:
      return '#2196F3';
  }
};

export const Map: React.FC = () => {
  const { employees, selectedEmployee, timeline } = useCrm();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const clustererRef = useRef<any>(null);
  const polylinesRef = useRef<any[]>([]);
  const playbackMarkerRef = useRef<any>(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: CONFIG.GOOGLE_MAPS_API_KEY,
        version: 'weekly',
        libraries: ['geometry'],
      }) as any;
      const googleObj = await loader.load();
      const map = new googleObj.maps.Map(mapRef.current!, {
        zoom: 12,
        center: { lat: 40.7128, lng: -74.006 }, // Default to NYC
      });
      mapInstanceRef.current = map;
      mapInstanceRef.current.google = googleObj;
    };
    initMap();
  }, []);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const googleObj = mapInstanceRef.current.google;

    employees.forEach(emp => {
      const marker = new googleObj.maps.Marker({
        position: { lat: emp.lastLocation.latitude, lng: emp.lastLocation.longitude },
        map: mapInstanceRef.current!,
        title: emp.name,
        icon: {
          path: googleObj.maps.SymbolPath.CIRCLE,
          fillColor: getMarkerColor(emp.status, emp.isStale),
          fillOpacity: emp.isStale ? 0.5 : 1,
          strokeColor: '#ffffff',
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
      const bounds = new googleObj.maps.LatLngBounds();
      employees.forEach(emp =>
        bounds.extend(new googleObj.maps.LatLng(emp.lastLocation.latitude, emp.lastLocation.longitude))
      );
      mapInstanceRef.current?.fitBounds(bounds);
    }
  }, [employees, selectedEmployee]);

  useEffect(() => {
    if (!mapInstanceRef.current || !timeline) {
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
      if (playbackMarkerRef.current) {
        playbackMarkerRef.current.setMap(null);
        playbackMarkerRef.current = null;
      }
      return;
    }

    const googleObj = mapInstanceRef.current.google;

    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    const polyline = showRaw
      ? timeline.processedRoute?.encodedRawPolyline
      : timeline.processedRoute?.encodedProcessedPolyline;
    if (polyline) {
      const path = decodePolyline(polyline).map(([lat, lng]) => ({ lat, lng }));
      const poly = new googleObj.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#2196F3',
        strokeOpacity: 0.8,
        strokeWeight: 4,
      });
      poly.setMap(mapInstanceRef.current);
      polylinesRef.current.push(poly);

      const bounds = new googleObj.maps.LatLngBounds();
      path.forEach(p => bounds.extend(new googleObj.maps.LatLng(p.lat, p.lng)));
      mapInstanceRef.current?.fitBounds(bounds);

      playbackMarkerRef.current = new googleObj.maps.Marker({
        position: path[0],
        map: mapInstanceRef.current,
        title: 'Playback',
      });
    }
  }, [timeline, showRaw]);

  return (
    <div style={{ flex: 1, height: '100%', position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {selectedEmployee && timeline && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'white',
            padding: '10px',
            borderRadius: '4px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <label style={{ fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={showRaw}
              onChange={e => setShowRaw(e.target.checked)}
              style={{ marginRight: '6px' }}
            />
            Show Raw Path
          </label>
        </div>
      )}
    </div>
  );
};
