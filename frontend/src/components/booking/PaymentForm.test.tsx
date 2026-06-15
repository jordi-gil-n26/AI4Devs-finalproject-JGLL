import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentForm } from './PaymentForm';

// --------------------------------------------------------------------------
// Mock @stripe/react-stripe-js
// --------------------------------------------------------------------------

// We need useStripe and useElements to be controllable in tests.
const mockConfirmCardPayment = vi.fn();
const mockGetElement = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'stripe-elements' }, children),
  CardElement: () =>
    React.createElement('div', { 'data-testid': 'stripe-card-element' }),
  useStripe: () => ({
    confirmCardPayment: mockConfirmCardPayment,
  }),
  useElements: () => ({
    getElement: mockGetElement,
  }),
}));

// Mock stripe-js loadStripe — it won't be called since we mock useStripe
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: vi.fn().mockResolvedValue(null),
}));

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('PaymentForm', () => {
  const defaultProps = {
    clientSecret: 'pi_stub_secret_test_123',
    bookingId: 'booking-uuid-1',
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // By default, getElement returns a mock card element
    mockGetElement.mockReturnValue({ id: 'mock-card' });
  });

  it('renders the payment form wrapper', () => {
    render(<PaymentForm {...defaultProps} />);
    expect(screen.getByTestId('payment-form-wrapper')).toBeInTheDocument();
  });

  it('renders the Stripe Elements wrapper', () => {
    render(<PaymentForm {...defaultProps} />);
    expect(screen.getByTestId('stripe-elements')).toBeInTheDocument();
  });

  it('renders card element inside the form', () => {
    render(<PaymentForm {...defaultProps} />);
    expect(screen.getByTestId('stripe-card-element')).toBeInTheDocument();
  });

  it('renders pay button', () => {
    render(<PaymentForm {...defaultProps} />);
    expect(screen.getByTestId('pay-button')).toBeInTheDocument();
    expect(screen.getByTestId('pay-button')).toHaveTextContent(/confirm and pay/i);
  });

  it('attaches bookingId to wrapper element', () => {
    render(<PaymentForm {...defaultProps} />);
    expect(screen.getByTestId('payment-form-wrapper')).toHaveAttribute(
      'data-booking-id',
      'booking-uuid-1',
    );
  });

  it('calls onSuccess with paymentIntentId on successful payment', async () => {
    mockConfirmCardPayment.mockResolvedValueOnce({
      error: null,
      paymentIntent: { id: 'pi_success_123', status: 'succeeded' },
    });

    const onSuccess = vi.fn();
    render(<PaymentForm {...defaultProps} onSuccess={onSuccess} />);

    fireEvent.submit(screen.getByTestId('payment-form'));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('pi_success_123'));
  });

  it('shows error message when confirmCardPayment returns error', async () => {
    mockConfirmCardPayment.mockResolvedValueOnce({
      error: { message: 'Your card was declined.' },
      paymentIntent: null,
    });

    const onError = vi.fn();
    render(<PaymentForm {...defaultProps} onError={onError} />);

    fireEvent.submit(screen.getByTestId('payment-form'));

    await waitFor(() =>
      expect(screen.getByTestId('payment-error')).toBeInTheDocument(),
    );
    expect(screen.getByTestId('payment-error')).toHaveTextContent(/your card was declined/i);
    expect(onError).toHaveBeenCalledWith('Your card was declined.');
  });

  it('does not show error message initially', () => {
    render(<PaymentForm {...defaultProps} />);
    expect(screen.queryByTestId('payment-error')).not.toBeInTheDocument();
  });

  it('shows loading state while payment is processing', async () => {
    // Never resolve to keep loading state visible
    mockConfirmCardPayment.mockReturnValueOnce(new Promise(() => {}));

    render(<PaymentForm {...defaultProps} />);

    fireEvent.submit(screen.getByTestId('payment-form'));

    await waitFor(() =>
      expect(screen.getByTestId('pay-button')).toHaveTextContent(/processing/i),
    );
  });
});
