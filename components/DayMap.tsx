'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Map } from 'lucide-react';

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
  const [mapReady, setMapReady] = useState(false);

  // Filter activities with valid locations
  const validActivities = activities.filter(
    (a) => a.activity.location && a.activity.location.lat !== 0 && a.activity.location.lng !== 0
  );

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (validActivities.length === 0) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found');
      return;
    }

    mapboxgl.accessToken = token;

    // Calculate center
    const lats = validActivities.map((a) => a.activity.location!.lat);
    const lngs = validActivities.map((a) => a.activity.location!.lng);
    const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11', // Light style for paper theme
      center: [centerLng, centerLat],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [validActivities.length]);

  // Add markers and route when map is ready or activities change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const updateMap = () => {
      if (!map.current) return;

      // Check if style is loaded
      if (!map.current.isStyleLoaded()) {
        map.current.once('styledata', updateMap);
        return;
      }

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Remove existing route safely
      try {
        if (map.current.getLayer('route')) {
          map.current.removeLayer('route');
        }
        if (map.current.getSource('route')) {
          map.current.removeSource('route');
        }
      } catch (e) {
        console.warn('Error removing route:', e);
      }

      if (validActivities.length === 0) return;

      // Add markers
      validActivities.forEach((activity, index) => {
        const loc = activity.activity.location!;
        const isActive = activity.activity.id === activeActivityId;
        const isMeal = activity.type === 'meal';

        // Theme colors: Leather (#8B4513) active/meal, Nature (#556B2F) others
        const activeColor = '#8B4513'; // Leather
        const mealColor = '#556B2F'; // Nature (Olive)
        const defaultColor = '#5D5D5B'; // Graphite (Ink/grey)

        const markerColor = isMeal ? mealColor : (isActive ? activeColor : defaultColor);

        const el = document.createElement('div');
        el.style.cssText = `
          width: ${isActive ? '40px' : '32px'};
          height: ${isActive ? '40px' : '32px'};
          background: ${markerColor};
          border: 3px solid #F9F7F2; /* Paper color */
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #F9F7F2;
          font-weight: bold;
          font-family: 'Special Elite', monospace;
          font-size: ${isActive ? '16px' : '14px'};
          box-shadow: 0 4px 8px rgba(44, 44, 44, 0.3); /* Ink shadow */
          cursor: pointer;
          transition: all 0.2s ease;
        `;
        el.innerHTML = `${index + 1}`;

        el.addEventListener('click', () => {
          onMarkerClick?.(activity.activity.id);
        });

        const popup = new mapboxgl.Popup({ offset: 25, className: 'paper-popup' })
          .setHTML(`<div style="font-family: 'Cormorant Garamond', serif; font-weight: bold; color: #2C2C2C;">${activity.activity.name}</div>`);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(popup)
          .addTo(map.current!);

        markersRef.current.push(marker);
      });

      // Draw route line
      if (validActivities.length > 1) {
        const coordinates = validActivities.map((a) => [
          a.activity.location!.lng,
          a.activity.location!.lat,
        ]);

        try {
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
              'line-color': '#8B4513', // Leather color for route
              'line-width': 3,
              'line-opacity': 0.6,
              'line-dasharray': [2, 1], // Dashed line for "travel map" feel
            },
          });
        } catch (e) {
          console.warn('Error adding route:', e);
        }
      }

      // Fit bounds
      try {
        const bounds = new mapboxgl.LngLatBounds();
        validActivities.forEach((a) => {
          bounds.extend([a.activity.location!.lng, a.activity.location!.lat]);
        });
        map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      } catch (e) {
        console.warn('Error fitting bounds:', e);
      }
    };

    updateMap();

  }, [mapReady, validActivities, activeActivityId, onMarkerClick]);

  if (validActivities.length === 0) {
    return (
      <div className="w-full h-full bg-paper-card rounded-sm flex items-center justify-center border border-ink/10 shadow-inner">
        <div className="text-center p-4">
          <Map className="w-8 h-8 text-ink/20 mx-auto mb-2" />
          <p className="text-ink/60 text-sm font-serif italic">No location data</p>
          <p className="text-ink/40 text-xs mt-1 font-typewriter">This plan was created before map support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-sm overflow-hidden border border-ink/10 shadow-md relative">
      {/* Map Tape Effect */}
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#e8e6df]/90 backdrop-blur-sm -rotate-1 shadow-sm border border-white/20 z-10" />
      <div ref={mapContainer} className="w-full h-full grayscale-[0.2] sepia-[0.1]" />
    </div>
  );
}
