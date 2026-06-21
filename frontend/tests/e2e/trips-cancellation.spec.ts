import { test, expect } from '@playwright/test';
import { registerAndBookConfirmedStay } from './helpers';

/**
 * Cancellation journey, real browser → frontend → backend → Postgres:
 * book a confirmed stay → My Trips → open the trip → cancel → see it cancelled.
 *
 * The stay is far in the future (>48h), so the cancellation policy grants a
 * full refund (the modal shows the refund amount before confirming).
 */
test('guest cancels a confirmed booking from My Trips and sees it cancelled', async ({ page }) => {
  await registerAndBookConfirmedStay(page);

  // Confirmation → My Trips
  await page.getByTestId('view-trips-button').click();
  await expect(page).toHaveURL(/\/trips(\?|$)/);

  // Fresh guest has exactly one trip — open it.
  const card = page.getByTestId('trip-card').first();
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+$/);

  // Detail shows a confirmed, cancellable booking.
  await expect(page.getByText('confirmed').first()).toBeVisible();
  const openCancel = page.getByTestId('open-cancel-button');
  await expect(openCancel).toBeVisible();
  await openCancel.click();

  // Modal shows the refund (far-future → full refund) → confirm.
  await expect(page.getByTestId('cancellation-modal')).toBeVisible();
  await expect(page.getByTestId('refund-amount')).toBeVisible();
  await page.getByTestId('confirm-cancel-button').click();

  // Cancellation persisted + refetched: status is cancelled, cancel CTA is gone.
  await expect(page.getByText('cancelled').first()).toBeVisible();
  await expect(page.getByTestId('open-cancel-button')).toHaveCount(0);
});
