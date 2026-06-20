'use client';

import React, { Suspense, useCallback, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchBar, type SearchParams } from '@/components/search/SearchBar';
import { FilterPanel } from '@/components/search/FilterPanel';
import { PropertyCard } from '@/components/search/PropertyCard';
import { MapView } from '@/components/search/MapView';
import { EmptyState } from '@/components/search/EmptyState';
import { usePropertySearch, useGeocode } from '@/services/searchService';
import type { SearchFilters, PropertySummary } from '@/types';

/**
 * SearchPage Component (T035)
 *
 * Composites all search components (SearchBar, FilterPanel, PropertyCard grid, MapView, EmptyState)
 * into a single results page with:
 * - URL query parameter syncing (bidirectional)
 * - Pagination support (prev/next buttons)
 * - Filter management
 * - Responsive layout (desktop/tablet/mobile)
 *
 * URL Query Parameters:
 * - location: string
 * - swLat, swLng, neLat, neLng: bounding box coordinates
 * - checkIn, checkOut: YYYY-MM-DD dates
 * - page: current page number (default 1)
 * - minPrice, maxPrice: price filter (optional)
 * - propertyType: property type filter (optional)
 * - bedrooms: minimum bedrooms (optional)
 * - amenities: comma-separated amenities (optional)
 */
function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({
    longitude: 2.1734,
    latitude: 41.3851,
    zoom: 12,
  });
  const propertyGridRef = useRef<HTMLDivElement>(null);

  // Geocode location if provided
  const location = searchParams.get('location') || '';
  const { data: geocodeResults } = useGeocode(location);

  // Determine bounding box: use geocoded results or URL params or default
  const bbox = useMemo(() => {
    if (geocodeResults && geocodeResults.results.length > 0) {
      const result = geocodeResults.results[0];
      return result.bbox || { sw_lat: 40, sw_lng: 2, ne_lat: 42, ne_lng: 4 };
    }

    return {
      sw_lat: parseFloat(searchParams.get('swLat') || '40'),
      sw_lng: parseFloat(searchParams.get('swLng') || '2'),
      ne_lat: parseFloat(searchParams.get('neLat') || '42'),
      ne_lng: parseFloat(searchParams.get('neLng') || '4'),
    };
  }, [geocodeResults, searchParams]);

  // Parse URL query params into search filters
  const searchFilters = useMemo(() => {
    return {
      sw_lat: bbox.sw_lat,
      sw_lng: bbox.sw_lng,
      ne_lat: bbox.ne_lat,
      ne_lng: bbox.ne_lng,
      check_in: searchParams.get('checkIn') || '',
      check_out: searchParams.get('checkOut') || '',
      page: parseInt(searchParams.get('page') || '1', 10),
      min_price: searchParams.get('minPrice')
        ? parseFloat(searchParams.get('minPrice')!)
        : undefined,
      max_price: searchParams.get('maxPrice')
        ? parseFloat(searchParams.get('maxPrice')!)
        : undefined,
      property_type: (searchParams.get('propertyType') || undefined) as
        | 'apartment'
        | 'house'
        | 'villa'
        | 'cabin'
        | 'studio'
        | undefined,
      bedrooms: searchParams.get('bedrooms')
        ? parseInt(searchParams.get('bedrooms')!, 10)
        : undefined,
      amenities: searchParams.get('amenities')
        ? searchParams.get('amenities')!.split(',').filter(Boolean)
        : [],
      size: 20,
    };
  }, [bbox, searchParams]);

  // Fetch properties from API
  const { data: searchResults, isLoading } = usePropertySearch(
    searchFilters.check_in && searchFilters.check_out
      ? searchFilters
      : undefined,
  );

  // Handle search submission from SearchBar
  const handleSearch = useCallback(
    (params: SearchParams) => {
      const newParams = new URLSearchParams({
        location: params.location,
        checkIn: params.checkInDate,
        checkOut: params.checkOutDate,
        // Use default bounding box for Barcelona (can be enhanced with geolocation)
        swLat: '40',
        swLng: '2',
        neLat: '42',
        neLng: '4',
        page: '1',
      });

      router.push(`/search?${newParams.toString()}`);
    },
    [router],
  );

  // Handle filter changes from FilterPanel
  const handleFiltersChange = useCallback(
    (filters: Partial<SearchFilters>) => {
      const newParams = new URLSearchParams(searchParams);

      // Update filter parameters
      if (filters.min_price !== undefined) {
        if (filters.min_price) {
          newParams.set('minPrice', filters.min_price.toString());
        } else {
          newParams.delete('minPrice');
        }
      }

      if (filters.max_price !== undefined) {
        if (filters.max_price) {
          newParams.set('maxPrice', filters.max_price.toString());
        } else {
          newParams.delete('maxPrice');
        }
      }

      if (filters.property_type !== undefined) {
        if (filters.property_type) {
          newParams.set('propertyType', filters.property_type);
        } else {
          newParams.delete('propertyType');
        }
      }

      if (filters.bedrooms !== undefined) {
        if (filters.bedrooms) {
          newParams.set('bedrooms', filters.bedrooms.toString());
        } else {
          newParams.delete('bedrooms');
        }
      }

      if (filters.amenities !== undefined) {
        if (filters.amenities && filters.amenities.length > 0) {
          newParams.set('amenities', filters.amenities.join(','));
        } else {
          newParams.delete('amenities');
        }
      }

      // Reset to page 1 when filters change
      newParams.set('page', '1');

      router.push(`/search?${newParams.toString()}`);
    },
    [searchParams, router],
  );

  // Handle pagination
  const handlePageChange = useCallback(
    (page: number) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('page', page.toString());
      router.push(`/search?${newParams.toString()}`);
    },
    [searchParams, router],
  );

  // Handle property card click - navigate to property details
  const handlePropertyClick = useCallback(
    (propertyId: string) => {
      router.push(`/property/${propertyId}`);
    },
    [router],
  );

  // Handle map property click - scroll to card and highlight
  const handleMapPropertyClick = useCallback(
    (propertyId: string) => {
      setSelectedPropertyId(propertyId);
      // Scroll property into view
      if (propertyGridRef.current) {
        const propertyElement = propertyGridRef.current.querySelector(
          `[data-property-id="${propertyId}"]`,
        );
        if (propertyElement) {
          propertyElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    },
    [],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* SearchBar (sticky top) */}
      <div className="sticky top-0 z-10 bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <SearchBar onSearch={handleSearch} />
        </div>
      </div>

      {/* Main content grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Left sidebar: FilterPanel */}
          <aside className="md:col-span-1">
            <div className="sticky top-20">
              <FilterPanel onFiltersChange={handleFiltersChange} />
            </div>
          </aside>

          {/* Center: Results */}
          <main className="md:col-span-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-600">Loading properties...</p>
                </div>
              </div>
            )}

            {!isLoading && (!searchResults?.results || searchResults.results.length === 0) && (
              <EmptyState />
            )}

            {!isLoading && searchResults?.results && searchResults.results.length > 0 && (
              <>
                {/* Property grid */}
                <div
                  ref={propertyGridRef}
                  className="grid grid-cols-1 gap-4"
                  data-testid="property-grid"
                >
                  {searchResults.results.map((property: PropertySummary) => (
                    <div
                      key={property.id}
                      data-property-id={property.id}
                      className={`transition-all ${
                        selectedPropertyId === property.id ? 'ring-2 ring-blue-600' : ''
                      }`}
                    >
                      <PropertyCard
                        property={property}
                        onClick={handlePropertyClick}
                      />
                    </div>
                  ))}
                </div>

                {/* Pagination controls */}
                <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <button
                    onClick={() =>
                      handlePageChange(searchResults.pagination.page - 1)
                    }
                    disabled={searchResults.pagination.page === 1}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>

                  <span className="text-sm text-gray-600">
                    Page {searchResults.pagination.page} of{' '}
                    {searchResults.pagination.total_pages}
                  </span>

                  <button
                    onClick={() =>
                      handlePageChange(searchResults.pagination.page + 1)
                    }
                    disabled={
                      searchResults.pagination.page ===
                      searchResults.pagination.total_pages
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>

                {/* Results count */}
                <div className="mt-4 text-xs text-gray-500 text-center">
                  Showing {(searchResults.pagination.page - 1) * searchResults.pagination.size + 1} -{' '}
                  {Math.min(
                    searchResults.pagination.page * searchResults.pagination.size,
                    searchResults.pagination.total_results,
                  )}{' '}
                  of {searchResults.pagination.total_results} results
                </div>
              </>
            )}
          </main>

          {/* Right sidebar: MapView */}
          <aside className="md:col-span-1">
            <div className="sticky top-20 h-96 rounded-lg overflow-hidden bg-gray-100">
              <MapView
                properties={searchResults?.results || []}
                selectedPropertyId={selectedPropertyId || ''}
                hoveredPropertyId={hoveredPropertyId || ''}
                onPropertyClick={handleMapPropertyClick}
                onPropertyHover={setHoveredPropertyId}
                viewport={viewport}
                onViewportChange={setViewport}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
