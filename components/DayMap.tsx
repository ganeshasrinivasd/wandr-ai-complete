'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Activity {
  activity: {
    id: string;
    name: string;
    location?: {
      lat: number;
      lng: number;
    };
  };
  type: string;
}

interface DayMapProps {
  activities: Activity[];
  onMarkerClick?: (activityId: string) => void;
  activeActivityId?: string;
}

export default function DayMap({ activities, onMarkerClick, activeActivityId }: DayMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Filter activities with valid locations
  const validActivities = activities.filter(
    (a) => a.activity.location?.lat && a.activity.location?.lng
  );

  useEffect(() => {
    if (!mapContainer.current || validActivities.length === 0) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

    // Calculate center from all activities
    const lats = validActivities.map((a) => a.activity.location!.lat);
    const lngs = validActivities.map((a) => a.activity.location!.lng);
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [centerLng, centerLat],
      zoom: 12,
    });

    map.current.on('load', () => {
      setMapLoaded(true);
      addMarkersAndRoute();
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.current?.remove();
    };
  }, []);

  // Update markers when activities change
  useEffect(() => {
    if (mapLoaded && map.current) {
      addMarkersAndRoute();
    }
  }, [activities, mapLoaded, activeActivityId]);

  const addMarkersAndRoute = () => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove existing route layer
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add markers for each activity
    validActivities.forEach((activity, index) => {
      const loc = activity.activity.location!;
      const isActive = activity.activity.id === activeActivityId;
      const isMeal = activity.type === 'meal';

      // Create custom marker element
      const el = document.createElement('div');
      el.className = 'custom-marker';
      el.innerHTML = `
        <div style="
          width: ${isActive ? '36px' : '28px'};
          height: ${isActive ? '36px' : '28px'};
          background: ${isMeal ? '#22c55e' : '#a855f7'};
          border: 3px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.5)'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${isActive ? '14px' : '12px'};
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          cursor: pointer;
          transition: all 0.2s ease;
        ">
          ${index + 1}
        </div>
      `;

      el.addEventListener('click', () => {
        onMarkerClick?.(activity.activity.id);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });

    // Draw route line connecting activities
    if (validActivities.length > 1) {
      const coordinates = validActivities.map((a) => [
        a.activity.location!.lng,
        a.activity.location!.lat,
      ]);

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#a855f7',
          'line-width': 3,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2],
        },
      });
    }

    // Fit bounds to show all markers
    if (validActivities.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      validActivities.forEach((a) => {
        bounds.extend([a.activity.location!.lng, a.activity.location!.lat]);
      });
      map.current.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  };

  if (validActivities.length === 0) {
    return (
      <div className="w-full h-full bg-white/5 rounded-2xl flex items-center justify-center">
        <p className="text-white/40 text-sm">No location data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
