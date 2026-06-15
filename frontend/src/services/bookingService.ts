/**
 * Booking API service (Slice B / US3).
 *
 * TanStack Query mutations that wrap the booking creation and confirmation
 * endpoints.  Error handling follows the existing apiClient pattern: every
 * rejected promise is a {@link NormalizedApiError}.
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { apiClient } from './apiClient';
import type { NormalizedApiError } from './apiClient';
import type {
  CreateBookingRequest,
  CreateBookingResponse,
} from '@/types';
import type {
  ConfirmBookingRequest,
  ConfirmBookingResponse,
} from '@/types/booking';

// --------------------------------------------------------------------------
// createBooking
// --------------------------------------------------------------------------

/**
 * Mutation: POST /api/v1/bookings
 *
 * Creates an availability hold and returns the Stripe client secret plus
 * the price breakdown.  The caller is responsible for calling
 * {@link useConfirmBooking} after successful payment.
 */
export function useCreateBooking(): UseMutationResult<
  CreateBookingResponse,
  NormalizedApiError,
  CreateBookingRequest
> {
  return useMutation({
    mutationFn: async (request: CreateBookingRequest) => {
      const response = await apiClient.post<CreateBookingResponse>(
        '/api/v1/bookings',
        request,
      );
      return response.data;
    },
  });
}

// --------------------------------------------------------------------------
// confirmBooking
// --------------------------------------------------------------------------

interface ConfirmBookingVariables {
  bookingId: string;
  payload: ConfirmBookingRequest;
}

/**
 * Mutation: POST /api/v1/bookings/{bookingId}/confirm
 *
 * Confirms a booking by associating the completed Stripe PaymentIntent.
 * Call this after Stripe's `confirmCardPayment` resolves successfully.
 */
export function useConfirmBooking(): UseMutationResult<
  ConfirmBookingResponse,
  NormalizedApiError,
  ConfirmBookingVariables
> {
  return useMutation({
    mutationFn: async ({ bookingId, payload }: ConfirmBookingVariables) => {
      const response = await apiClient.post<ConfirmBookingResponse>(
        `/api/v1/bookings/${bookingId}/confirm`,
        payload,
      );
      return response.data;
    },
  });
}
