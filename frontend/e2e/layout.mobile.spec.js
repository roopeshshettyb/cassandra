// Phone-sized checks (the "mobile" project, Pixel 7): the menus that replace the sidebar and the
// landing nav, and no page wider than the screen.
const { test, expect } = require('@playwright/test');
const { USERS, authFile } = require('./settings');
const { openLanding, nav, requestCode, enterCode, fakeConcierge, openActiveStay } = require('./helpers');

/** Fails if the page scrolls sideways. */
async function expectNoSidewaysScroll(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page is wider than the screen').toBeLessThanOrEqual(1);
}

test('signs in from the landing page menu', async ({ page }) => {
  await openLanding(page);
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Sign in' }).filter({ visible: true }).click();
  await page.getByRole('button', { name: 'Sign in with Email' }).click();
  await requestCode(page, USERS.staff);
  await enterCode(page, USERS.staff);
  await expect(page).not.toHaveURL(/\/$/);
});

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('the menu button opens the sidebar, tapping outside closes it, and an entry navigates', async ({ page }) => {
    const menuButton = page.getByRole('button').filter({ has: page.getByTestId('MenuIcon') }).first();
    await page.goto('/dashboard');
    await expect(nav(page, 'Manage Hotels')).toBeHidden();
    await menuButton.click();
    await expect(nav(page, 'Manage Hotels')).toBeVisible();
    // The sidebar is narrower than the screen; the strip beside it is the backdrop.
    const { width, height } = page.viewportSize();
    await page.mouse.click(width - 5, height / 2);
    await expect(nav(page, 'Manage Hotels')).toBeHidden();

    await menuButton.click();
    await nav(page, 'Manage Hotels').click();
    await expect(page).toHaveURL(/\/hotels$/);
    await expect(nav(page, 'Manage Hotels')).toBeHidden();
  });

  test('Ask AI opens the concierge as its own page', async ({ page }) => {
    await fakeConcierge(page);
    await page.goto('/hotels');
    await page.getByRole('button', { name: 'Ask AI' }).click();
    await expect(page).toHaveURL(/\/chat/);
    await expect(page.getByRole('button', { name: 'Prefer to type?' })).toBeVisible();
  });

  for (const path of ['/dashboard', '/hotels', '/rooms', '/brands', '/bookings', '/requests', '/costs', '/organisations', '/notifications']) {
    test(`${path} fits the screen`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoSidewaysScroll(page);
    });
  }
});

test.describe('guest', () => {
  test.use({ storageState: authFile('guest') });

  test('the stay fits the screen and its tabs switch', async ({ page }) => {
    await fakeConcierge(page);
    await openActiveStay(page);
    await expectNoSidewaysScroll(page);
    // The bottom nav items are clickable boxes, not buttons.
    for (const [label, tab] of [['Home', 'home'], ['Requests', 'requests']]) {
      await page.getByText(label, { exact: true }).filter({ visible: true }).last().click();
      await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
      await expectNoSidewaysScroll(page);
    }
  });
});
