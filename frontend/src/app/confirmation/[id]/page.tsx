'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, Calendar, Home } from 'lucide-react';
import type { ConfirmationSessionData } from '@/types/booking';

/**
 * Confirmation Page — /confirmation/[id]
 *
 * `[id]` is the bookingId UUID.
 *
 * Reads confirmation data from `sessionStorage` key
 * `confirmation_{bookingId}` set by the checkout page after successful
 * payment.  Falls back to a generic success message if the key is missing
 * (e.g. direct navigation / session cleared).
 *
 * Displays:
 *   - "Booking Confirmed!" heading with green checkmark
 *   - Reference number (large, prominent)
 *   - Property name, dates, total paid
 *   - Two CTAs: "View My Trips" (coming soon) and "Back to Search"
 */
export default function ConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params?.id as string;

  const [data, setData] = useState<ConfirmationSessionData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!bookingId) {
      setLoaded(true);
      return;
    }
    try {
      const raw = sessionStorage.getItem(`confirmation_${bookingId}`);
      if (raw) {
        setData(JSON.parse(raw) as ConfirmationSessionData);
      }
    } catch {
      // sessionStorage unavailable or JSON parse failed — show fallback
    }
    setLoaded(true);
  }, [bookingId]);

  if (!loaded) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center" data-testid="confirmation-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-16 w-16 bg-gray-200 rounded-full mx-auto" />
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="max-w-lg mx-auto px-4 py-12 text-center"
      data-testid="confirmation-page"
    >
      {/* Success icon */}
      <div className="flex justify-center mb-4">
        <CheckCircle
          className="w-16 h-16 text-green-500"
          aria-hidden
          data-testid="confirmation-icon"
        />
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
      <p className="text-gray-500 mb-6">
        {data
          ? 'Your reservation is confirmed. Check your email for details.'
          : 'Your payment was processed successfully.'}
      </p>

      {/* Reference number */}
      {data?.reference_number && (
        <div
          className="mb-6 inline-block bg-blue-50 border border-blue-200 rounded-xl px-6 py-4"
          data-testid="reference-number-block"
        >
          <p className="text-xs text-blue-600 uppercase tracking-wider font-medium mb-1">
            Booking reference
          </p>
          <p
            className="text-2xl font-bold text-blue-700 tracking-widest"
            data-testid="reference-number"
          >
            {data.reference_number}
          </p>
        </div>
      )}

      {/* Stay details card */}
      {data && (
        <div
          className="mb-8 text-left bg-white border border-gray-200 rounded-xl p-5 space-y-3"
          data-testid="confirmation-details"
        >
          {/* Property name */}
          <div className="flex items-start gap-3">
            <Home className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Property</p>
              <p className="text-sm font-medium text-gray-900">{data.property_title}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" aria-hidden />
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Dates</p>
              <p className="text-sm font-medium text-gray-900">
                {data.check_in} → {data.check_out}
              </p>
            </div>
          </div>

          {/* Total paid */}
          <div className="border-t pt-3 flex justify-between items-center">
            <span className="text-sm text-gray-500">Total paid</span>
            <span className="text-base font-semibold text-gray-900" data-testid="total-paid">
              €{data.total_eur.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {/* "View My Trips" */}
        <button
          type="button"
          onClick={() => router.push('/trips')}
          className="py-3 px-6 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
          data-testid="view-trips-button"
        >
          View My Trips
        </button>

        {/* Back to Search */}
        <button
          type="button"
          onClick={() => router.push('/')}
          className="py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          data-testid="back-to-search-button"
        >
          Back to Search
        </button>
      </div>
    </div>
  );
}
