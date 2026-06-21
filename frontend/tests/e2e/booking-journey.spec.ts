import { test, expect } from '@playwright/test';
import { registerAndBookConfirmedStay } from './helpers';

/**
 * Whole booking journey, real browser → real frontend → real backend → Postgres.
 * register → search (by location + dates) → open a property → reserve → checkout
 * → pay (E2E stub) → confirmation.
 *
 * The journey steps live in `registerAndBookConfirmedStay` (shared with the
 * cancellation journey); this spec asserts the confirmation outcome.
 */
test('guest registers, searches, books a property, and reaches confirmation', async ({ page }) => {
  await registerAndBookConfirmedStay(page);

  await expect(page.getByRole('heading', { name: 'Booking Confirmed!' })).toBeVisible();
  await expect(page.getByText(/^BK-/)).toBeVisible(); // reference number
});
