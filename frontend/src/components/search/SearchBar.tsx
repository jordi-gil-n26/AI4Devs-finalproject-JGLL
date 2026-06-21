'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';

/**
 * SearchParams type for the SearchBar component.
 * Passed to the onSearch callback when the user submits the form.
 */
export type SearchParams = {
  location: string;
  checkInDate: string;
  checkOutDate: string;
  guests: number;
};

/**
 * SearchBar component props
 */
export interface SearchBarProps {
  onSearch: (params: SearchParams) => void;
}

/**
 * SearchBar Component (T030)
 *
 * A controlled form component that captures search parameters for property search:
 * - Location input with autocomplete placeholder
 * - Check-in date picker
 * - Check-out date picker
 * - Guests counter with +/- controls
 * - Search button to submit the form
 *
 * All inputs are controlled and managed via React state.
 * On form submission, calls the onSearch callback with current search parameters.
 */
export const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [location, setLocation] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [guests, setGuests] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Local yyyy-mm-dd "today" — used to disable past check-in dates.
  const todayIso = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const validateDates = (ci: string, co: string): string | null => {
    if (ci && ci < todayIso) return "Check-in date can't be in the past";
    if (ci && co && co <= ci) return 'Check-out date must be after check-in date';
    return null;
  };

  /**
   * Handles location input change
   */
  const handleLocationChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocation(e.target.value);
  };

  /**
   * Handles check-in date change
   */
  const handleCheckInChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCheckInDate(value);
    if (checkOutDate && value && checkOutDate <= value) {
      setCheckOutDate('');
    }
    setError(null);
  };

  /**
   * Handles check-out date change
   */
  const handleCheckOutChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCheckOutDate(e.target.value);
    setError(null);
  };

  /**
   * Increments guests counter
   */
  const handleIncrement = () => {
    setGuests(prev => prev + 1);
  };

  /**
   * Decrements guests counter (minimum 1)
   */
  const handleDecrement = () => {
    setGuests(prev => (prev > 1 ? prev - 1 : 1));
  };

  /**
   * Handles form submission
   */
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const validationError = validateDates(checkInDate, checkOutDate);
    if (validationError) {
      setError(validationError);
      return;
    }

    // Call the onSearch callback with current search parameters
    onSearch({
      location,
      checkInDate,
      checkOutDate,
      guests,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="search-form"
      className="w-full bg-white rounded-lg shadow-lg p-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Location Input */}
        <div className="md:col-span-2">
          <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
            Where
          </label>
          <input
            id="location"
            type="text"
            data-testid="search-location"
            placeholder="Where are you going?"
            value={location}
            onChange={handleLocationChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Check-in Date Picker */}
        <div>
          <label htmlFor="check-in" className="block text-sm font-medium text-gray-700 mb-1">
            Check-in
          </label>
          <input
            id="check-in"
            type="date"
            min={todayIso}
            value={checkInDate}
            onChange={handleCheckInChange}
            onBlur={() => setError(validateDates(checkInDate, checkOutDate))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Check-out Date Picker */}
        <div>
          <label htmlFor="check-out" className="block text-sm font-medium text-gray-700 mb-1">
            Check-out
          </label>
          <input
            id="check-out"
            type="date"
            min={checkInDate}
            value={checkOutDate}
            onChange={handleCheckOutChange}
            onBlur={() => setError(validateDates(checkInDate, checkOutDate))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Guests Counter */}
        <div>
          <label htmlFor="guests" className="block text-sm font-medium text-gray-700 mb-1">
            Guests
          </label>
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              type="button"
              onClick={handleDecrement}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100"
              aria-label="Decrease guests"
            >
              -
            </button>
            <input
              id="guests"
              type="number"
              min="1"
              max="20"
              value={guests}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1 && value <= 20) {
                  setGuests(value);
                }
              }}
              className="flex-1 text-center border-none focus:outline-none py-2"
            />
            <button
              type="button"
              onClick={handleIncrement}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100"
              aria-label="Increase guests"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p data-testid="search-error" role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Search Button */}
      <div className="mt-6 flex justify-center md:justify-end">
        <button
          type="submit"
          data-testid="search-submit"
          className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
};
