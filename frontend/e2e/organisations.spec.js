// Organisations: admins create, rename, add users to and delete them; owners only see their own.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, unique, openCard, failApi } = require('./helpers');

/** Opens the Add Organisation form from the list page and fills its name; returns the form. */
async function startOrganisation(page, name) {
  await page.goto('/organisations');
  await page.getByRole('button', { name: 'Add Organisation' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  return dialog;
}

/** Creates an organisation from the list page and opens it. */
async function createOrganisation(page, name) {
  const dialog = await startOrganisation(page, name);
  await dialog.getByLabel('Description').fill('Created by the UI tests');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(dialog).toBeHidden();
  await openCard(page, name);
  await expect(page).toHaveURL(/\/organisations\/\d+$/);
}

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('lists every organisation and searches them', async ({ page }) => {
    await page.goto('/organisations');
    for (const name of ['Taj Group', 'Marriott India', 'Independent Hotels Co']) await expect(page.getByText(name, { exact: true })).toBeVisible();
    await page.getByPlaceholder('Search by name or description…').fill('marriott');
    await expect(page.getByText('Marriott India', { exact: true })).toBeVisible();
    await expect(page.getByText('Taj Group', { exact: true })).toBeHidden();
  });

  test('refuses a blank name', async ({ page }) => {
    const dialog = await startOrganisation(page, '   ');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(toast(page, 'Name is required')).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test('reports an organisation the backend refuses, and keeps the form', async ({ page }) => {
    await failApi(page, '/organisations$', 'Organisation name is taken', { method: 'POST' });
    const dialog = await startOrganisation(page, 'Taj Group');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(toast(page, 'Organisation name is taken')).toBeVisible();
    await expect(dialog.getByLabel('Name')).toHaveValue('Taj Group');
  });

  test('cancel closes the form without creating', async ({ page }) => {
    const name = unique('E2E Cancelled');
    const dialog = await startOrganisation(page, name);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(name)).toHaveCount(0);
  });

  test('renames an organisation, and discard undoes an edit', async ({ page }) => {
    await createOrganisation(page, unique('E2E Rename'));
    const nameBox = page.getByRole('textbox').first();

    await nameBox.fill('Not kept');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(nameBox).not.toHaveValue('Not kept');

    const renamed = unique('E2E Renamed');
    await nameBox.fill(renamed);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('button', { name: 'Save' })).toBeHidden();
    await page.reload();
    await expect(page.getByRole('textbox').first()).toHaveValue(renamed);
  });

  test('refuses to save a blank name', async ({ page }) => {
    await createOrganisation(page, unique('E2E Blank'));
    await page.getByRole('textbox').first().fill(' ');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(toast(page, 'Name is required')).toBeVisible();
  });

  test('adds and edits a user, and asks for an email first', async ({ page }) => {
    await createOrganisation(page, unique('E2E Users'));
    await page.getByRole('button', { name: 'Users' }).click();
    await page.getByRole('button', { name: 'Add User' }).click();
    const dialog = page.getByRole('dialog');

    // The browser's own required-field check stops the form before the page's.
    await dialog.getByRole('button', { name: 'Save' }).click();
    expect(await dialog.getByLabel('Email').evaluate((input) => input.validity.valueMissing)).toBe(true);
    await expect(dialog).toBeVisible();

    const email = `e2e+${Date.now()}@example.com`;
    await dialog.getByLabel('Email').fill(email);
    await dialog.getByLabel('Name').fill('E2E Staff');
    await dialog.getByLabel('Role').click();
    await page.getByRole('option', { name: 'Hotel Staff' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('E2E Staff')).toBeVisible();

    await page.getByRole('button', { name: 'Edit User' }).click();
    await dialog.getByLabel('Name').fill('E2E Staff Renamed');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText('E2E Staff Renamed')).toBeVisible();
  });

  test('deletes an organisation after confirming', async ({ page }) => {
    const name = unique('E2E Delete');
    await createOrganisation(page, name);
    await page.getByRole('button', { name: 'Danger zone' }).click();

    await page.getByRole('button', { name: 'Delete Organisation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page).toHaveURL(/\/organisations\/\d+$/);

    await page.getByRole('button', { name: 'Delete Organisation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/organisations$/);
    await expect(page.getByText(name)).toHaveCount(0);
  });
});

test.describe('owner', () => {
  test.use({ storageState: authFile('owner') });

  test('sees only their own organisation and cannot add one', async ({ page }) => {
    await page.goto('/organisations');
    await expect(page.getByText('Taj Group', { exact: true })).toBeVisible();
    await expect(page.getByText('Marriott India', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add Organisation' })).toHaveCount(0);
  });
});
