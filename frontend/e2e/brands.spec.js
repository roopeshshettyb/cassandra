// Manage Brands and a brand's page (ManageBrands.js, BrandDetails.js). Brands are admin-only.
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, errorToast, successToast, tab, save } = require('./support/ui');
const { apiAs, uniqueName } = require('./support/api');

/** A new brand with one hotel: saving an onboarded hotel with a brand name creates the brand. */
async function newBrand() {
  const api = await apiAs('admin');
  const brandName = uniqueName('Brand');
  const hotel = await api.post('/hotels/onboarding/finalize', { name: `${brandName} Hotel`, address: `${brandName} Road`, brandName });
  const brand = (await api.get('/hotels/brands')).find((b) => b.name === brandName);
  return { api, brand, hotel };
}

/** Opens a brand's page. */
async function openBrand(page, id) {
  await page.goto(`/brands/${id}`);
  await expect(page.getByRole('button', { name: 'Danger zone' })).toBeVisible();
}

test.describe('admin brands', () => {
  as('admin');

  test('lists the brands, and a card opens its brand', async ({ page }) => {
    await page.goto('/brands');
    for (const name of ['Radisson', 'Taj Hotels', 'Marriott']) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await page.getByText('Radisson', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/brands\/\d+$/);
  });

  test("the Properties tab lists the brand's hotels", async ({ page }) => {
    const { api, brand, hotel } = await newBrand();
    await openBrand(page, brand.id);
    await tab(page, 'Properties');
    await expect(page.getByText(hotel.name).first()).toBeVisible();
    await api.dispose();
  });

  test('saves the hours and passes them on to its hotels', async ({ page }) => {
    const { api, brand, hotel } = await newBrand();
    await openBrand(page, brand.id);
    await tab(page, 'Hours & Wi-Fi');
    await page.getByPlaceholder('Ex. Hotel@2024').fill('brand-wifi');
    await save(page);
    await successToast(page);
    expect((await api.get(`/hotels/${hotel.id}`)).wifiPassword).toBe('brand-wifi');
    await api.dispose();
  });

  test('saves the theme and concierge instructions for the brand alone when not passed on', async ({ page }) => {
    const { api, brand, hotel } = await newBrand();
    await openBrand(page, brand.id);
    await tab(page, 'Theme');
    await page.locator('input[type=color]').first().fill('#123456');
    await tab(page, 'Concierge AI');
    await page.locator('textarea:visible').first().fill('Brand instructions');
    await page.getByRole('checkbox').uncheck();
    await save(page);
    await successToast(page);
    await page.reload();
    await tab(page, 'Theme');
    await expect(page.getByText('#123456')).toBeVisible();
    await tab(page, 'Concierge AI');
    await expect(page.locator('textarea:visible').first()).toHaveValue('Brand instructions');
    expect((await api.get(`/hotels/${hotel.id}`)).llmInstructions).not.toBe('Brand instructions');
    await api.dispose();
  });

  test('a failed save shows the error', async ({ page }) => {
    const { api, brand } = await newBrand();
    await openBrand(page, brand.id);
    await failApi(page, '/hotels/brands/\\d+$', 500, 'Brand not saved');
    await tab(page, 'Concierge AI');
    await page.locator('textarea:visible').first().fill('Will not save');
    await save(page);
    await toast(page, 'Brand not saved');
    await api.dispose();
  });

  test('Cancel keeps the brand, and Delete forever removes it', async ({ page }) => {
    const { api, brand } = await newBrand();
    await openBrand(page, brand.id);
    await tab(page, 'Danger zone');
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.getByRole('heading', { name: 'Delete brand' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
    await expect(page).toHaveURL(/\/brands$/);
    await expect(page.getByText(brand.name, { exact: true })).toHaveCount(0);
    await api.dispose();
  });

  test('a brand that does not exist shows an error', async ({ page }) => {
    await page.goto('/brands/99999999');
    await errorToast(page);
  });
});
