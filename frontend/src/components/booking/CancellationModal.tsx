'use client';

import React from 'react';

interface CancellationModalProps {
  isOpen: boolean;
  policy: string;
  refundAmountEur: number | null | undefined;
  isCancelling: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function CancellationModal({
  isOpen,
  policy,
  refundAmountEur,
  isCancelling,
  error,
  onConfirm,
  onClose,
}: CancellationModalProps) {
  if (!isOpen) {
    return null;
  }

  const willRefund = (refundAmountEur ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-modal-title"
      data-testid="cancellation-modal"
    >
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 id="cancel-modal-title" className="text-lg font-semibold text-gray-900">
          Cancel this booking?
        </h2>

        <p className="mt-3 text-sm text-gray-600">{policy}</p>

        <div className="mt-4 rounded-lg bg-gray-50 p-3 text-sm">
          {willRefund ? (
            <p className="text-gray-900">
              You will be refunded{' '}
              <span className="font-bold" data-testid="refund-amount">
                €{(refundAmountEur ?? 0).toFixed(2)}
              </span>
              .
            </p>
          ) : (
            <p className="text-gray-900" data-testid="refund-amount">
              This cancellation is within 48 hours of check-in, so you will receive{' '}
              <span className="font-bold">no refund</span>.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            data-testid="dismiss-cancel-button"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Keep booking
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isCancelling}
            data-testid="confirm-cancel-button"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isCancelling ? 'Cancelling…' : 'Confirm cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}
