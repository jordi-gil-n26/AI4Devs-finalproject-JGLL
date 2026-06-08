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
    setCheckInDate(e.target.value);
  };

  /**
   * Handles check-out date change
   */
  const handleCheckOutChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCheckOutDate(e.target.value);
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
            value={checkInDate}
            onChange={handleCheckInChange}
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
            value={checkOutDate}
            onChange={handleCheckOutChange}
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
              value={guests}
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (!isNaN(value) && value >= 1) {
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

      {/* Search Button */}
      <div className="mt-6 flex justify-center md:justify-end">
        <button
          type="submit"
          className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </div>
    </form>
  );
};
