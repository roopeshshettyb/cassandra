// Hotels: the list and AI onboarding of a new hotel. The detail page is hotel-details.spec.js.
// Onboarding's place search, analysis and extraction call Google and an LLM, so those three
// endpoints are stubbed; the final save goes to the real backend.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, failApi, newPlace, stubOnboarding, searchAndPick } = require('./helpers');

const SEEDED_HOTELS = 13;

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('lists every hotel', async ({ page }) => {
    await page.goto('/hotels');
    for (const name of ['Radisson Blu Plaza Delhi', 'The Taj Mahal Palace', 'ITC Maurya']) await expect(page.getByText(name, { exact: true })).toBeVisible();
    expect(await page.getByRole('button', { name: 'Open' }).count()).toBeGreaterThanOrEqual(SEEDED_HOTELS);
  });

  test('searches by name, and says when nothing matches', async ({ page }) => {
    await page.goto('/hotels');
    await page.getByLabel('Search by name or address').fill('Maurya');
    await expect(page.getByText('ITC Maurya', { exact: true })).toBeVisible();
    await expect(page.getByText('The Taj Mahal Palace', { exact: true })).toBeHidden();

    await page.getByLabel('Search by name or address').fill('no hotel is called this');
    await expect(page.getByText('No data found')).toBeVisible();
  });

  test('switches between gallery and table', async ({ page }) => {
    await page.goto('/hotels');
    await page.getByRole('button').filter({ has: page.getByTestId('TableRowsIcon') }).click();
    await expect(page.getByText('Check-in / Check-out')).toBeVisible();
    await expect(page.getByText('Radisson Blu Plaza Delhi', { exact: true })).toBeVisible();
  });

  test('onboards a new hotel', async ({ page }) => {
    const place = newPlace();
    await stubOnboarding(page, place);
    await page.goto('/hotels');
    await searchAndPick(page, place);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Hotel name')).toHaveValue(place.name);
    await dialog.getByLabel('Wifi password').fill('e2e-wifi');
    await page.getByRole('button', { name: 'Confirm & Save' }).click();

    await expect(toast(page, 'Hotel onboarded successfully')).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(place.name, { exact: true })).toBeVisible();
  });

  test('asks for the website when the place has none', async ({ page }) => {
    const place = newPlace();
    await stubOnboarding(page, place, { analysis: { needsWebsite: true } });
    await page.goto('/hotels');
    await searchAndPick(page, place);

    await expect(page.getByText('Website not found on Google Maps')).toBeVisible();
    await page.getByLabel('Hotel Website URL').fill('https://example.com');
    await page.getByRole('button', { name: 'Start AI Analysis' }).click();
    await expect(page.getByRole('dialog').getByLabel('Hotel name')).toHaveValue(place.name);
  });

  test('refuses a hotel that is already onboarded', async ({ page }) => {
    const place = newPlace();
    await stubOnboarding(page, place, { analysis: { existingHotel: { name: 'ITC Maurya' } } });
    await page.goto('/hotels');
    await searchAndPick(page, place);
    await expect(toast(page, '"ITC Maurya" already exists')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Radisson Blu Pune Kharadi')).toBeVisible();
  });

  test('reports a failed place search', async ({ page }) => {
    await failApi(page, '/hotels/onboarding/search', 'Places lookup failed');
    await page.goto('/hotels');
    await page.getByRole('button', { name: '+ Add Hotel' }).click();
    await page.getByPlaceholder('e.g. Radisson Blu Pune Kharadi').fill('Anything');
    await expect(toast(page, 'Places lookup failed')).toBeVisible();
  });
});

test.describe('owner', () => {
  test.use({ storageState: authFile('owner') });

  test('can add hotels', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page.getByRole('button', { name: '+ Add Hotel' })).toBeVisible();
  });
});

test.describe('staff', () => {
  test.use({ storageState: authFile('staff') });

  test('cannot add hotels', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page.getByRole('button', { name: 'Open' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Add Hotel' })).toHaveCount(0);
  });
});
