// Brands: the list, a brand's hours and properties, and deleting one. Brands are created by
// onboarding a hotel with a new brand name, as in the app.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { shown, unique, openCard, onboardHotel } = require('./helpers');

/** Onboards a hotel under a new brand and opens that brand. */
async function createBrand(page) {
  const brandName = unique('E2E Brand');
  const hotel = await onboardHotel(page, { brandName });
  await page.goto('/brands');
  await openCard(page, brandName);
  await expect(page).toHaveURL(/\/brands\/\d+$/);
  return { brandName, hotel };
}

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('lists brands and searches them', async ({ page }) => {
    await page.goto('/brands');
    for (const name of ['Radisson', 'Marriott', 'Hyatt']) await expect(shown(page, name)).toBeVisible();
    await page.getByLabel('Search by name').fill('Hyatt');
    await expect(shown(page, 'Hyatt')).toBeVisible();
    await expect(shown(page, 'Radisson')).toBeHidden();
  });

  test('saves brand hours, and discard undoes an edit', async ({ page }) => {
    await createBrand(page);
    const pool = page.getByPlaceholder('Ex. 6:00 AM – 10:00 PM').first();

    await pool.fill('Not kept');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(pool).not.toHaveValue('Not kept');

    await pool.fill('7:00 AM – 9:00 PM');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Discard' })).toBeHidden();
    await page.reload();
    await expect(page.getByPlaceholder('Ex. 6:00 AM – 10:00 PM').first()).toHaveValue('7:00 AM – 9:00 PM');
  });

  test('lists the brand properties', async ({ page }) => {
    const { hotel } = await createBrand(page);
    await page.getByRole('button', { name: 'Properties', exact: true }).click();
    await expect(shown(page, hotel.name)).toBeVisible();
  });

  test('saves theme and instructions for the brand alone', async ({ page }) => {
    await createBrand(page);
    await page.getByRole('button', { name: 'Theme', exact: true }).click();
    await page.locator('input[type=color]').first().fill('#123456');
    await page.getByRole('button', { name: 'Concierge AI', exact: true }).click();
    const instructions = page.getByPlaceholder(/^Ex. All properties offer complimentary breakfast/);
    await instructions.fill('Recommend the spa on weekends.');
    // Saving can push the change down to every property; here it stays on the brand.
    await page.getByRole('checkbox').uncheck();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Discard' })).toBeHidden();

    await page.reload();
    await page.getByRole('button', { name: 'Concierge AI', exact: true }).click();
    await expect(instructions).toHaveValue('Recommend the spa on weekends.');
    await page.getByRole('button', { name: 'Theme', exact: true }).click();
    await expect(shown(page, '#123456')).toBeVisible();
  });

  test('deletes a brand after confirming', async ({ page }) => {
    const { brandName } = await createBrand(page);
    await page.getByRole('button', { name: 'Danger zone' }).click();

    await page.getByRole('button', { name: 'Delete forever' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Delete forever' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
    await expect(page).toHaveURL(/\/brands$/);
    await expect(shown(page, brandName)).toBeHidden();
  });
});
