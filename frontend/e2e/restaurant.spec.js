// A hotel's restaurant menu (the Restaurant tab): adding, editing and deleting items, and bulk
// import from a photographed menu. Reading the photo is an LLM call, so that one endpoint is
// stubbed; the upload goes to a presigned S3 URL that stubS3 answers.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, shown, rowWith: row, unique, openNewHotel, stubS3, answerApi, failApi, file, PNG } = require('./helpers');

test.use({ storageState: authFile('admin') });

const MENU_PHOTO = file('menu.png', 'image/png', PNG);
const menuPhotoInput = (page) => page.locator('input[type=file][accept="image/*"][multiple]');

/** Opens a freshly onboarded hotel's Restaurant tab. */
async function openMenu(page) {
  await openNewHotel(page, 'Restaurant');
  await expect(shown(page, 'Restaurant menu')).toBeVisible();
}

/** Fills the Add item form, without submitting it; returns the item's name. */
async function fillNewItem(page) {
  const name = unique('E2E Dish');
  await page.getByRole('button', { name: '+ Add item' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Description').fill('House special');
  await dialog.getByLabel('Price (optional)').fill('250');
  await dialog.getByLabel('Category').click();
  await page.getByRole('option', { name: 'Main Course' }).click();
  await dialog.getByLabel('Available from').fill('12:00');
  await dialog.getByLabel('Available until').fill('15:00');
  await dialog.getByLabel('Dietary tags (comma-separated)').fill('vegetarian');
  return name;
}

/** Adds an item through the form; returns its name. */
async function addItem(page) {
  const name = await fillNewItem(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(shown(page, name)).toBeVisible();
  return name;
}

test('refuses a negative price', async ({ page }) => {
  await openMenu(page);
  await page.getByRole('button', { name: '+ Add item' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(unique('E2E Dish'));
  await dialog.getByLabel('Category').click();
  await page.getByRole('option', { name: 'Dessert' }).click();
  // The input's own min=0 would stop the form, so the value is set past it to reach the page's check.
  await dialog.getByLabel('Price (optional)').evaluate((input) => input.removeAttribute('min'));
  await dialog.getByLabel('Price (optional)').fill('-5');
  await dialog.getByRole('button', { name: 'Add item' }).click();
  await expect(toast(page, 'Invalid price')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
});

test('reports an item the backend refuses, and keeps the form', async ({ page }) => {
  await openMenu(page);
  await failApi(page, '/restaurant/menu-items$', 'Menu is locked', { method: 'POST' });
  const name = await fillNewItem(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Add item' }).click();
  await expect(toast(page, 'Menu is locked')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Name')).toHaveValue(name);
});

test('edits an item and marks it unavailable', async ({ page }) => {
  await openMenu(page);
  const name = await addItem(page);
  await row(page, name).getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  const renamed = unique('E2E Renamed Dish');
  await dialog.getByLabel('Name').fill(renamed);
  await dialog.getByRole('checkbox', { name: 'Available' }).uncheck();
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toBeHidden();
  await expect(shown(page, renamed)).toBeVisible();
});

test('deletes an item after confirming', async ({ page }) => {
  await openMenu(page);
  const name = await addItem(page);
  await row(page, name).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(shown(page, name)).toBeVisible();

  await row(page, name).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(shown(page, name)).toBeHidden();
});

test('imports items read from a menu photo, after review', async ({ page }) => {
  const dish = unique('E2E Scanned Dish');
  await stubS3(page);
  await answerApi(page, '/restaurant/menu-ocr/extract', { items: [{ name: dish, price: 120, category: 'dessert', description: 'Scanned' }, { name: 'Remove me', price: 1, category: 'side' }] });
  await openMenu(page);

  await menuPhotoInput(page).setInputFiles([MENU_PHOTO]);
  const review = page.getByRole('dialog');
  await expect(review).toContainText('Review extracted items');
  await expect(review.getByRole('button', { name: 'Confirm & create (2)' })).toBeEnabled();

  // Removing a row, and a blank added row blocking confirm until it is named.
  await review.getByRole('button').filter({ has: page.getByTestId('DeleteOutlineIcon') }).nth(1).click();
  await review.getByRole('button', { name: '+ Add row' }).click();
  await expect(review.getByRole('button', { name: 'Confirm & create (2)' })).toBeDisabled();
  await review.getByPlaceholder('Name').last().fill(unique('E2E Added Row'));
  await review.getByRole('button', { name: 'Confirm & create (2)' }).click();

  await expect(review).toBeHidden();
  await expect(shown(page, dish)).toBeVisible();
  await expect(shown(page, 'Remove me')).toBeHidden();
});

test('reports a menu photo that fails to upload', async ({ page }) => {
  await stubS3(page, { status: 500 });
  await openMenu(page);
  await menuPhotoInput(page).setInputFiles([MENU_PHOTO]);
  await expect(toast(page, 'Upload failed (500)')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
