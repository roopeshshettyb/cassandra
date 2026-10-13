// A booking's page, the guest portal (BookingDetails.js, GuestPortal/). The test servers have no
// model key (support/env.js), so the concierge answers every message with an error.
const { test, expect } = require('@playwright/test');
const { as, fakeApi, errorToast } = require('./support/ui');
const { apiAs, uniqueRoom, day } = require('./support/api');
const { ACCOUNTS, SEEDED_HOTEL } = require('./support/session');

/** The seeded guest's current booking. */
async function ownBooking() {
  const api = await apiAs('guest');
  const booking = await api.get('/bookings/active');
  await api.dispose();
  return booking;
}

test.describe('guest portal', () => {
  as('guest');

  test('Home shows the stay, and a quick action opens the concierge', async ({ page }) => {
    const booking = await ownBooking();
    await page.goto(`/bookings/${booking.id}?tab=home`);
    await expect(page.getByText('Welcome back,')).toBeVisible();
    // Quick actions come first; laundry requests the other specs make are listed further down.
    await page.getByText('Laundry', { exact: true }).first().click();
    await expect(page).toHaveURL(/tab=concierge/);
  });

  test('Speak to your concierge opens the concierge', async ({ page }) => {
    const booking = await ownBooking();
    await page.goto(`/bookings/${booking.id}?tab=home`);
    await page.getByText('Speak to your concierge').click();
    await expect(page).toHaveURL(/tab=concierge/);
  });

  test('a suggestion can be dismissed, or taken to the concierge', async ({ page }) => {
    const booking = await ownBooking();
    await page.goto(`/bookings/${booking.id}?tab=home`);
    await expect(page.getByText('Turndown Service')).toBeVisible();
    await page.getByTestId('CloseIcon').first().click();
    await expect(page.getByText('Turndown Service')).toHaveCount(0);
    await page.getByRole('button', { name: 'Reserve' }).click();
    await expect(page).toHaveURL(/tab=concierge/);
  });

  test('opens the reservation document', async ({ page, context }) => {
    const api = await apiAs('guest');
    const booking = await api.get('/bookings/active');
    const full = await api.get(`/bookings/${booking.id}`);
    await api.dispose();
    // A document needs a real S3 copy when the booking is made, so the booking and its link are faked.
    await fakeApi(page, `/bookings/${booking.id}$`, 200, { success: true, data: { ...full, reservationDocumentS3Key: 'bookings/e2e/doc.pdf' } });
    await fakeApi(page, `/bookings/${booking.id}/reservation-document-url$`, 200, { success: true, data: { url: 'https://bucket.s3.amazonaws.com/bookings/e2e/doc.pdf' } });
    await context.route(/amazonaws\.com/, (route) => route.fulfill({ status: 200, body: '' }));
    await page.goto(`/bookings/${booking.id}?tab=home`);
    const opened = context.waitForEvent('request', (r) => r.url() === 'https://bucket.s3.amazonaws.com/bookings/e2e/doc.pdf');
    await page.getByRole('button', { name: 'View reservation document' }).click();
    await opened;
  });

  test('View all on Home opens the Requests tab', async ({ page }) => {
    const booking = await ownBooking();
    await page.goto(`/bookings/${booking.id}?tab=home`);
    await page.getByText('View all').click();
    await expect(page).toHaveURL(/tab=requests/);
    await expect(page.getByText('Your Requests')).toBeVisible();
  });

  test('a message to the concierge is shown, and its failure is reported', async ({ page }) => {
    const booking = await ownBooking();
    await page.goto(`/bookings/${booking.id}?tab=concierge&mode=chat`);
    const box = page.getByPlaceholder('Type a message…');
    await box.fill('What time is breakfast?');
    await box.press('Enter');
    await expect(page.getByText('What time is breakfast?').first()).toBeVisible();
    await errorToast(page, { timeout: 30000 });
  });

  test('chatting outside the stay is refused', async ({ page }) => {
    const staff = await apiAs('staff');
    const hotel = (await staff.get('/hotels')).find((h) => h.name === SEEDED_HOTEL);
    const future = await staff.post('/bookings', { hotelId: hotel.id, startDate: day(200), endDate: day(201), guestEmail: ACCOUNTS.guest, roomNumber: uniqueRoom() });
    await staff.dispose();
    await page.goto(`/bookings/${future.id}?tab=concierge`);
    await page.getByTestId('ChatBubbleOutlineIcon').click();
    await errorToast(page);
    await expect(page.getByPlaceholder('Type a message…')).toHaveCount(0);
  });

  test("another guest's booking is refused", async ({ page }) => {
    const api = await apiAs('admin');
    const other = (await api.get('/bookings')).find((b) => b.guest?.email !== ACCOUNTS.guest);
    await api.dispose();
    await page.goto(`/bookings/${other.id}`);
    await errorToast(page);
    await expect(page.getByText('Speak to your concierge')).toHaveCount(0);
  });
});

test.describe('staff on a booking page', () => {
  as('staff');

  test('sees its requests, without the guest Home', async ({ page }) => {
    const booking = await ownBooking();
    await page.goto(`/bookings/${booking.id}`);
    await expect(page.getByText('Your Requests')).toBeVisible();
    await expect(page.getByText('Speak to your concierge')).toHaveCount(0);
  });

  test('a booking that does not exist shows an error', async ({ page }) => {
    await page.goto('/bookings/99999999');
    await errorToast(page);
  });
});
