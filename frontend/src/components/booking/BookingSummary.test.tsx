import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BookingSummary } from './BookingSummary';
import type { Property, PriceBreakdown } from '@/types';

// --------------------------------------------------------------------------
// Fixtures
// --------------------------------------------------------------------------

const mockProperty: Property = {
  id: 'prop-uuid-1',
  title: 'Cosy Studio in Berlin',
  description: 'A lovely place to stay.',
  property_type: 'studio',
  location: {
    lat: 52.52,
    lng: 13.405,
    city: 'Berlin',
    region: null,
    country: 'Germany',
    address: 'Unter den Linden 1',
  },
  max_guests: 2,
  bedrooms: 1,
  bathrooms: 1,
  nightly_rate_eur: 120,
  cleaning_fee_eur: 45,
  amenities: ['wifi', 'kitchen'],
  house_rules: ['no_smoking'],
  photos: [
    { url: 'https://example.com/photo1.jpg', caption: 'Living room' },
    { url: 'https://example.com/photo2.jpg', caption: 'Bedroom' },
  ],
  host: { id: 'host-1', first_name: 'Anna', is_verified: true },
  avg_rating: 4.8,
  review_count: 12,
};

const mockPriceBreakdown: PriceBreakdown = {
  nights: 3,
  nightly_rate_eur: 120,
  subtotal_eur: 360,
  cleaning_fee_eur: 45,
  service_fee_eur: 48.6,
  tax_eur: 0,
  total_eur: 453.6,
};

/** Returns a future timestamp 10 minutes from now. */
function futureExpiry(offsetSeconds = 600): string {
  return new Date(Date.now() + offsetSeconds * 1000).toISOString();
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('BookingSummary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders without crashing', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByTestId('booking-summary')).toBeInTheDocument();
  });

  it('shows property title', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByText('Cosy Studio in Berlin')).toBeInTheDocument();
  });

  it('shows property city and country', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByText(/Berlin.*Germany/)).toBeInTheDocument();
  });

  it('shows first property photo', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    const img = screen.getByAltText('Cosy Studio in Berlin');
    expect(img).toHaveAttribute('src', 'https://example.com/photo1.jpg');
  });

  it('shows check-in and check-out dates', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByText('2026-07-10')).toBeInTheDocument();
    expect(screen.getByText('2026-07-13')).toBeInTheDocument();
  });

  it('shows guest count', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByText(/2 guests/)).toBeInTheDocument();
  });

  it('shows night count', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    // "3 nights" appears in both the guest/nights row and the price row — just
    // check it exists at least once (via getAllByText).
    expect(screen.getAllByText(/3 nights/).length).toBeGreaterThanOrEqual(1);
  });

  describe('Price breakdown', () => {
    it('shows nightly rate × nights', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={2}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry()}
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.getByText(/€120.00 × 3 nights/)).toBeInTheDocument();
    });

    it('shows cleaning fee', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={2}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry()}
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.getByText(/cleaning fee/i)).toBeInTheDocument();
      expect(screen.getByText('€45.00')).toBeInTheDocument();
    });

    it('shows service fee', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={2}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry()}
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.getByText(/service fee/i)).toBeInTheDocument();
      expect(screen.getByText('€48.60')).toBeInTheDocument();
    });

    it('shows total', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={2}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry()}
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.getByTestId('price-total')).toHaveTextContent('€453.60');
    });

    it('hides tax row when tax_eur is 0', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={2}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry()}
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.queryByText(/taxes/i)).not.toBeInTheDocument();
    });

    it('shows tax row when tax_eur > 0', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={2}
          priceBreakdown={{ ...mockPriceBreakdown, tax_eur: 20, total_eur: 473.6 }}
          holdExpiresAt={futureExpiry()}
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.getByText(/taxes/i)).toBeInTheDocument();
    });
  });

  describe('Hold expiry countdown', () => {
    it('shows countdown timer', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={1}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry(600)} // 10 minutes
          onHoldExpired={vi.fn()}
        />,
      );
      expect(screen.getByTestId('hold-countdown')).toBeInTheDocument();
      expect(screen.getByTestId('countdown-timer')).toBeInTheDocument();
    });

    it('displays correct initial countdown for 10 minutes', () => {
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={1}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry(600)} // 10:00
          onHoldExpired={vi.fn()}
        />,
      );
      // Timer should be near 10:00 (±1s tolerance)
      const timerText = screen.getByTestId('countdown-timer').textContent ?? '';
      expect(timerText).toMatch(/^9:\d{2}$|^10:00$/);
    });

    it('calls onHoldExpired when hold expires', () => {
      const onExpired = vi.fn();
      render(
        <BookingSummary
          property={mockProperty}
          checkIn="2026-07-10"
          checkOut="2026-07-13"
          guestCount={1}
          priceBreakdown={mockPriceBreakdown}
          holdExpiresAt={futureExpiry(2)} // expires in 2 seconds
          onHoldExpired={onExpired}
        />,
      );

      act(() => {
        vi.advanceTimersByTime(3000); // advance 3 seconds
      });

      expect(onExpired).toHaveBeenCalled();
    });
  });

  it('renders placeholder div when property has no photos', () => {
    const propertyNoPhotos: Property = { ...mockProperty, photos: [] };
    render(
      <BookingSummary
        property={propertyNoPhotos}
        checkIn="2026-07-10"
        checkOut="2026-07-13"
        guestCount={1}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={futureExpiry()}
        onHoldExpired={vi.fn()}
      />,
    );
    // No img element — placeholder div rendered instead
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  function isoIn(seconds: number): string {
    return new Date(Date.now() + seconds * 1000).toISOString();
  }

  it('marks the countdown urgent (red) when under 2 minutes remain', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2030-06-10"
        checkOut="2030-06-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={isoIn(60)}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByTestId('hold-countdown')).toHaveAttribute('data-urgent', 'true');
  });

  it('countdown is not urgent when more than 2 minutes remain', () => {
    render(
      <BookingSummary
        property={mockProperty}
        checkIn="2030-06-10"
        checkOut="2030-06-13"
        guestCount={2}
        priceBreakdown={mockPriceBreakdown}
        holdExpiresAt={isoIn(300)}
        onHoldExpired={vi.fn()}
      />,
    );
    expect(screen.getByTestId('hold-countdown')).toHaveAttribute('data-urgent', 'false');
  });
});
