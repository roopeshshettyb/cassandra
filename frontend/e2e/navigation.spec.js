// What each role can reach: the sidebar it sees, the pages it is kept out of, the back button,
// the public pages and signing out.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { nav, backButton, toast, failApi } = require('./helpers');

const NAV = {
  admin: ['Dashboard', 'Manage Hotels', 'Manage Rooms', 'Manage Brands', 'Manage Bookings', 'Manage Requests', 'Manage Costs', 'Manage Organisations'],
  owner: ['Dashboard', 'Manage Hotels', 'Manage Rooms', 'Manage Bookings', 'Manage Requests', 'Manage Organisations'],
  staff: ['Dashboard', 'Manage Hotels', 'Manage Rooms', 'Manage Bookings', 'Manage Requests'],
  guest: ['Dashboard', 'Manage Bookings'],
};

for (const [role, visible] of Object.entries(NAV)) {
  test.describe(`${role} sidebar`, () => {
    test.use({ storageState: authFile(role) });

    test('shows only the pages this role may open', async ({ page }) => {
      await page.goto('/notifications');
      for (const name of visible) await expect(nav(page, name)).toBeVisible();
      for (const name of NAV.admin.filter((n) => !visible.includes(n))) await expect(nav(page, name)).toHaveCount(0);
      for (const name of ['Home', 'Notifications', 'Logout']) await expect(nav(page, name)).toBeVisible();
    });
  });
}

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('each sidebar entry opens its page', async ({ page }) => {
    const pages = { 'Manage Hotels': '/hotels', 'Manage Rooms': '/rooms', 'Manage Brands': '/brands', 'Manage Bookings': '/bookings', 'Manage Requests': '/requests', 'Manage Costs': '/costs', 'Manage Organisations': '/organisations', Notifications: '/notifications', Dashboard: '/dashboard', Home: '/dashboard' };
    await page.goto('/notifications');
    for (const [name, path] of Object.entries(pages)) {
      await nav(page, name).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });

  test('the back button returns to the previous page', async ({ page }) => {
    await page.goto('/hotels');
    await nav(page, 'Manage Brands').click();
    await expect(page).toHaveURL(/\/brands$/);
    await backButton(page).click();
    await expect(page).toHaveURL(/\/hotels$/);
  });

  test('an unknown address shows the not-found page', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByRole('img', { name: 'Page not found' })).toBeVisible();
    await expect(page.getByText("You seem to be lost. There's nothing here.")).toBeVisible();
  });

  test('a failing list reports the backend message', async ({ page }) => {
    await failApi(page, '/hotels(\\?|$)', 'Hotels are unavailable');
    await page.goto('/hotels');
    await expect(toast(page, 'Hotels are unavailable')).toBeVisible();
  });

  test('logout signs out and returns to the landing page', async ({ page }) => {
    await page.goto('/dashboard');
    await nav(page, 'Logout').click();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/404$/);
  });
});

test.describe('guest', () => {
  test.use({ storageState: authFile('guest') });

  // A guest is sent to not-found, and from there the app moves them on to their active booking.
  for (const path of ['/hotels', '/rooms', '/brands', '/costs', '/organisations']) {
    test(`is kept out of ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/(404|bookings\/\d+\?tab=concierge)$/);
    });
  }
});

test.describe('staff', () => {
  test.use({ storageState: authFile('staff') });

  test('is told costs are not theirs to see', async ({ page }) => {
    await page.goto('/costs');
    await expect(page.getByText('You are not authorized to view this page.')).toBeVisible();
  });
});

test.describe('signed out', () => {
  test('protected pages show not found', async ({ page }) => {
    await page.goto('/hotels');
    await expect(page).toHaveURL(/\/404$/);
  });

  for (const [name, path] of [['Privacy Policy', '/privacy-policy'], ['Fees and Refund Policy', '/fees-refund-policy'], ['Terms and Conditions', '/terms-conditions'], ['Contact Us', '/contact']]) {
    test(`the footer opens ${name}`, async ({ page }) => {
      await page.goto('/404');
      await page.getByRole('contentinfo').getByRole('button', { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    });
  }
});
