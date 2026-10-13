// Organisations and their users (ManageOrganisations.js, OrganisationDetails.js, OrganisationUsersTable.js).
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, errorToast, successToast } = require('./support/ui');
const { apiAs, uniqueName, uniqueEmail } = require('./support/api');

const OWNER_ORG = 'Taj Group';
const OTHER_ORG = 'Marriott India';

const search = (page) => page.getByPlaceholder('Search by name or description…');

/** Opens an organisation's page: a card opens from its Open or Manage button, not its name. */
async function openOrganisation(page, name) {
  await page.goto('/organisations');
  await search(page).fill(name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page
    .getByRole('button', { name: /^(Open|Manage)$/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/organisations\/\d+$/);
}

/** Fills Add User, without saving. */
async function fillUser(page, address) {
  await page.getByRole('button', { name: 'Add User' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Email').fill(address);
  await dialog.getByLabel('Name').fill('E2E User');
  await dialog.getByLabel('Role').click();
  return dialog;
}

test.describe('admin organisations', () => {
  as('admin');

  test('lists every organisation, in the gallery and the table', async ({ page }) => {
    await page.goto('/organisations');
    for (const name of [OWNER_ORG, OTHER_ORG]) await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    await page.getByTestId('TableRowsIcon').click();
    await expect(page.getByText(OTHER_ORG, { exact: true }).first()).toBeVisible();
  });

  test('search narrows the list', async ({ page }) => {
    await page.goto('/organisations');
    await search(page).fill('Marriott');
    await expect(page.getByText(OTHER_ORG, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(OWNER_ORG, { exact: true })).toHaveCount(0);
  });

  test('adds an organisation, edits its details, then deletes it', async ({ page }) => {
    const name = uniqueName('Org');
    await page.goto('/organisations');
    await page.getByRole('button', { name: 'Add Organisation' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill(name);
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await successToast(page);

    await openOrganisation(page, name);
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await page.locator('textarea:visible').first().fill('Edited in the UI tests');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await page.reload();
    await page.getByRole('button', { name: 'Details', exact: true }).click();
    await expect(page.locator('textarea:visible').first()).toHaveValue('Edited in the UI tests');

    await page.getByRole('button', { name: 'Danger zone' }).click();
    await page.getByRole('button', { name: 'Delete Organisation' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page).toHaveURL(/\/organisations$/);
    await search(page).fill(name);
    await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  });

  test('will not add an organisation without a name', async ({ page }) => {
    await page.goto('/organisations');
    await page.getByRole('button', { name: 'Add Organisation' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeVisible();
  });

  test('a refused organisation shows the error', async ({ page }) => {
    await page.goto('/organisations');
    await failApi(page, '/organisations$', 400, 'Name already in use');
    await page.getByRole('button', { name: 'Add Organisation' }).click();
    await page.getByRole('dialog').getByLabel('Name').fill('Duplicate');
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
    await toast(page, 'Name already in use');
  });

  test('a list that fails to load shows the error', async ({ page }) => {
    await failApi(page, '/organisations$', 500, 'Organisations unavailable');
    await page.goto('/organisations');
    await toast(page, 'Organisations unavailable');
  });
});

test.describe('owner organisation', () => {
  as('owner');

  test('shows only their organisation, without Add Organisation', async ({ page }) => {
    await page.goto('/organisations');
    await expect(page.getByText('Your organisation').first()).toBeVisible();
    await expect(page.getByText(OWNER_ORG, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(OTHER_ORG, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add Organisation' })).toHaveCount(0);
  });

  test('sees only the Users tab of their organisation', async ({ page }) => {
    await openOrganisation(page, OWNER_ORG);
    await expect(page.getByRole('button', { name: 'Users', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Danger zone' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Details', exact: true })).toHaveCount(0);
  });

  test('adds a user without the Admin role on offer, finds them, and edits them', async ({ page }) => {
    const address = uniqueEmail('user');
    await openOrganisation(page, OWNER_ORG);
    const dialog = await fillUser(page, address);
    await expect(page.getByRole('option', { name: 'Admin', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Hotel Staff' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Search by name, email or role…').fill(address);
    await expect(page.getByText('E2E User').first()).toBeVisible();
    await page.getByRole('button', { name: 'Edit User' }).first().click();
    await dialog.getByLabel('Name').fill('E2E User Renamed');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('E2E User Renamed').first()).toBeVisible();
  });

  test('a user whose email is taken is refused', async ({ page }) => {
    const address = uniqueEmail('user');
    const api = await apiAs('owner');
    await api.post('/organisation-users', { email: address, name: 'Taken', role: 'hotel_staff' });
    await api.dispose();
    await openOrganisation(page, OWNER_ORG);
    const dialog = await fillUser(page, address);
    await page.getByRole('option', { name: 'Hotel Staff' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await errorToast(page);
    await expect(dialog).toBeVisible();
  });

  test("another organisation's page is refused", async ({ page }) => {
    const api = await apiAs('admin');
    const other = (await api.get('/organisations')).find((o) => o.name === OTHER_ORG);
    await api.dispose();
    await page.goto(`/organisations/${other.id}`);
    await errorToast(page);
  });
});
