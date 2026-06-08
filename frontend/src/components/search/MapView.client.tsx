'use client';

import React, { useCallback, useMemo } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { PropertySummary } from '@/types';

interface Viewport {
  longitude: number;
  latitude: number;
  zoom: number;
}

export interface MapViewClientProps {
  properties: PropertySummary[];
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  onPropertyHover: (propertyId: string | null) => void;
  onPropertyClick: (propertyId: string) => void;
  hoveredPropertyId?: string;
  selectedPropertyId?: string;
}

/**
 * MapViewClient Component (Internal)
 *
 * Actual implementation of the MapView using react-map-gl.
 * This is separated to avoid import issues during testing.
 */
export function MapViewClient({
  properties,
  viewport,
  onViewportChange,
  onPropertyHover,
  onPropertyClick,
  hoveredPropertyId,
  selectedPropertyId,
}: MapViewClientProps) {
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

  const handleViewportChange = useCallback(
    (newViewport: Viewport) => {
      onViewportChange(newViewport);
    },
    [onViewportChange]
  );

  const handleMarkerClick = useCallback(
    (propertyId: string) => {
      onPropertyClick(propertyId);
    },
    [onPropertyClick]
  );

  const handleMarkerHover = useCallback(
    (propertyId: string) => {
      onPropertyHover(propertyId);
    },
    [onPropertyHover]
  );

  const handleMarkerLeave = useCallback(() => {
    onPropertyHover(null);
  }, [onPropertyHover]);

  // Memoize selected property to avoid O(n) lookup in render
  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId),
    [properties, selectedPropertyId]
  );

  if (!mapboxToken) {
    return (
      <div
        data-testid="mapbox-map"
        className="flex items-center justify-center w-full h-full bg-gray-100"
      >
        <div className="text-center">
          <p className="text-gray-600 text-sm">Map unavailable: Mapbox token not configured</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" data-testid="map-container">
      <Map
        reuseMaps
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: viewport.longitude,
          latitude: viewport.latitude,
          zoom: viewport.zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        onMove={(evt) => {
          handleViewportChange({
            longitude: evt.viewState.longitude,
            latitude: evt.viewState.latitude,
            zoom: evt.viewState.zoom,
          });
        }}
        data-testid="mapbox-map"
      >
        {/* Render markers for each property */}
        {properties.map((property) => (
          <Marker
            key={property.id}
            longitude={property.location.lng}
            latitude={property.location.lat}
            anchor="bottom"
            data-testid={`marker-${property.id}`}
            onClick={() => handleMarkerClick(property.id)}
            onMouseEnter={() => handleMarkerHover(property.id)}
            onMouseLeave={handleMarkerLeave}
          >
            <div
              className={`
                flex items-center justify-center w-8 h-8 rounded-full
                cursor-pointer transition-all transform
                ${
                  hoveredPropertyId === property.id
                    ? 'bg-blue-600 scale-125 shadow-lg'
                    : 'bg-red-500 hover:scale-110'
                }
                ${selectedPropertyId === property.id ? 'ring-2 ring-blue-300' : ''}
              `}
              style={{ boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)' }}
            >
              <span className="text-white text-xs font-bold">📍</span>
            </div>
          </Marker>
        ))}

        {/* Show popup for selected property */}
        {selectedProperty && (
          <Popup
            longitude={selectedProperty.location.lng}
            latitude={selectedProperty.location.lat}
            anchor="top"
            onClose={() => onPropertyClick('')}
            data-testid="popup"
          >
            <div className="max-w-xs">
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                {selectedProperty.title}
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                €{selectedProperty.nightly_rate_eur.toFixed(0)}/night
              </p>
              {selectedProperty.avg_rating && (
                <p className="text-xs text-gray-700 mt-1">
                  ⭐ {selectedProperty.avg_rating.toFixed(1)} ({selectedProperty.review_count} reviews)
                </p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
