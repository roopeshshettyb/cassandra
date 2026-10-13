// Manage Hotels (ManageHotels.js) and adding a hotel (AddHotelOnboarding.js).
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, fakeApi, errorToast, successToast } = require('./support/ui');
const { apiAs, uniqueName } = require('./support/api');
const { SEEDED_HOTEL } = require('./support/session');

// Seeded (backend/src/seed.ts): owner1 runs these three; staff1 works at the first.
const OWNER_HOTELS = [SEEDED_HOTEL, 'The Taj Mahal Palace', 'ITC Maurya'];
const NOT_OWNERS = 'Burj Al Arab Jumeirah';

const hotelName = (page, name) => page.getByText(name, { exact: true }).first();
const search = (page) => page.getByLabel('Search by name or address');

test.describe('admin hotels', () => {
  as('admin');

  test('lists every hotel', async ({ page }) => {
    await page.goto('/hotels');
    for (const name of [...OWNER_HOTELS, NOT_OWNERS]) await expect(hotelName(page, name)).toBeVisible();
    await expect(page.getByText('Total Properties')).toBeVisible();
  });

  test('search narrows the list, and a search that matches nothing shows none', async ({ page }) => {
    await page.goto('/hotels');
    await search(page).fill('Taj Mahal');
    await expect(hotelName(page, 'The Taj Mahal Palace')).toBeVisible();
    await expect(page.getByText(NOT_OWNERS, { exact: true })).toHaveCount(0);
    await search(page).fill('zz-no-such-hotel');
    await expect(page.getByText('The Taj Mahal Palace', { exact: true })).toHaveCount(0);
  });

  test('switches between the table and the gallery', async ({ page }) => {
    await page.goto('/hotels');
    await page.getByTestId('TableRowsIcon').click();
    await expect(page.getByText('Property', { exact: true })).toBeVisible();
    await expect(hotelName(page, 'ITC Maurya')).toBeVisible();
    await page.getByTestId('GridViewIcon').click();
    await expect(page.getByRole('button', { name: 'Open', exact: true }).first()).toBeVisible();
  });

  test('a list that fails to load shows the error', async ({ page }) => {
    await failApi(page, '/hotels(\\?.*)?$', 500, 'Hotels unavailable');
    await page.goto('/hotels');
    await toast(page, 'Hotels unavailable');
  });
});

test.describe('owner hotels', () => {
  as('owner');

  test('lists only their hotels', async ({ page }) => {
    await page.goto('/hotels');
    for (const name of OWNER_HOTELS) await expect(hotelName(page, name)).toBeVisible();
    await expect(page.getByText(NOT_OWNERS, { exact: true })).toHaveCount(0);
  });

  test("another organisation's hotel is not shown", async ({ page }) => {
    const api = await apiAs('admin');
    const other = (await api.get('/hotels')).find((h) => h.name === NOT_OWNERS);
    await api.dispose();
    await page.goto(`/hotels/${other.id}`);
    await errorToast(page);
    await expect(page.getByPlaceholder('Ex. Grand Oberoi Mumbai')).toHaveCount(0);
  });
});

test.describe('staff hotels', () => {
  as('staff');

  test('lists their hotel, without Add Hotel', async ({ page }) => {
    await page.goto('/hotels');
    await expect(hotelName(page, SEEDED_HOTEL)).toBeVisible();
    await expect(page.getByText(NOT_OWNERS, { exact: true })).toHaveCount(0);
    await expect(page.getByText('+ Add Hotel')).toHaveCount(0);
  });
});

// Search, analyze and extract call Google Maps and a web search through the backend, so they are
// faked; saving the hotel (finalize) is real.
test.describe('adding a hotel', () => {
  as('owner');

  const PLACE = { id: 'e2e-place', name: 'E2E Seaside Inn', address: '1 Shore Road, Goa' };

  /** Opens Add Hotel and picks the faked search result. */
  async function pickPlace(page) {
    await fakeApi(page, '/hotels/onboarding/search\\?', 200, { success: true, data: [PLACE] });
    await page.goto('/hotels');
    await page.getByText('+ Add Hotel').click();
    await page.getByPlaceholder('e.g. Radisson Blu Pune Kharadi').fill('Seaside');
    await page.getByRole('option', { name: /E2E Seaside Inn/ }).click();
  }

  test('searches, reads the hotel, and saves it after review', async ({ page }) => {
    const name = uniqueName('Seaside Inn');
    await fakeApi(page, '/hotels/onboarding/analyze/', 200, { success: true, data: {} });
    await fakeApi(page, '/hotels/onboarding/extract$', 200, { success: true, data: { name, address: `${name} Road, Goa`, checkInTime: '14:00', checkOutTime: '11:00' } });
    await pickPlace(page);
    await expect(page.getByLabel('Hotel name')).toHaveValue(name);
    await page.getByRole('button', { name: 'Confirm & Save' }).click();
    await successToast(page);
    await search(page).fill(name);
    await expect(hotelName(page, name)).toBeVisible();
  });

  test('asks for the website when the maps listing has none', async ({ page }) => {
    await fakeApi(page, '/hotels/onboarding/analyze/', 200, { success: true, data: { needsWebsite: true } });
    await pickPlace(page);
    await expect(page.getByText('Website not found on Google Maps')).toBeVisible();
    await expect(page.getByLabel('Hotel Website URL')).toBeVisible();
  });

  test('refuses a hotel that already exists', async ({ page }) => {
    await fakeApi(page, '/hotels/onboarding/analyze/', 200, { success: true, data: { existingHotel: { name: 'ITC Maurya' } } });
    await pickPlace(page);
    await toast(page, '"ITC Maurya" already exists');
  });

  test('a failed read returns to the search and shows the error', async ({ page }) => {
    await fakeApi(page, '/hotels/onboarding/analyze/', 200, { success: true, data: {} });
    await failApi(page, '/hotels/onboarding/extract$', 500, 'Could not read the hotel');
    await pickPlace(page);
    await toast(page, 'Could not read the hotel');
    await expect(page.getByPlaceholder('e.g. Radisson Blu Pune Kharadi')).toBeVisible();
  });

  test('a search with no matches says so', async ({ page }) => {
    await fakeApi(page, '/hotels/onboarding/search\\?', 200, { success: true, data: [] });
    await page.goto('/hotels');
    await page.getByText('+ Add Hotel').click();
    await page.getByPlaceholder('e.g. Radisson Blu Pune Kharadi').fill('Nowhere');
    await expect(page.getByText('No results found')).toBeVisible();
  });
});
