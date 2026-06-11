'use client';

import React from 'react';
import { usePriceCalculation } from '@/services/propertyService';

interface PriceBreakdownProps {
  propertyId: string;
  checkIn: string | undefined;
  checkOut: string | undefined;
}

function SkeletonRow() {
  return (
    <div className="flex justify-between items-center py-1">
      <div className="h-4 bg-gray-200 rounded w-32 animate-pulse" />
      <div className="h-4 bg-gray-200 rounded w-16 animate-pulse" />
    </div>
  );
}

function formatEur(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

/**
 * PriceBreakdown Component (T046)
 *
 * Displays full price breakdown for a stay.
 * - Calls usePriceCalculation internally
 * - Shows loading skeleton, error state, or placeholder when dates missing
 * - Props: propertyId, checkIn, checkOut
 */
export function PriceBreakdown({ propertyId, checkIn, checkOut }: PriceBreakdownProps) {
  const hasDates = !!checkIn && !!checkOut;

  const { data, isLoading, error } = usePriceCalculation(propertyId, checkIn, checkOut);

  if (!hasDates) {
    return (
      <div
        className="rounded-xl border border-gray-200 p-5 bg-white"
        data-testid="price-breakdown-placeholder"
      >
        <p className="text-gray-500 text-sm text-center py-4">
          Select dates to see total price
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="rounded-xl border border-gray-200 p-5 bg-white space-y-2"
        data-testid="price-breakdown-loading"
        aria-busy="true"
        aria-label="Loading price breakdown"
      >
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <div className="border-t pt-2 mt-2">
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-xl border border-red-200 p-5 bg-red-50 text-red-600 text-sm"
        data-testid="price-breakdown-error"
        role="alert"
      >
        Unable to calculate price. Please try again later.
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-gray-200 p-5 bg-white"
      data-testid="price-breakdown"
    >
      <h3 className="text-base font-semibold text-gray-900 mb-4">Price breakdown</h3>

      <div className="space-y-2 text-sm">
        {/* Nightly rate × nights */}
        <div className="flex justify-between text-gray-700">
          <span>
            {formatEur(data.nightly_rate_eur)} × {data.nights} {data.nights === 1 ? 'night' : 'nights'}
          </span>
          <span>{formatEur(data.subtotal_eur)}</span>
        </div>

        {/* Cleaning fee */}
        <div className="flex justify-between text-gray-700">
          <span>Cleaning fee</span>
          <span>{formatEur(data.cleaning_fee_eur)}</span>
        </div>

        {/* Service fee */}
        <div className="flex justify-between text-gray-700">
          <span>Service fee</span>
          <span>{formatEur(data.service_fee_eur)}</span>
        </div>

        {/* Tax (only if non-zero) */}
        {data.tax_eur > 0 && (
          <div className="flex justify-between text-gray-700">
            <span>Taxes</span>
            <span>{formatEur(data.tax_eur)}</span>
          </div>
        )}

        {/* Total */}
        <div className="border-t pt-3 mt-3 flex justify-between font-semibold text-gray-900 text-base">
          <span>Total</span>
          <span>{formatEur(data.total_eur)}</span>
        </div>
      </div>
    </div>
  );
}
