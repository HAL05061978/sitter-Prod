/**
 * LocationMap Component
 *
 * Displays real-time location of care provider on a map
 * Note: This component is dynamically loaded client-side only to avoid SSR issues
 */

'use client';

import { useEffect, useState } from 'react';
import { LocationUpdate } from '../../app/services/locationTracking';

interface LocationMapProps {
  location: LocationUpdate | null;
  providerName?: string;
  height?: string;
  showAccuracy?: boolean;
  zoomLevel?: number;
}

export default function LocationMap({
  location,
  providerName = 'Care Provider',
  height = '400px',
  showAccuracy = true,
  zoomLevel = 15
}: LocationMapProps) {
  const [MapComponents, setMapComponents] = useState<any>(null);
  const [leaflet, setLeaflet] = useState<any>(null);

  useEffect(() => {
    // Only load map libraries on client side
    if (typeof window !== 'undefined') {
      Promise.all([
        import('react-leaflet'),
        import('leaflet'),
        import('leaflet/dist/leaflet.css')
      ]).then(([reactLeaflet, L]) => {
        // Fix default marker icon
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        setMapComponents(reactLeaflet);
        setLeaflet(L);
      });
    }
  }, []);

  // Loading state
  if (!MapComponents) {
    return (
      <div
        style={{ height }}
        className="bg-gray-100 rounded-lg flex items-center justify-center"
      >
        <p className="text-gray-500">Loading map...</p>
      </div>
    );
  }

  // No location state
  if (!location) {
    return (
      <div
        style={{ height }}
        className="bg-gray-100 rounded-lg flex items-center justify-center"
      >
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="mt-2 text-gray-500">No location data available</p>
          <p className="text-sm text-gray-400">Waiting for location updates...</p>
        </div>
      </div>
    );
  }

  const center: [number, number] = [location.latitude, location.longitude];
  const lastUpdateTime = new Date(location.timestamp).toLocaleTimeString();

  const { MapContainer, TileLayer, Marker, Popup } = MapComponents;

  return (
    <div className="relative">
      <MapContainer
        center={center}
        zoom={zoomLevel}
        style={{ height, width: '100%' }}
        className="rounded-lg z-0"
        key={`${location.latitude}-${location.longitude}`}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={center}>
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{providerName}</p>
              <p className="text-gray-600 text-xs mt-1">
                Last updated: {lastUpdateTime}
              </p>
              {showAccuracy && location.accuracy && (
                <p className="text-gray-500 text-xs">
                  Accuracy: ±{Math.round(location.accuracy)}m
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Info overlay */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg px-4 py-2 z-10">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <div>
            <p className="text-sm font-medium text-gray-900">Live Tracking</p>
            <p className="text-xs text-gray-500">{lastUpdateTime}</p>
          </div>
        </div>
        {showAccuracy && location.accuracy && (
          <p className="text-xs text-gray-400 mt-1">
            Accuracy: ±{Math.round(location.accuracy)}m
          </p>
        )}
      </div>

      {/* Speed indicator (if available) */}
      {location.speed && location.speed > 0 && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg px-3 py-2 z-10">
          <p className="text-xs text-gray-500">Speed</p>
          <p className="text-sm font-semibold text-gray-900">
            {(location.speed * 3.6).toFixed(1)} km/h
          </p>
        </div>
      )}
    </div>
  );
}
