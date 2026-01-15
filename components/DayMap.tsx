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
      style: 'mapbox://styles/mapbox/dark-v11',
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
        // Wait for style to load
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

        const el = document.createElement('div');
        el.style.cssText = `
          width: ${isActive ? '40px' : '32px'};
          height: ${isActive ? '40px' : '32px'};
          background: ${isMeal ? '#22c55e' : '#a855f7'};
          border: 3px solid ${isActive ? '#fff' : 'rgba(255,255,255,0.6)'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: ${isActive ? '16px' : '14px'};
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          cursor: pointer;
          transition: all 0.2s ease;
        `;
        el.innerHTML = `${index + 1}`;

        el.addEventListener('click', () => {
          onMarkerClick?.(activity.activity.id);
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([loc.lng, loc.lat])
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<strong>${activity.activity.name}</strong>`))
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
              'line-color': '#a855f7',
              'line-width': 4,
              'line-opacity': 0.8,
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
      <div className="w-full h-full bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
        <div className="text-center p-4">
          <Map className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">No location data</p>
          <p className="text-white/30 text-xs mt-1">This plan was created before map support.</p>
          <p className="text-purple-400 text-xs mt-2">Generate a new plan to see the route!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10">
      <div ref={mapContainer} className="w-full h-full" />
    </div>
  );
}
