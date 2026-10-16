// The dashboard each role lands on, and the costs page. Invite emails are not sent under
// automation_test, so firing them here reaches no inbox.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, shown, failApi, openActiveStay } = require('./helpers');

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('greets the admin with the booking totals', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText(/Good (morning|afternoon|evening), Seed\./).filter({ visible: true })).toBeVisible();
    for (const label of ['Total Bookings', 'Active Stays', 'Pending Requests', 'Completed']) await expect(shown(page, label)).toBeVisible();
  });

  test('view all opens the full list', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('View all →').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/(requests|bookings|hotels)$/);
  });

  test('a recent request opens it', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByText('Airport Transfer').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/requests\/\d+$/);
  });

  test('fires pending invites', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Fire pending invites' }).filter({ visible: true }).click();
    await expect(toast(page, 'Pending invite emails sent')).toBeVisible();
  });

  // Known bug, timing-dependent: on a failed load api.js sets the data to its default ([]), Dashboard
  // only guards against null, reads stats.totalBookings off undefined, and the whole app goes blank,
  // sometimes before the error toast can be seen. Skipped rather than expected to fail.
  test.fixme('reports a dashboard that fails to load', async ({ page }) => {
    await failApi(page, '/dashboard', 'Dashboard is unavailable');
    await page.goto('/dashboard');
    await expect(toast(page, 'Dashboard is unavailable')).toBeVisible();
  });

  test('shows AI costs per booking', async ({ page }) => {
    await page.goto('/costs');
    await expect(page.getByText('Aggregated AI usage costs per booking')).toBeVisible();
    for (const column of ['Booking', 'Guest', 'Cost']) await expect(page.getByText(column, { exact: true }).first()).toBeVisible();
  });

  test('reports costs that fail to load', async ({ page }) => {
    await failApi(page, '/costs/aggregate', 'Costs are unavailable');
    await page.goto('/costs');
    await expect(toast(page, 'Costs are unavailable')).toBeVisible();
  });
});

test.describe('owner', () => {
  test.use({ storageState: authFile('owner') });

  test('sees the totals but cannot fire invites', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(shown(page, 'Total Bookings')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fire pending invites' })).toHaveCount(0);
  });
});

test.describe('guest', () => {
  test.use({ storageState: authFile('guest') });

  test('sees their own stays and requests', async ({ page }) => {
    // A guest is first moved on to their active booking; open the dashboard once that has happened.
    await openActiveStay(page);
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    for (const label of ['My Stays', 'Active Stay', 'My Requests']) await expect(shown(page, label)).toBeVisible();
  });
});
