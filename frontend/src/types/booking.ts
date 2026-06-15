/**
 * Booking-specific types for the checkout flow (Slice B / US3).
 *
 * Core request/response types (CreateBookingRequest, CreateBookingResponse,
 * BookingDetailResponse, PriceBreakdown) are already declared in
 * `@/types/index.ts`.  This module re-exports them for convenience and adds
 * the confirm-booking contract that is specific to the checkout flow.
 */

export type {
  CreateBookingRequest,
  CreateBookingResponse,
  BookingDetailResponse,
  PriceBreakdown,
  BookingStatus,
} from '@/types';

/** Request body for POST /api/v1/bookings/{bookingId}/confirm */
export interface ConfirmBookingRequest {
  payment_intent_id: string;
}

/**
 * Response from POST /api/v1/bookings/{bookingId}/confirm.
 * The backend returns the full booking detail; we model the
 * subset that the confirmation page actually uses.
 */
export interface ConfirmBookingResponse {
  booking_id: string;
  reference_number: string;
  status: import('@/types').BookingStatus;
  property_title?: string;
  check_in: string;
  check_out: string;
  total_eur: number;
}

/** Shape stored in sessionStorage to pass data to the confirmation page. */
export interface ConfirmationSessionData {
  booking_id: string;
  reference_number: string;
  property_title: string;
  property_photo_url?: string;
  check_in: string;
  check_out: string;
  total_eur: number;
}
