// The landing page (Landing.js), the footer (Footer.js) and Contact Us (ContactUs.js). Calendly and
// YouTube are outside services, so their pages are answered locally.
const { test, expect } = require('@playwright/test');
const { as } = require('./support/ui');

test.describe('landing page', () => {
  test.beforeEach(({ context }) => context.route(/calendly\.com|youtube\.com/, (route) => route.fulfill({ status: 200, body: '' })));

  test('the menu links jump to their sections', async ({ page }) => {
    await page.goto('/');
    for (const [link, hash] of [
      ['Features', '#features'],
      ['How it works', '#how'],
      ['Watch demo', '#videoSection'],
    ]) {
      await page.getByRole('link', { name: link, exact: true }).first().click();
      await expect(page).toHaveURL(new RegExp(`${hash}$`));
    }
  });

  test('Book a demo opens the booking page', async ({ page }) => {
    await page.goto('/');
    const popup = page.waitForEvent('popup');
    await page
      .getByRole('link', { name: /Book a demo/ })
      .first()
      .click();
    expect((await popup).url()).toContain('calendly.com');
  });

  test('the product video plays in place', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Play product video' }).first().click();
    await expect(page.locator('iframe[src*="youtube.com/embed/"]')).toBeAttached();
  });

  test('Contact us lists the email addresses', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  });
});

test.describe('footer', () => {
  as('staff');

  const LINKS = { 'Privacy Policy': '/privacy-policy', 'Fees and Refund Policy': '/fees-refund-policy', 'Terms and Conditions': '/terms-conditions', 'Contact Us': '/contact' };

  test('every link opens its page', async ({ page }) => {
    for (const [text, path] of Object.entries(LINKS)) {
      await page.goto('/dashboard');
      await page.getByText(text, { exact: true }).last().click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
    }
  });
});
