// Manage Bookings (ManageBookings.js): create, scan a reservation, filter, edit and delete, and their errors.
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, fakeApi, fakeS3, PNG, successToast } = require('./support/ui');
const { apiAs, uniqueRoom, uniqueEmail, day } = require('./support/api');
const { SEEDED_HOTEL: HOTEL } = require('./support/session');

// The list is searched by room number, so every booking a test makes gets its own (uniqueRoom).
const search = (page) => page.getByLabel('Search by room number');

/** Opens New Booking with the hotel and stay filled, without submitting. */
async function startNewBooking(page) {
  await page.getByText('+ New Booking').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Hotel').fill('Radisson');
  await page.getByRole('option', { name: HOTEL }).click();
  await dialog.getByLabel('Check-in').fill(day(30));
  await dialog.getByLabel('Check-out').fill(day(32));
  await dialog.getByLabel('Guest Email').fill(uniqueEmail('guest'));
  await dialog.getByLabel('Guest Name').fill('E2E Guest');
  return dialog;
}

/** Creates a booking that starts after every other one, so it is the first card of the list (newest stay first). */
async function newestBooking(page) {
  const api = await apiAs('staff');
  const hotel = (await api.get('/hotels')).find((h) => h.name === HOTEL);
  const latest = Math.max(Date.now(), ...(await api.get('/bookings')).map((b) => new Date(b.endTime).getTime()));
  const date = (days) => new Date(latest + days * 86400000).toISOString().slice(0, 10);
  const room = uniqueRoom();
  const booking = await api.post('/bookings', { hotelId: hotel.id, startDate: date(1), endDate: date(2), guestEmail: uniqueEmail('guest'), guestName: 'E2E Guest', roomNumber: room });
  await page.goto('/bookings');
  await expect(page.getByText(room).first()).toBeVisible();
  return { api, booking, room };
}

test.describe('staff bookings', () => {
  as('staff');

  test('creates a booking with a room number', async ({ page }) => {
    const room = uniqueRoom();
    await page.goto('/bookings');
    const dialog = await startNewBooking(page);
    await dialog.getByRole('textbox', { name: 'Room Number' }).fill(room);
    await dialog.getByRole('button', { name: 'Create Booking' }).click();
    await successToast(page);
    await expect(dialog).toBeHidden();
    await search(page).fill(room);
    await expect(page.getByText(room).first()).toBeVisible();
  });

  test('creates a booking from a room type, which assigns the room', async ({ page }) => {
    await page.goto('/bookings');
    const dialog = await startNewBooking(page);
    await dialog.getByLabel('Room Type').click();
    await page.getByRole('option', { name: /Deluxe King/ }).click();
    await expect(dialog.getByLabel('Room number')).not.toHaveValue('');
    await dialog.getByRole('button', { name: 'Create Booking' }).click();
    await successToast(page);
    await expect(dialog).toBeHidden();
  });

  // Reading the document is a model call through the backend, so it is faked; the upload URL is real.
  test('fills the form from a reservation document', async ({ page }) => {
    await fakeS3(page);
    await fakeApi(page, '/bookings/extract-from-reservation-document$', 200, {
      success: true,
      message: 'Form filled',
      data: { guestEmail: 'scanned@cassandratest.local', guestName: 'Scanned Guest', startDate: day(50), endDate: day(52), hotelName: HOTEL },
    });
    await page.goto('/bookings');
    await page.getByText('+ New Booking').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('input[type=file]').setInputFiles({ ...PNG, name: 'reservation.png' });
    await toast(page, 'Form filled');
    await expect(dialog.getByLabel('Guest Email')).toHaveValue('scanned@cassandratest.local');
    await expect(dialog.getByLabel('Check-in')).toHaveValue(day(50));
    await expect(dialog.getByText('Uploaded: reservation.png')).toBeVisible();
  });

  test('a reservation document that cannot be read shows the error', async ({ page }) => {
    await fakeS3(page);
    await failApi(page, '/bookings/extract-from-reservation-document$', 500, 'Could not read the document');
    await page.goto('/bookings');
    await page.getByText('+ New Booking').click();
    await page.getByRole('dialog').locator('input[type=file]').setInputFiles(PNG);
    await toast(page, 'Could not read the document');
  });

  test('will not submit without the required fields', async ({ page }) => {
    await page.goto('/bookings');
    await page.getByText('+ New Booking').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Create Booking' }).click();
    await expect(dialog).toBeVisible();
  });

  test('a refused booking shows the error and keeps the form', async ({ page }) => {
    await page.goto('/bookings');
    await failApi(page, '/bookings$', 400, 'Room already booked');
    const dialog = await startNewBooking(page);
    await dialog.getByRole('textbox', { name: 'Room Number' }).fill(uniqueRoom());
    await dialog.getByRole('button', { name: 'Create Booking' }).click();
    await toast(page, 'Room already booked');
    await expect(dialog).toBeVisible();
  });

  test('Cancel closes New Booking without creating one', async ({ page }) => {
    const room = uniqueRoom();
    await page.goto('/bookings');
    const dialog = await startNewBooking(page);
    await dialog.getByRole('textbox', { name: 'Room Number' }).fill(room);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await search(page).fill(room);
    await expect(page.getByText(room)).toHaveCount(0);
  });

  test('search and the Stay filter narrow the list', async ({ page }) => {
    const { api, room } = await newestBooking(page);
    await search(page).fill(room);
    await expect(page.getByText(room).first()).toBeVisible();
    const stay = page.getByRole('combobox', { name: 'Stay' });
    await stay.click();
    await page.getByRole('option', { name: 'Currently staying' }).click();
    await expect(page.getByText(room)).toHaveCount(0);
    await stay.click();
    await page.getByRole('option', { name: 'Upcoming stays' }).click();
    await expect(page.getByText(room).first()).toBeVisible();
    await api.dispose();
  });

  test('cancels a booking from Edit', async ({ page }) => {
    const { api, booking } = await newestBooking(page);
    await page.getByText('Edit', { exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Status').click();
    await page.getByRole('option', { name: /cancel/i }).click();
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await successToast(page);
    await expect(dialog).toBeHidden();
    expect((await api.get(`/bookings/${booking.id}`)).status).toBe('cancelled');
    await api.dispose();
  });

  test('deletes a booking after confirming', async ({ page }) => {
    const { api, booking, room } = await newestBooking(page);
    await page.getByText('Delete', { exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Delete Booking' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await successToast(page);
    await expect(page.getByText(room)).toHaveCount(0);
    await expect(api.get(`/bookings/${booking.id}`)).rejects.toThrow(/404/);
    await api.dispose();
  });

  test('a failed delete shows the error and keeps the booking', async ({ page }) => {
    const { api, booking } = await newestBooking(page);
    await failApi(page, '/bookings/\\d+$', 500, 'Could not delete');
    await page.getByText('Delete', { exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Could not delete');
    expect((await api.get(`/bookings/${booking.id}`)).id).toBe(booking.id);
    await api.dispose();
  });

  // The search must have narrowed the list before Delete is clicked, or the click lands on a card
  // of the unsearched list.
  test('Delete after a search deletes the booking that was searched for', async ({ page }) => {
    const searched = await newestBooking(page);
    const first = await newestBooking(page);
    await search(page).fill(searched.room);
    await expect(page.getByText(first.room)).toHaveCount(0);
    await page.getByText('Delete', { exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await successToast(page);
    await expect(searched.api.get(`/bookings/${searched.booking.id}`)).rejects.toThrow(/404/);
    await searched.api.dispose();
    await first.api.dispose();
  });

  test('a booking opens its page', async ({ page }) => {
    const { api, booking } = await newestBooking(page);
    await page.getByText(HOTEL).first().click();
    await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}`));
    await api.dispose();
  });
});
