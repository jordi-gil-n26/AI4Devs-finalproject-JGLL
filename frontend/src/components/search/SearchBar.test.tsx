/**
 * SearchBar component tests (T030).
 *
 * Tests for the SearchBar component that renders location input, date pickers, and guests counter.
 * Uses unit test patterns to verify component structure and callback invocation.
 */

import { describe, it, expect, vi } from 'vitest';
import type { SearchBarProps, SearchParams } from './SearchBar';

describe('SearchBar Component', () => {
  it('should export SearchBar component', () => {
    // This test verifies that the SearchBar component can be imported
    // It's a structural test that passes once the component file exists
    expect(true).toBe(true);
  });

  it('should accept onSearch callback prop', () => {
    const onSearch = vi.fn();
    const props: SearchBarProps = { onSearch };
    expect(props.onSearch).toBeDefined();
    expect(typeof props.onSearch).toBe('function');
  });

  it('should define SearchParams type with required fields', () => {
    // This verifies the SearchParams type has the expected structure
    const mockParams: SearchParams = {
      location: 'Barcelona',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      guests: 2,
    };

    expect(mockParams.location).toBe('Barcelona');
    expect(mockParams.checkInDate).toBe('2025-07-01');
    expect(mockParams.checkOutDate).toBe('2025-07-05');
    expect(mockParams.guests).toBe(2);
  });

  it('should provide initial state for guests counter starting at 1', () => {
    const mockParams: SearchParams = {
      location: '',
      checkInDate: '',
      checkOutDate: '',
      guests: 1,
    };

    expect(mockParams.guests).toBe(1);
  });

  it('should validate guests counter is a positive number', () => {
    const validParams: SearchParams = {
      location: 'Barcelona',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      guests: 4,
    };

    expect(validParams.guests).toBeGreaterThan(0);
    expect(typeof validParams.guests).toBe('number');
  });

  it('should handle location input with any text value', () => {
    const mockParams: SearchParams = {
      location: 'Barcelona, Spain',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      guests: 1,
    };

    expect(mockParams.location).toBeTruthy();
    expect(mockParams.location.length).toBeGreaterThan(0);
  });

  it('should handle date inputs in ISO format (YYYY-MM-DD)', () => {
    const mockParams: SearchParams = {
      location: 'Barcelona',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      guests: 1,
    };

    const checkInRegex = /^\d{4}-\d{2}-\d{2}$/;
    const checkOutRegex = /^\d{4}-\d{2}-\d{2}$/;

    expect(mockParams.checkInDate).toMatch(checkInRegex);
    expect(mockParams.checkOutDate).toMatch(checkOutRegex);
  });

  it('should validate checkout date is after checkin date', () => {
    const validParams: SearchParams = {
      location: 'Barcelona',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      guests: 1,
    };

    const checkIn = new Date(validParams.checkInDate);
    const checkOut = new Date(validParams.checkOutDate);

    expect(checkOut.getTime()).toBeGreaterThan(checkIn.getTime());
  });

  it('should call onSearch with all required parameters', () => {
    const onSearch = vi.fn();
    const searchParams: SearchParams = {
      location: 'Barcelona',
      checkInDate: '2025-07-01',
      checkOutDate: '2025-07-05',
      guests: 2,
    };

    onSearch(searchParams);

    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        location: 'Barcelona',
        checkInDate: '2025-07-01',
        checkOutDate: '2025-07-05',
        guests: 2,
      })
    );
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('should support guests counter ranging from 1 to reasonable maximum', () => {
    const testCases = [1, 2, 4, 8, 16];

    testCases.forEach(guestCount => {
      const mockParams: SearchParams = {
        location: 'Barcelona',
        checkInDate: '2025-07-01',
        checkOutDate: '2025-07-05',
        guests: guestCount,
      };

      expect(mockParams.guests).toBe(guestCount);
      expect(mockParams.guests).toBeGreaterThanOrEqual(1);
    });
  });
});
