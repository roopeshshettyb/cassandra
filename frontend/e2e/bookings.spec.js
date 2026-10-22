// Bookings: the list, creating a booking against a room type, editing, deleting, and who may do what.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, shown, rowWith: card, unique, day, stubS3, file, answerApi, failApi, openActiveStay } = require('./helpers');

const HOTEL = 'The Lodhi';

const newBookingButton = (page) => page.getByRole('button', { name: '+ New Booking' });
const createButton = (page) => page.getByRole('dialog').getByRole('button', { name: 'Create Booking' });

/**
 * Stay dates of their own, spread over the next few years: the hotel has 12 Deluxe King rooms, and
 * bookings from every browser at once would sell out a shared stay.
 */
function newStay(nights = 2) {
  const start = 60 + Math.floor(Math.random() * 900);
  return { startDate: day(start), endDate: day(start + nights) };
}

/** Opens the New Booking form and uploads a reservation document to it; returns the form. */
async function uploadReservationDocument(page) {
  await page.goto('/bookings');
  await newBookingButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type=file]').setInputFiles(file('reservation.pdf', 'application/pdf'));
  return dialog;
}

/** Fills the New Booking form for a fresh guest; returns the guest's name. */
async function fillNewBooking(page, { startDate, endDate } = newStay()) {
  const guestName = unique('E2E Guest');
  await newBookingButton(page).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Hotel').fill(HOTEL);
  await page.getByRole('option', { name: HOTEL, exact: true }).click();
  await dialog.getByLabel('Check-in').fill(startDate);
  await dialog.getByLabel('Check-out').fill(endDate);
  await dialog.getByLabel('Room Type').click();
  await page.getByRole('option', { name: /^Deluxe King/ }).click();
  await dialog.getByLabel('Guest Email').fill(`${guestName.replace(/\W+/g, '.').toLowerCase()}@example.com`);
  await dialog.getByLabel('Guest Name').fill(guestName);
  return guestName;
}

/** Books a fresh guest through the form; returns the guest's name. */
async function createBooking(page, { sendInvite = false } = {}) {
  await page.goto('/bookings');
  const guestName = await fillNewBooking(page);
  if (sendInvite) await page.getByRole('dialog').getByLabel('Send invite email immediately').check();
  await createButton(page).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(shown(page, guestName)).toBeVisible();
  return guestName;
}

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('lists bookings and searches by room number', async ({ page }) => {
    await page.goto('/bookings');
    for (const name of ['Guest One', 'Guest Two']) await expect(shown(page, name)).toBeVisible();
    await page.getByLabel('Search by room number').fill('512');
    await expect(shown(page, 'The Taj Mahal Palace')).toBeVisible();
    await expect(shown(page, 'ITC Maurya')).toBeHidden();
  });

  test('creates a booking for a room type and sends the invite', async ({ page }) => {
    await createBooking(page, { sendInvite: true });
  });

  test('books a specific room when no room type is picked', async ({ page }) => {
    await page.goto('/bookings');
    const guestName = await fillNewBooking(page, newStay(1));
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Room Type').click();
    await page.getByRole('option', { name: 'No room type — enter a room number' }).click();
    await dialog.getByRole('textbox', { name: 'Room Number' }).fill('102');
    await createButton(page).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, guestName)).toContainText('102');
  });

  test('fills the form from a reservation document', async ({ page }) => {
    // Reading the document is an LLM call, so the extraction is stubbed; the upload goes to S3 (stubbed).
    await stubS3(page);
    await answerApi(page, '/bookings/extract-from-reservation-document', { hotelName: 'Lodhi', guestEmail: 'doc.guest@example.com', guestName: 'Document Guest', startDate: day(80), endDate: day(82) }, 'Form filled from reservation document');
    const dialog = await uploadReservationDocument(page);
    await expect(toast(page, 'Form filled from reservation document')).toBeVisible();
    await expect(dialog.getByLabel('Guest Email')).toHaveValue('doc.guest@example.com');
    await expect(dialog.getByLabel('Hotel')).toHaveValue(HOTEL);
    await expect(dialog).toContainText('Uploaded: reservation.pdf');
  });

  test('reports a reservation document that fails to upload', async ({ page }) => {
    await stubS3(page, { status: 500 });
    const dialog = await uploadReservationDocument(page);
    await expect(toast(page, 'Upload failed')).toBeVisible();
    await expect(dialog).not.toContainText('Uploaded: reservation.pdf');
  });

  test('reports a booking the backend refuses, and keeps the form', async ({ page }) => {
    await failApi(page, '/bookings$', 'Room type is sold out', { method: 'POST' });
    await page.goto('/bookings');
    const guestName = await fillNewBooking(page);
    await createButton(page).click();
    await expect(toast(page, 'Room type is sold out')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Guest Name')).toHaveValue(guestName);
  });

  test('refuses a check-out before the check-in', async ({ page }) => {
    await page.goto('/bookings');
    await fillNewBooking(page, { startDate: day(65), endDate: day(63) });
    await createButton(page).click();
    await expect(toast(page, 'Check-out must be after check-in')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('cancel closes the form without booking', async ({ page }) => {
    await page.goto('/bookings');
    const guestName = await fillNewBooking(page);
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(shown(page, guestName)).toBeHidden();
  });

  test('opens a booking', async ({ page }) => {
    const guestName = await createBooking(page);
    await card(page, guestName).getByText('View', { exact: true }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+/);
  });

  test('edits a booking status', async ({ page }) => {
    const guestName = await createBooking(page);
    await card(page, guestName).getByText('Edit', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Status').click();
    await page.getByRole('option').filter({ hasText: /cancel/i }).first().click();
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect(dialog).toBeHidden();
    await expect(card(page, guestName)).toContainText(/cancel/i);
  });

  test('refuses to save a booking without a room number', async ({ page }) => {
    const guestName = await createBooking(page);
    await card(page, guestName).getByText('Edit', { exact: true }).click();
    const dialog = page.getByRole('dialog');
    // Spaces pass the input's own required check, so this reaches the page's.
    await dialog.getByRole('textbox', { name: 'Room Number' }).fill('   ');
    await dialog.getByRole('button', { name: 'Save Changes' }).click();
    await expect(toast(page, 'Room number is required')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('deletes a booking after confirming', async ({ page }) => {
    const guestName = await createBooking(page);
    await card(page, guestName).getByText('Delete', { exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(shown(page, guestName)).toBeVisible();

    await card(page, guestName).getByText('Delete', { exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(shown(page, guestName)).toBeHidden();
  });

  test('reports a delete the backend refuses, and keeps the booking', async ({ page }) => {
    const guestName = await createBooking(page);
    await failApi(page, '/bookings/\\d+$', 'Booking has charges', { method: 'DELETE' });
    await card(page, guestName).getByText('Delete', { exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(toast(page, 'Booking has charges')).toBeVisible();
    await page.reload();
    await expect(shown(page, guestName)).toBeVisible();
  });
});

test.describe('staff', () => {
  test.use({ storageState: authFile('staff') });

  test('can create bookings', async ({ page }) => {
    await page.goto('/bookings');
    await expect(newBookingButton(page)).toBeVisible();
  });
});

test.describe('guest', () => {
  test.use({ storageState: authFile('guest') });

  test('sees only their own bookings and cannot create one', async ({ page }) => {
    // A guest is first moved on to their active booking; open the list once that has happened.
    await openActiveStay(page);
    await page.getByRole('button', { name: 'Manage Bookings', exact: true }).click();
    await expect(page).toHaveURL(/\/bookings$/);
    await expect(newBookingButton(page)).toHaveCount(0);
    await expect(shown(page, 'Guest Two')).toBeHidden();
  });
});
