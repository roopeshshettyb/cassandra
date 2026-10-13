// A hotel's restaurant menu (the Restaurant tab, ManageRestaurant.js).
const { test, expect } = require('@playwright/test');
const { as, openHotel, toast, failApi, fakeApi, fakeS3, PNG } = require('./support/ui');
const { uniqueName } = require('./support/api');
const { SEEDED_HOTEL } = require('./support/session');

/** Opens the Restaurant tab of the staff member's seeded hotel. */
async function openMenu(page) {
  await openHotel(page, SEEDED_HOTEL);
  await page.getByRole('button', { name: 'Restaurant' }).click();
  await expect(page.getByText('Restaurant menu')).toBeVisible();
}

/** Fills Add item without submitting. */
async function fillItem(page, name) {
  await page.getByRole('button', { name: '+ Add item' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Category').click();
  await page.getByRole('option', { name: 'Beverage' }).click();
  await dialog.getByLabel('Price (optional)').fill('120');
  return dialog;
}

test.describe('staff restaurant menu', () => {
  as('staff');

  test('adds an item, edits it, then deletes it after confirming', async ({ page }) => {
    const name = uniqueName('Masala Chai');
    await openMenu(page);
    const dialog = await fillItem(page, name);
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByText(name).first()).toBeVisible();

    const row = page
      .locator('div')
      .filter({ hasText: name })
      .filter({ has: page.getByRole('button', { name: 'Edit' }) })
      .last();
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill(`${name} Large`);
    await page.getByRole('dialog').getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText(`${name} Large`).first()).toBeVisible();

    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('heading', { name: 'Delete menu item' })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(`${name} Large`)).toHaveCount(0);
  });

  test('will not add an item without a name', async ({ page }) => {
    await openMenu(page);
    await page.getByRole('button', { name: '+ Add item' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await expect(dialog).toBeVisible();
  });

  test('a refused item shows the error and keeps the form', async ({ page }) => {
    await openMenu(page);
    await failApi(page, '/restaurant/menu-items$', 400, 'Menu item refused');
    const dialog = await fillItem(page, 'Refused');
    await dialog.getByRole('button', { name: 'Add item' }).click();
    await toast(page, 'Menu item refused');
    await expect(dialog).toBeVisible();
  });

  // Reading the menu photo is a model call through the backend, so it is faked; creating the items is real.
  test('scans a menu photo, reviews the items, and creates them', async ({ page }) => {
    const name = uniqueName('Filter Coffee');
    await fakeS3(page);
    await fakeApi(page, '/restaurant/menu-ocr/extract$', 200, { success: true, data: { items: [{ name, price: 80, category: 'beverage' }] } });
    await openMenu(page);
    await page.locator('input[type=file][multiple]').setInputFiles(PNG);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /Review extracted items/ })).toBeVisible();
    await dialog.getByRole('button', { name: '+ Add row' }).click();
    await expect(dialog.getByRole('button', { name: 'Confirm & create (2)' })).toBeDisabled();
    await dialog.getByTestId('DeleteOutlineIcon').last().click();
    await dialog.getByRole('button', { name: 'Confirm & create (1)' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name).first()).toBeVisible();
  });

  test('a menu photo that cannot be read shows the error', async ({ page }) => {
    await fakeS3(page);
    await failApi(page, '/restaurant/menu-ocr/extract$', 500, 'Could not read the menu');
    await openMenu(page);
    await page.locator('input[type=file][multiple]').setInputFiles(PNG);
    await toast(page, 'Could not read the menu');
  });

  test('Cancel closes the form without adding', async ({ page }) => {
    const name = uniqueName('Not added');
    await openMenu(page);
    const dialog = await fillItem(page, name);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});
