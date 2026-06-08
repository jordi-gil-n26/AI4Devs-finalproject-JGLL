'use client';

import React from 'react';
import type { PropertySummary } from '@/types';

interface PropertyCardProps {
  property: PropertySummary;
  onClick: (propertyId: string) => void;
}

/**
 * PropertyCard Component
 *
 * Displays a property summary card with photo, title, price, and rating.
 * Used in search results grid.
 */
export function PropertyCard({ property, onClick }: PropertyCardProps) {
  const handleClick = () => {
    onClick(property.id);
  };

  // Calculate star display (0-5 stars)
  const rating = property.avg_rating || 0;
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <button
      onClick={handleClick}
      className="group relative h-full w-full overflow-hidden rounded-lg bg-white shadow-sm transition-shadow hover:shadow-md"
      type="button"
      aria-label={`View ${property.title}`}
    >
      {/* Photo Container */}
      <div className="relative aspect-square overflow-hidden bg-gray-200">
        <img
          src={property.photo_url}
          alt={`Photo of ${property.title}`}
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/300x200?text=No+Image';
          }}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>

      {/* Content Container */}
      <div className="flex flex-col gap-2 p-3">
        {/* Title */}
        <h3 className="line-clamp-2 text-sm font-semibold text-gray-900">
          {property.title}
        </h3>

        {/* Location */}
        <p className="text-xs text-gray-600">
          {property.location.city}, {property.location.country}
        </p>

        {/* Price */}
        <p className="text-sm font-bold text-gray-900">
          €{property.nightly_rate_eur.toFixed(0)} <span className="text-xs font-normal text-gray-600">per night</span>
        </p>

        {/* Rating */}
        <div className="flex items-center gap-1">
          {property.avg_rating !== null && property.avg_rating !== undefined ? (
            <>
              {/* Star Display */}
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    role="img"
                    aria-hidden
                    className={`text-xs ${
                      i < fullStars
                        ? 'text-yellow-400'
                        : i === fullStars && hasHalfStar
                          ? 'text-yellow-400'
                          : 'text-gray-300'
                    }`}
                  >
                    ★
                  </span>
                ))}
              </div>
              <span className="text-xs font-semibold text-gray-900">
                {rating.toFixed(1)}
              </span>
              <span className="text-xs text-gray-600">
                ({property.review_count} {property.review_count === 1 ? 'review' : 'reviews'})
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-500">No ratings yet</span>
          )}
        </div>
      </div>
    </button>
  );
}
