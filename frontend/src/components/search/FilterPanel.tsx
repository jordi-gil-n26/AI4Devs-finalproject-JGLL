'use client';

import React, { useState } from 'react';
import { SearchFilters, PropertyType } from '@/types';

interface FilterPanelProps {
  onFiltersChange: (filters: Partial<SearchFilters>) => void;
}

const PROPERTY_TYPES: PropertyType[] = ['apartment', 'house', 'villa', 'cabin', 'studio'];
const BEDROOM_OPTIONS = [1, 2, 3, 4];
const AMENITIES = ['WiFi', 'Kitchen', 'Air Conditioning', 'Pool', 'Parking'];

export function FilterPanel({ onFiltersChange }: FilterPanelProps) {
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [propertyType, setPropertyType] = useState<PropertyType | undefined>();
  const [bedrooms, setBedrooms] = useState<number | undefined>();
  const [amenities, setAmenities] = useState<string[]>([]);

  const handleMinPriceChange = (value: string) => {
    const num = value ? parseInt(value, 10) : undefined;
    // Validate that min price doesn't exceed max price
    if (num && maxPrice && num > maxPrice) {
      console.warn('Min price cannot be greater than max price');
      return;
    }
    setMinPrice(num);
    onFiltersChange({ min_price: num });
  };

  const handleMaxPriceChange = (value: string) => {
    const num = value ? parseInt(value, 10) : undefined;
    // Validate that max price isn't less than min price
    if (num && minPrice && num < minPrice) {
      console.warn('Max price cannot be less than min price');
      return;
    }
    setMaxPrice(num);
    onFiltersChange({ max_price: num });
  };

  const handlePropertyTypeChange = (type: PropertyType) => {
    if (propertyType === type) {
      setPropertyType(undefined);
      onFiltersChange({ property_type: undefined });
    } else {
      setPropertyType(type);
      onFiltersChange({ property_type: type });
    }
  };

  const handleBedroomsChange = (value: number) => {
    if (bedrooms === value) {
      setBedrooms(undefined);
      onFiltersChange({ bedrooms: undefined });
    } else {
      setBedrooms(value);
      onFiltersChange({ bedrooms: value });
    }
  };

  const handleAmenityChange = (amenity: string) => {
    let newAmenities: string[];
    if (amenities.includes(amenity)) {
      newAmenities = amenities.filter(a => a !== amenity);
    } else {
      newAmenities = [...amenities, amenity];
    }
    setAmenities(newAmenities);
    onFiltersChange({ amenities: newAmenities });
  };

  return (
    <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* Price Range Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Price Range</h3>
        <div className="space-y-3">
          <div>
            <label htmlFor="min-price" className="block text-sm font-medium text-gray-700 mb-1">
              Minimum Price (EUR)
            </label>
            <input
              id="min-price"
              type="number"
              placeholder="Min"
              value={minPrice ?? ''}
              onChange={e => handleMinPriceChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="max-price" className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Price (EUR)
            </label>
            <input
              id="max-price"
              type="number"
              placeholder="Max"
              value={maxPrice ?? ''}
              onChange={e => handleMaxPriceChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Property Type Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Property Type</h3>
        <div className="space-y-2">
          {PROPERTY_TYPES.map(type => (
            <label key={type} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={propertyType === type}
                onChange={() => handlePropertyTypeChange(type)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 capitalize">{type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Bedrooms Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Bedrooms</h3>
        <div className="grid grid-cols-4 gap-2">
          {BEDROOM_OPTIONS.map(value => (
            <button
              key={value}
              onClick={() => handleBedroomsChange(value)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                bedrooms === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {value}+
            </button>
          ))}
        </div>
      </div>

      {/* Amenities Section */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Amenities</h3>
        <div className="space-y-2">
          {AMENITIES.map(amenity => (
            <label key={amenity} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={amenities.includes(amenity)}
                onChange={() => handleAmenityChange(amenity)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{amenity}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
