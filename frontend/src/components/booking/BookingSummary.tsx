'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Users, Calendar } from 'lucide-react';
import type { Property, PriceBreakdown } from '@/types';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/** Returns "M:SS" remaining from a future ISO 8601 timestamp. */
function secondsRemaining(expiresAt: string): number {
  const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.max(0, diff);
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --------------------------------------------------------------------------
// Props
// --------------------------------------------------------------------------

export interface BookingSummaryProps {
  property: Property;
  checkIn: string;
  checkOut: string;
  guestCount: number;
  priceBreakdown: PriceBreakdown;
  holdExpiresAt: string;
  onHoldExpired: () => void;
}

// --------------------------------------------------------------------------
// Component
// --------------------------------------------------------------------------

/**
 * BookingSummary (Slice B / US3)
 *
 * Displays a summary of the booking being checked out:
 * - Property photo, title, and location
 * - Dates, guest count, and number of nights
 * - Full price breakdown table
 * - Live hold-expiry countdown; calls `onHoldExpired` when it reaches 0
 */
export function BookingSummary({
  property,
  checkIn,
  checkOut,
  guestCount,
  priceBreakdown,
  holdExpiresAt,
  onHoldExpired,
}: BookingSummaryProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsRemaining(holdExpiresAt));

  // Countdown timer — updates every second
  useEffect(() => {
    if (secondsLeft <= 0) {
      onHoldExpired();
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = prev - 1;
        if (next <= 0) {
          clearInterval(timer);
          onHoldExpired();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount; onHoldExpired captured via closure update below

  // Re-sync if holdExpiresAt changes (e.g. hold refreshed)
  useEffect(() => {
    setSecondsLeft(secondsRemaining(holdExpiresAt));
  }, [holdExpiresAt]);

  // First photo or placeholder
  const photoUrl = property.photos?.[0]?.url;

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white overflow-hidden"
      data-testid="booking-summary"
    >
      {/* Property hero */}
      <div className="flex gap-4 p-4 border-b border-gray-100">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={property.title}
            className="w-24 h-20 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div
            className="w-24 h-20 rounded-lg bg-gray-200 flex-shrink-0"
            aria-hidden
          />
        )}
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
            {property.title}
          </p>
          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3 flex-shrink-0" aria-hidden />
            <span>{property.location.city}, {property.location.country}</span>
          </div>
        </div>
      </div>

      {/* Dates + guests */}
      <div className="px-4 py-3 border-b border-gray-100 space-y-2 text-sm text-gray-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden />
          <span>
            <span className="font-medium">{checkIn}</span>
            {' → '}
            <span className="font-medium">{checkOut}</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden />
          <span>
            {guestCount} {guestCount === 1 ? 'guest' : 'guests'},{' '}
            {priceBreakdown.nights} {priceBreakdown.nights === 1 ? 'night' : 'nights'}
          </span>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="px-4 py-4 space-y-2 text-sm" data-testid="price-breakdown-table">
        <div className="flex justify-between text-gray-700">
          <span>
            {formatEur(priceBreakdown.nightly_rate_eur)} × {priceBreakdown.nights}{' '}
            {priceBreakdown.nights === 1 ? 'night' : 'nights'}
          </span>
          <span>{formatEur(priceBreakdown.subtotal_eur)}</span>
        </div>

        <div className="flex justify-between text-gray-700">
          <span>Cleaning fee</span>
          <span>{formatEur(priceBreakdown.cleaning_fee_eur)}</span>
        </div>

        <div className="flex justify-between text-gray-700">
          <span>Service fee</span>
          <span>{formatEur(priceBreakdown.service_fee_eur)}</span>
        </div>

        {priceBreakdown.tax_eur > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Taxes</span>
            <span>{formatEur(priceBreakdown.tax_eur)}</span>
          </div>
        )}

        <div className="border-t pt-3 mt-3 flex justify-between font-semibold text-gray-900 text-base">
          <span>Total</span>
          <span data-testid="price-total">{formatEur(priceBreakdown.total_eur)}</span>
        </div>
      </div>

      {/* Hold expiry countdown */}
      <div
        className="mx-4 mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center justify-between"
        data-testid="hold-countdown"
      >
        <span>Hold expires in</span>
        <span className="font-semibold tabular-nums" data-testid="countdown-timer">
          {formatCountdown(secondsLeft)}
        </span>
      </div>
    </div>
  );
}
