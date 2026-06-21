import { expect, type Page } from '@playwright/test';

/** ISO (yyyy-mm-dd) date, [daysFromNow] from today. */
export function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export interface BookedStay {
  email: string;
  propertyId: string;
  checkIn: string;
  checkOut: string;
}

/**
 * Registers a fresh guest and books + confirms a far-future stay, leaving the
 * page on `/confirmation/{id}`. Shared by the booking-journey and
 * cancellation-journey specs.
 *
 * Conventions (frontend-e2e-playwright skill): navigate via the results list
 * (not the Mapbox map), pay via the NEXT_PUBLIC_E2E stub (backend
 * StubPaymentAdapter auto-succeeds), and use dates inside the seeded
 * availability window (CURRENT_DATE..+89) clear of the seed bookings
 * (+10-14, +20-23, +40-45) via a wide per-run offset.
 */
export async function registerAndBookConfirmedStay(page: Page): Promise<BookedStay> {
  const email = `e2e-${Date.now()}@example.com`;
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
  if (!propertyId) {
    throw new Error('no property in search results');
  }

  // 3. Open the property (proves search → detail navigation)
  await firstCard.getByRole('button').first().click();
  await expect(page.getByTestId('property-page')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/property/${propertyId}`));

  // 4. Provide dates via the URL (robust vs. clicking calendar days) → reserve
  await page.goto(`/property/${propertyId}?check_in=${checkIn}&check_out=${checkOut}`);
  const reserve = page.getByTestId('reserve-button');
  await expect(reserve).toBeEnabled();
  await reserve.click();

  // 5. Checkout creates the booking + hold; pay via the E2E stub → confirmation
  await expect(page.getByTestId('pay-button')).toBeVisible();
  await page.getByTestId('pay-button').click();
  await expect(page).toHaveURL(/\/confirmation\/[0-9a-f-]+$/);

  return { email, propertyId, checkIn, checkOut };
}
