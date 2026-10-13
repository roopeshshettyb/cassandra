// Route guards (App.js): signed-in-only pages, staff-side pages a guest may not open, public pages, 404.
const { test, expect } = require('@playwright/test');
const { as } = require('./support/ui');

const SIGNED_IN = ['/dashboard', '/chat', '/notifications', '/hotels', '/rooms', '/brands', '/bookings', '/requests', '/costs', '/organisations'];
const NOT_FOR_GUESTS = ['/hotels', '/rooms', '/brands', '/costs', '/organisations'];
const PUBLIC = { '/privacy-policy': /privacy/i, '/terms-conditions': /terms/i, '/fees-refund-policy': /refund/i, '/shipping-delivery-policy': /shipping/i, '/contact': /contact/i };

const notFound = (page) => page.getByAltText('Page not found');

test.describe('signed out', () => {
  for (const path of SIGNED_IN) {
    test(`${path} is not found`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/404$/);
      await expect(notFound(page)).toBeVisible();
    });
  }

  for (const [path, text] of Object.entries(PUBLIC)) {
    test(`${path} is public`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByText(text).first()).toBeVisible();
      await expect(notFound(page)).toHaveCount(0);
    });
  }

  test('an unknown address shows the not-found page', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(notFound(page)).toBeVisible();
  });
});

test.describe('guest', () => {
  as('guest');

  // A guest with a stay is then sent on to it, so the check is only that the page never opens.
  for (const path of NOT_FOR_GUESTS) {
    test(`${path} is refused`, async ({ page }) => {
      await page.goto(path);
      await expect(page).not.toHaveURL(new RegExp(`${path}$`));
    });
  }
});
