/**
 * Tests for bookingService — createBooking and confirmBooking mutations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateBooking, useConfirmBooking } from './bookingService';
import type { CreateBookingRequest, CreateBookingResponse } from '@/types';
import type { ConfirmBookingResponse } from '@/types/booking';

// --------------------------------------------------------------------------
// Mock apiClient
// --------------------------------------------------------------------------

vi.mock('./apiClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
  NormalizedApiError: class NormalizedApiError extends Error {
    code: string;
    status?: number;
    constructor(params: { message: string; code: string; status?: number }) {
      super(params.message);
      this.name = 'NormalizedApiError';
      this.code = params.code;
      this.status = params.status;
    }
  },
}));

import { apiClient } from './apiClient';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

// --------------------------------------------------------------------------
// useCreateBooking
// --------------------------------------------------------------------------

describe('useCreateBooking', () => {
  const mockRequest: CreateBookingRequest = {
    property_id: 'prop-uuid-1',
    check_in: '2026-07-10',
    check_out: '2026-07-13',
    guest_count: 2,
  };

  const mockResponse: CreateBookingResponse = {
    booking_id: 'booking-uuid-1',
    reference_number: 'BK-12345678',
    price_breakdown: {
      nights: 3,
      nightly_rate_eur: 120,
      subtotal_eur: 360,
      cleaning_fee_eur: 45,
      service_fee_eur: 48.6,
      tax_eur: 0,
      total_eur: 453.6,
    },
    stripe_client_secret: 'pi_stub_secret_test',
    hold_expires_at: '2026-07-10T12:10:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /api/v1/bookings with correct payload', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useCreateBooking(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(mockRequest);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/bookings', mockRequest);
  });

  it('returns booking data on success', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockResponse });

    const { result } = renderHook(() => useCreateBooking(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(mockRequest);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
  });

  it('surfaces error on API failure', async () => {
    const error = new Error('Network error');
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCreateBooking(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate(mockRequest);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });

  it('starts in idle state', () => {
    const { result } = renderHook(() => useCreateBooking(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(false);
    expect(result.current.isIdle).toBe(true);
  });
});

// --------------------------------------------------------------------------
// useConfirmBooking
// --------------------------------------------------------------------------

describe('useConfirmBooking', () => {
  const mockConfirmResponse: ConfirmBookingResponse = {
    booking_id: 'booking-uuid-1',
    reference_number: 'BK-12345678',
    status: 'confirmed',
    check_in: '2026-07-10',
    check_out: '2026-07-13',
    total_eur: 453.6,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls POST /api/v1/bookings/{id}/confirm with correct payload', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockConfirmResponse });

    const { result } = renderHook(() => useConfirmBooking(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        bookingId: 'booking-uuid-1',
        payload: { payment_intent_id: 'pi_test_123' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/bookings/booking-uuid-1/confirm',
      { payment_intent_id: 'pi_test_123' },
    );
  });

  it('returns confirmation data on success', async () => {
    (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockConfirmResponse });

    const { result } = renderHook(() => useConfirmBooking(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        bookingId: 'booking-uuid-1',
        payload: { payment_intent_id: 'pi_test_123' },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockConfirmResponse);
    expect(result.current.data?.reference_number).toBe('BK-12345678');
  });

  it('surfaces error on API failure', async () => {
    const error = new Error('Confirmation failed');
    (apiClient.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

    const { result } = renderHook(() => useConfirmBooking(), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({
        bookingId: 'booking-uuid-1',
        payload: { payment_intent_id: 'pi_test_123' },
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
