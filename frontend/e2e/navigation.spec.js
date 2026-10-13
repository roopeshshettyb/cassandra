// The sidebar per role, every item it opens, the SPA back button, and Logout.
const { test, expect } = require('@playwright/test');
const { as, NAV, navigate, back } = require('./support/ui');

const LINKS = {
  'Manage Hotels': '/hotels',
  'Manage Rooms': '/rooms',
  'Manage Brands': '/brands',
  'Manage Bookings': '/bookings',
  'Manage Requests': '/requests',
  'Manage Costs': '/costs',
  'Manage Organisations': '/organisations',
};

for (const role of Object.keys(NAV)) {
  test.describe(`${role} sidebar`, () => {
    as(role);

    test('shows only what the role may open', async ({ page }) => {
      await page.goto('/dashboard');
      for (const item of NAV.admin) {
        await expect(page.getByRole('button', { name: item, exact: true })).toHaveCount(NAV[role].includes(item) ? 1 : 0);
      }
      await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
    });

    test('opens every item, and back returns to the previous page', async ({ page }) => {
      // Up to seven full list pages in one test: an admin's take longest.
      test.slow();
      await page.goto('/dashboard');
      for (const item of NAV[role].filter((i) => LINKS[i])) {
        await navigate(page, item);
        await expect(page).toHaveURL(new RegExp(`${LINKS[item]}$`));
        await back(page);
        await expect(page).toHaveURL(/\/dashboard$/);
      }
    });
  });
}

test.describe('Logout', () => {
  as('owner');

  // Clears only this browser's storage; the saved session other specs use stays valid.
  test('signs out and returns to the landing page', async ({ page }) => {
    await page.goto('/dashboard');
    await navigate(page, 'Logout');
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeNull();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });
});
