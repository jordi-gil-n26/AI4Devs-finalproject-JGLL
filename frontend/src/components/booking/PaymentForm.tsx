'use client';

import React, { useState } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

// --------------------------------------------------------------------------
// Stripe initialisation — only once at module level
// --------------------------------------------------------------------------

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

/**
 * Lazily loaded Stripe promise.  When the key is missing (e.g. CI / unit
 * tests) we fall back to `null` which signals to <Elements> that Stripe is
 * unavailable.  Tests mock the entire `@stripe/react-stripe-js` module.
 */
const stripePromise: Promise<Stripe | null> = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : Promise.resolve(null);

// --------------------------------------------------------------------------
// Inner form — must be rendered inside <Elements>
// --------------------------------------------------------------------------

interface InnerFormProps {
  clientSecret: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}

function InnerPaymentForm({ clientSecret, onSuccess, onError }: InnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not loaded yet.
      return;
    }

    const card = elements.getElement(CardElement);
    if (!card) {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: { card },
    });

    setLoading(false);

    if (error) {
      const msg = error.message ?? 'Payment failed. Please try again.';
      setErrorMessage(msg);
      onError(msg);
    } else if (paymentIntent?.id) {
      onSuccess(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="payment-form">
      <div className="mb-4">
        <label
          className="block text-sm font-medium text-gray-700 mb-2"
          htmlFor="card-element"
        >
          Card details
        </label>
        <div
          id="card-element"
          className="border border-gray-300 rounded-lg px-3 py-3 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent"
          data-testid="card-element-wrapper"
        >
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#111827',
                  '::placeholder': { color: '#9ca3af' },
                },
                invalid: { color: '#ef4444' },
              },
            }}
          />
        </div>
      </div>

      {errorMessage && (
        <div
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
          role="alert"
          data-testid="payment-error"
        >
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 px-6 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        data-testid="pay-button"
      >
        {loading ? (
          <>
            <span
              className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
              aria-hidden
            />
            Processing…
          </>
        ) : (
          'Confirm and pay'
        )}
      </button>
    </form>
  );
}

// --------------------------------------------------------------------------
// Public component — wraps inner form in <Elements>
// --------------------------------------------------------------------------

export interface PaymentFormProps {
  clientSecret: string;
  bookingId: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (msg: string) => void;
}

/**
 * PaymentForm (Slice B / US3)
 *
 * Renders a Stripe card input inside an `<Elements>` provider.
 * On successful `confirmCardPayment`, calls `onSuccess(paymentIntentId)`.
 * On Stripe error, calls `onError(message)` and shows an inline error.
 *
 * For the stub backend the `clientSecret` is `"pi_stub_secret_…"`.
 * Stripe will reject the call in dev — that is expected.  In tests, mock
 * `@stripe/react-stripe-js` entirely.
 */
export function PaymentForm({ clientSecret, bookingId, onSuccess, onError }: PaymentFormProps) {
  // E2E mode: real Stripe Elements can't run headlessly with stub keys. When the
  // app is built for E2E, skip Stripe and complete using the backend's stub
  // PaymentIntent. The stub client secret is `pi_stub_secret_<paymentIntentId>`.
  if (process.env.NEXT_PUBLIC_E2E === 'true') {
    const stubPaymentIntentId = clientSecret.replace(/^pi_stub_secret_/, '');
    return (
      <div data-testid="payment-form-wrapper">
        <p className="text-sm text-gray-500 mb-2">E2E test mode — Stripe bypassed.</p>
        <button
          type="button"
          data-testid="pay-button"
          onClick={() => onSuccess(stubPaymentIntentId)}
          className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium hover:bg-blue-700"
        >
          Pay (E2E)
        </button>
      </div>
    );
  }

  return (
    <div data-testid="payment-form-wrapper" data-booking-id={bookingId}>
      <Elements stripe={stripePromise} options={{ clientSecret }}>
        <InnerPaymentForm
          clientSecret={clientSecret}
          onSuccess={onSuccess}
          onError={onError}
        />
      </Elements>
    </div>
  );
}
