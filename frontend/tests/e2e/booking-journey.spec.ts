import { test, expect } from '@playwright/test';

/**
 * Whole booking journey, real browser → real frontend → real backend → Postgres.
 * register → search (by location + dates) → open a property → reserve → checkout
 * → pay (E2E stub) → confirmation.
 *
 * Conventions (see the frontend-e2e-playwright skill):
 *  - navigate via the results list, not the Mapbox map (dummy token);
 *  - payment uses the NEXT_PUBLIC_E2E stub path (the backend StubPaymentAdapter
 *    auto-succeeds), so no real Stripe;
 *  - dates are computed relative to "today" within the seeded availability window
 *    (CURRENT_DATE..+89) and clear of the seed bookings (+10-14, +20-23, +40-45).
 */

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

test('guest registers, searches, books a property, and reaches confirmation', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  // 46..85 days out: inside the +89-day seeded availability window and entirely
  // clear of the seed bookings (which end at +45). A fresh DB (CI) always has
  // these free; the wide per-run offset also reduces collisions when re-running
  // against a persistent local stack.
  const offset = 46 + (Date.now() % 40);
  const checkIn = isoDate(offset);
  const checkOut = isoDate(offset + 3);

  // 1. Register → lands on /search
  await page.goto('/register');
  await page.getByTestId('register-first-name').fill('E2E');
  await page.getByTestId('register-last-name').fill('Tester');
  await page.getByTestId('register-email').fill(email);
  await page.getByTestId('register-password').fill('pass1234');
  await page.getByTestId('register-submit').click();
  await expect(page).toHaveURL(/\/search/);

  // 2. Search Barcelona with dates → results list renders
  await page.getByTestId('search-location').fill('barcelona');
  await page.locator('#check-in').fill(checkIn);
  await page.locator('#check-out').fill(checkOut);
  await page.getByTestId('search-submit').click();

  const firstCard = page.locator('[data-testid="property-grid"] [data-property-id]').first();
  await expect(firstCard).toBeVisible();
  const propertyId = await firstCard.getAttribute('data-property-id');
  expect(propertyId).toBeTruthy();

  // 3. Open the property (proves search → detail navigation)
  await firstCard.getByRole('button').first().click();
  await expect(page.getByTestId('property-page')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/property/${propertyId}`));

  // 4. Provide dates via the URL (robust vs. clicking absolute calendar days) so
  //    Reserve enables, then reserve → checkout.
  await page.goto(`/property/${propertyId}?check_in=${checkIn}&check_out=${checkOut}`);
  const reserve = page.getByTestId('reserve-button');
  await expect(reserve).toBeEnabled();
  await reserve.click();

  // 5. Checkout creates the booking + hold; pay via the E2E stub → confirmation
  await expect(page.getByTestId('pay-button')).toBeVisible();
  await page.getByTestId('pay-button').click();

  await expect(page).toHaveURL(/\/confirmation\/[0-9a-f-]+$/);
  await expect(page.getByRole('heading', { name: 'Booking Confirmed!' })).toBeVisible();
  await expect(page.getByText(/^BK-/)).toBeVisible(); // reference number
});
