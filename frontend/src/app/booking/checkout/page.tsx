'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

import { useCreateBooking, useConfirmBooking } from '@/services/bookingService';
import { usePropertyDetails } from '@/services/propertyService';
import { BookingSummary } from '@/components/booking/BookingSummary';
import { PaymentForm } from '@/components/booking/PaymentForm';
import type { CreateBookingResponse } from '@/types';
import type { ConfirmationSessionData } from '@/types/booking';

/**
 * Checkout Page — /booking/checkout
 *
 * Query params expected:
 *   propertyId  — UUID of the property
 *   checkIn     — "YYYY-MM-DD"
 *   checkOut    — "YYYY-MM-DD"
 *   guestCount  — integer (default 1)
 *
 * Flow:
 *   1. Read params from URL search params.
 *   2. On first render, POST /api/v1/bookings → receive bookingId,
 *      clientSecret, priceBreakdown, holdExpiresAt.
 *   3. Render BookingSummary (left) + PaymentForm (right).
 *   4. On successful Stripe payment, POST confirm → store confirmation
 *      data in sessionStorage → navigate to /confirmation/{bookingId}.
 *   5. If hold expires, show error + "Back to search" CTA.
 *   6. Handle API errors (409 → dates taken, 400 → validation).
 */
function CheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL params ──────────────────────────────────────────────────────────
  const propertyId = searchParams.get('propertyId') ?? '';
  const checkIn = searchParams.get('checkIn') ?? '';
  const checkOut = searchParams.get('checkOut') ?? '';
  const guestCount = parseInt(searchParams.get('guestCount') ?? '1', 10);

  // ── State ───────────────────────────────────────────────────────────────
  const [booking, setBooking] = useState<CreateBookingResponse | null>(null);
  const [holdExpired, setHoldExpired] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  // ── Queries / mutations ─────────────────────────────────────────────────
  const { data: property, isLoading: propertyLoading } = usePropertyDetails(propertyId);
  const createBooking = useCreateBooking();
  const confirmBooking = useConfirmBooking();

  // ── Create booking on mount ─────────────────────────────────────────────
  // Use a ref to fire only once even in React Strict Mode double-invoke.
  const hasCreatedRef = useRef(false);

  useEffect(() => {
    if (hasCreatedRef.current) return;
    if (!propertyId || !checkIn || !checkOut) {
      setPageError('Missing booking parameters. Please go back and try again.');
      return;
    }

    // Auth guard: redirect to login if no JWT is present
    if (!localStorage.getItem('auth_token')) {
      const redirectUrl = `/booking/checkout?${searchParams.toString()}`;
      router.push(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    hasCreatedRef.current = true;

    createBooking.mutate(
      { property_id: propertyId, check_in: checkIn, check_out: checkOut, guest_count: guestCount },
      {
        onSuccess: (data) => setBooking(data),
        onError: (err) => {
          if (err.status === 409) {
            setPageError('Those dates are no longer available. Please go back and choose different dates.');
          } else if (err.status === 400) {
            setPageError(`Validation error: ${err.message}`);
          } else {
            setPageError(err.message ?? 'Failed to create booking. Please try again.');
          }
        },
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once

  // ── Stripe success → confirm booking ────────────────────────────────────
  const handlePaymentSuccess = (paymentIntentId: string) => {
    if (!booking) return;

    confirmBooking.mutate(
      { bookingId: booking.booking_id, payload: { payment_intent_id: paymentIntentId } },
      {
        onSuccess: (data) => {
          // Store minimal confirmation data for the confirmation page.
          const sessionData: ConfirmationSessionData = {
            booking_id: data.booking_id,
            reference_number: data.reference_number,
            property_title: data.property_title ?? property?.title ?? 'Your stay',
            property_photo_url: property?.photos?.[0]?.url,
            check_in: data.check_in ?? checkIn,
            check_out: data.check_out ?? checkOut,
            total_eur: data.total_eur ?? booking.price_breakdown.total_eur,
          };
          try {
            sessionStorage.setItem(
              `confirmation_${data.booking_id}`,
              JSON.stringify(sessionData),
            );
          } catch {
            // sessionStorage unavailable (e.g. private mode) — ignore; confirmation
            // page will fall back gracefully.
          }
          router.push(`/confirmation/${data.booking_id}`);
        },
        onError: (err) => {
          setPageError(`Payment confirmation failed: ${err.message}`);
        },
      },
    );
  };

  const handlePaymentError = (msg: string) => {
    // PaymentForm already shows the inline error; no additional action needed.
    console.error('Payment error:', msg);
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (propertyLoading || createBooking.isPending) {
    return (
      <div
        className="max-w-4xl mx-auto px-4 py-8"
        data-testid="checkout-loading"
      >
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Hold expired state ───────────────────────────────────────────────────
  if (holdExpired) {
    return (
      <div
        className="max-w-4xl mx-auto px-4 py-8 text-center"
        data-testid="checkout-hold-expired"
      >
        <div className="mb-4 text-5xl">⏰</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Hold expired</h1>
        <p className="text-gray-500 mb-6">
          Your hold on this property has expired. Please search again to check current
          availability.
        </p>
        <Link
          href="/"
          className="inline-block py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
        >
          Back to search
        </Link>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (pageError) {
    return (
      <div
        className="max-w-4xl mx-auto px-4 py-8"
        data-testid="checkout-error"
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <h2 className="font-semibold mb-1">Booking error</h2>
          <p className="text-sm">{pageError}</p>
        </div>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Back to search
        </Link>
      </div>
    );
  }

  // ── Not yet ready (booking not created, property still loading) ──────────
  if (!booking || !property) {
    return null;
  }

  // ── Confirmation in progress ─────────────────────────────────────────────
  if (confirmBooking.isPending) {
    return (
      <div
        className="max-w-4xl mx-auto px-4 py-8 text-center"
        data-testid="checkout-confirming"
      >
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64 mx-auto" />
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
        </div>
        <p className="mt-6 text-gray-500">Confirming your booking…</p>
      </div>
    );
  }

  // ── Main checkout view ───────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-8" data-testid="checkout-page">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        aria-label="Go back"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: booking summary */}
        <BookingSummary
          property={property}
          checkIn={checkIn}
          checkOut={checkOut}
          guestCount={guestCount}
          priceBreakdown={booking.price_breakdown}
          holdExpiresAt={booking.hold_expires_at}
          onHoldExpired={() => setHoldExpired(true)}
        />

        {/* Right: payment form */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Payment</h2>
          <PaymentForm
            clientSecret={booking.stripe_client_secret}
            bookingId={booking.booking_id}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense>
      <CheckoutPageContent />
    </Suspense>
  );
}
