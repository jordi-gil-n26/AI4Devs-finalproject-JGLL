'use client';

import React, { Suspense, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  MapPin,
  Users,
  BedDouble,
  Bath,
  Star,
  CheckCircle,
  ChevronLeft,
} from 'lucide-react';

import { usePropertyDetails } from '@/services/propertyService';
import { usePropertyAvailability } from '@/services/propertyService';
import { PhotoGallery } from '@/components/property/PhotoGallery';
import { AmenityList } from '@/components/property/AmenityList';
import { AvailabilityCalendar } from '@/components/property/AvailabilityCalendar';
import { PriceBreakdown } from '@/components/property/PriceBreakdown';
import { ReviewList } from '@/components/property/ReviewList';

/**
 * Property Detail Page (T048)
 *
 * Route: /property/[id]?check_in=YYYY-MM-DD&check_out=YYYY-MM-DD
 *
 * Layout (top to bottom / side-by-side on large screens):
 *   - Back button / breadcrumb
 *   - PhotoGallery
 *   - Title, location, host info
 *   - Description
 *   - AmenityList
 *   - House rules
 *   - AvailabilityCalendar + PriceBreakdown (right column on lg)
 *   - Reserve CTA
 *   - ReviewList
 */
function PropertyDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const propertyId = params?.id as string;

  // Date state driven by URL query params
  const checkIn = searchParams.get('check_in') || undefined;
  const checkOut = searchParams.get('check_out') || undefined;

  // Determine availability window: next 3 months
  const availabilityRange = useMemo(() => {
    const from = new Date();
    const to = new Date();
    to.setMonth(to.getMonth() + 3);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { from: fmt(from), to: fmt(to) };
  }, []);

  const { data: property, isLoading, error } = usePropertyDetails(propertyId);
  const { data: availabilityData } = usePropertyAvailability(
    propertyId,
    availabilityRange.from,
    availabilityRange.to,
  );

  // Update URL when user picks dates in calendar
  const handleDateRangeSelect = useCallback(
    (newCheckIn: string, newCheckOut: string) => {
      const current = new URLSearchParams(searchParams.toString());
      if (newCheckIn) {
        current.set('check_in', newCheckIn);
      } else {
        current.delete('check_in');
      }
      if (newCheckOut) {
        current.set('check_out', newCheckOut);
      } else {
        current.delete('check_out');
      }
      router.replace(`/property/${propertyId}?${current.toString()}`);
    },
    [propertyId, router, searchParams],
  );

  const handleReserve = useCallback(() => {
    const qs = new URLSearchParams();
    qs.set('propertyId', propertyId);
    if (checkIn) qs.set('checkIn', checkIn);
    if (checkOut) qs.set('checkOut', checkOut);
    qs.set('guestCount', '1');
    router.push(`/booking/checkout?${qs.toString()}`);
  }, [propertyId, checkIn, checkOut, router]);

  // ─── Loading state ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8" data-testid="property-page-loading">
        <div className="animate-pulse space-y-6">
          <div className="h-96 bg-gray-200 rounded-xl" />
          <div className="h-8 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-full" />
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────────
  if (error || !property) {
    return (
      <div
        className="max-w-5xl mx-auto px-4 py-8"
        data-testid="property-page-error"
        role="alert"
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Property not found</h1>
        <p className="text-gray-500">
          We could not find the property you were looking for.
        </p>
      </div>
    );
  }

  const unavailableDates = availabilityData?.unavailable_dates ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" data-testid="property-page">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      {/* Photo gallery */}
      <div className="mb-6">
        <PhotoGallery photos={property.photos} />
      </div>

      {/* Two-column layout on lg: left (info) + right (booking) */}
      <div className="lg:flex lg:gap-8">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="lg:flex-1 min-w-0">
          {/* Title & quick stats */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{property.title}</h1>

            {/* Rating + review count */}
            {property.avg_rating != null && property.review_count > 0 && (
              <div className="flex items-center gap-1 mb-2">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" aria-hidden />
                <span className="text-sm font-semibold text-gray-900">
                  {property.avg_rating.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500">
                  ({property.review_count} {property.review_count === 1 ? 'review' : 'reviews'})
                </span>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-1 text-gray-600 text-sm">
              <MapPin className="w-4 h-4 flex-shrink-0" aria-hidden />
              <span>
                {property.location.city}, {property.location.country}
              </span>
            </div>
          </div>

          {/* Quick capacity chips */}
          <div className="flex flex-wrap gap-3 mb-5 text-sm text-gray-700">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4 text-gray-500" aria-hidden />
              {property.max_guests} guests
            </div>
            <div className="flex items-center gap-1">
              <BedDouble className="w-4 h-4 text-gray-500" aria-hidden />
              {property.bedrooms} bedroom{property.bedrooms !== 1 ? 's' : ''}
            </div>
            <div className="flex items-center gap-1">
              <Bath className="w-4 h-4 text-gray-500" aria-hidden />
              {property.bathrooms} bathroom{property.bathrooms !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Host info */}
          <div className="flex items-center gap-3 mb-5 p-4 bg-gray-50 rounded-xl">
            {property.host.avatar_url ? (
              <img
                src={property.host.avatar_url}
                alt={`${property.host.first_name} avatar`}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-lg">
                {property.host.first_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Hosted by {property.host.first_name}
              </p>
              {property.host.is_verified && (
                <div className="flex items-center gap-1 text-xs text-green-700 mt-0.5">
                  <CheckCircle className="w-3.5 h-3.5" aria-hidden />
                  Verified host
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">About this place</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>

          {/* Amenities */}
          {property.amenities.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Amenities</h2>
              <AmenityList amenities={property.amenities} />
            </div>
          )}

          {/* House rules */}
          {property.house_rules.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">House rules</h2>
              <ul className="space-y-1">
                {property.house_rules.map((rule) => (
                  <li key={rule} className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden />
                    {rule
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Availability calendar (mobile: full width, lg: in left column) */}
          <div className="mb-6 lg:hidden">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Availability</h2>
            <AvailabilityCalendar
              unavailableDates={unavailableDates}
              onDateRangeSelect={handleDateRangeSelect}
              selectedRange={{ checkIn, checkOut }}
            />
          </div>
        </div>

        {/* ── Right column (lg only): booking widget ───────────────── */}
        <div className="hidden lg:block lg:w-80 xl:w-96 flex-shrink-0">
          <div className="sticky top-6 space-y-4">
            {/* Nightly rate */}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-gray-900">
                €{property.nightly_rate_eur.toFixed(0)}
              </span>
              <span className="text-sm text-gray-500">/ night</span>
            </div>

            {/* Availability calendar */}
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-3">Select dates</h2>
              <AvailabilityCalendar
                unavailableDates={unavailableDates}
                onDateRangeSelect={handleDateRangeSelect}
                selectedRange={{ checkIn, checkOut }}
              />
            </div>

            {/* Price breakdown */}
            <PriceBreakdown
              propertyId={propertyId}
              checkIn={checkIn}
              checkOut={checkOut}
            />

            {/* Reserve CTA */}
            <button
              type="button"
              onClick={handleReserve}
              disabled={!checkIn || !checkOut}
              className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              data-testid="reserve-button"
            >
              Reserve
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: price breakdown + reserve below calendar */}
      <div className="lg:hidden mb-6 space-y-4">
        <PriceBreakdown
          propertyId={propertyId}
          checkIn={checkIn}
          checkOut={checkOut}
        />
        <button
          type="button"
          onClick={handleReserve}
          disabled={!checkIn || !checkOut}
          className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          data-testid="reserve-button-mobile"
        >
          Reserve
        </button>
      </div>

      {/* Reviews */}
      <div className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Reviews
        </h2>
        <ReviewList
          propertyId={propertyId}
          avgRating={property.avg_rating ?? null}
          reviewCount={property.review_count}
        />
      </div>
    </div>
  );
}

export default function PropertyDetailPage() {
  return (
    <Suspense>
      <PropertyDetailPageContent />
    </Suspense>
  );
}
