// Dashboard (src/components/Dashboard.js): the sections per role, the invite action by permission,
// the links to the full lists, and errors.
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, successToast } = require('./support/ui');

// Admins and owners get the figures; staff get a shorter page of what to act on.
const SECTIONS = {
  admin: ['Total Bookings', 'Active Stays', 'Pending Requests', 'Completed', 'Needs attention'],
  owner: ['Total Bookings', 'Active Stays', 'Pending Requests', 'Completed', 'Needs attention'],
  staff: ['Last 24 hours', 'Needs attention'],
};

for (const role of Object.keys(SECTIONS)) {
  test.describe(`${role} dashboard`, () => {
    as(role);

    test('shows its sections, and Fire pending invites only to an admin', async ({ page }) => {
      await page.goto('/dashboard');
      for (const label of SECTIONS[role]) await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      if (role === 'staff') await expect(page.getByText('Total Bookings')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Fire pending invites' })).toHaveCount(role === 'admin' ? 1 : 0);
    });
  });
}

test.describe('admin dashboard actions', () => {
  as('admin');

  test('Fire pending invites reports success', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Fire pending invites' }).first().click();
    await successToast(page);
  });

  test('a failure firing invites is shown', async ({ page }) => {
    await failApi(page, '/bookings/send-pending-invites', 500, 'Invites failed');
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Fire pending invites' }).first().click();
    await toast(page, 'Invites failed');
  });

  // Known problem (e2e/README.md): a failed load sets the dashboard to [] (api.js's default), the
  // page reads stats off it and the whole app goes blank. Drop `test.fail` once fixed.
  test('a dashboard that fails to load shows the error', async ({ page }) => {
    test.fail();
    await failApi(page, '/dashboard$', 500, 'Dashboard unavailable');
    await page.goto('/dashboard');
    await toast(page, 'Dashboard unavailable');
    await expect(page.getByText('Total Bookings')).toHaveCount(0);
  });

  // Each card's "View all →" sits beside its title; the innermost block holding both is the card's header.
  for (const [title, path] of [
    ['Property pulse', '/hotels'],
    ['Last 24 hours', '/requests'],
    ['Confirmed this week', '/bookings'],
  ]) {
    test(`View all on ${title} opens ${path}`, async ({ page }) => {
      await page.goto('/dashboard');
      const card = page
        .locator('div')
        .filter({ has: page.getByText(title, { exact: true }) })
        .filter({ has: page.getByText('View all →') })
        .last();
      await card.getByText('View all →').click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
});
