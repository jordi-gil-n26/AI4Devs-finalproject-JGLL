'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import type { BookingSummary, BookingStatus } from '@/types';

interface TripCardProps {
  trip: BookingSummary;
  onClick: (bookingId: string) => void;
}

const STATUS_STYLES: Record<BookingStatus, string> = {
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
  completed: 'bg-gray-100 text-gray-700',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TripCard({ trip, onClick }: TripCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(trip.id)}
      aria-label={`View booking ${trip.reference_number}`}
      data-testid="trip-card"
      data-booking-id={trip.id}
      className="group flex w-full gap-4 overflow-hidden rounded-lg bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-md bg-gray-200">
        <img
          src={trip.property_photo_url}
          alt={`Photo of ${trip.property_title}`}
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/200x200?text=No+Image';
          }}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{trip.property_title}</h3>
          <span
            data-testid="trip-status"
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[trip.status]}`}
          >
            {trip.status}
          </span>
        </div>
        <p className="flex items-center gap-1 text-xs text-gray-600">
          <MapPin className="h-3 w-3" aria-hidden />
          {trip.city}
        </p>
        <p className="text-xs text-gray-600">
          {formatDate(trip.check_in)} → {formatDate(trip.check_out)}
        </p>
        <p className="text-xs text-gray-500">{trip.reference_number}</p>
        <p className="mt-auto text-sm font-bold text-gray-900">€{trip.total_eur.toFixed(2)}</p>
      </div>
    </button>
  );
}
