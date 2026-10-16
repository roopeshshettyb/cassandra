// Pages a visitor reaches without signing in: the landing page, contact details, the invite links
// the backend emails out, and the OAuth return page.
const { test, expect } = require('@playwright/test');
const { USERS } = require('./settings');
const { toast, shown, openLanding, signToken, sql } = require('./helpers');

test.describe('landing page', () => {
  for (const [link, section] of [['Features', 'features'], ['How it works', 'how'], ['Watch demo', 'videoSection']]) {
    test(`${link} scrolls to its section`, async ({ page }) => {
      await openLanding(page);
      await page.getByRole('navigation').getByRole('link', { name: link }).click();
      await expect(page).toHaveURL(new RegExp(`#${section}$`));
      await expect(page.locator(`#${section}`)).toBeInViewport();
    });
  }

  test('book a demo opens the scheduling popup', async ({ page }) => {
    // Calendly's widget script is replaced by one that records the popup it was asked to open.
    await page.route('https://assets.calendly.com/**', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.Calendly = { initPopupWidget: (options) => { window.calendlyUrl = options.url; } };' }));
    await openLanding(page);
    await page.waitForFunction(() => window.Calendly);
    await page.getByRole('link', { name: /Book a demo/ }).first().click();
    await expect.poll(() => page.evaluate(() => window.calendlyUrl)).toContain('calendly.com');
  });

  test('the demo video plays on click', async ({ page }) => {
    await page.route('https://www.youtube.com/**', (route) => route.fulfill({ body: '' }));
    await openLanding(page);
    await page.locator('#videoSection [role=button]').click();
    await expect(page.locator('#videoSection iframe[src*="youtube.com/embed"]')).toBeAttached();
  });
});

test('contact us lists the email addresses', async ({ page }) => {
  await page.goto('/contact');
  for (const address of ['roopesh@farmaura.co', 'support@farmaura.co']) await expect(page.locator(`a[href="mailto:${address}"]`)).toBeVisible();
});

/** An invite token for the seeded guest, as the backend emails it; a negative lifetime makes it expired. */
async function guestInviteToken(expiresInSeconds) {
  const [guest] = await sql('SELECT id, uuid, email, name, role FROM accounts WHERE email = $1', [USERS.guest]);
  return signToken({ ...guest, invite: true }, expiresInSeconds);
}

test.describe('invite links', () => {
  test('sign the guest in and open the page they were invited to', async ({ page }) => {
    await page.goto(`/invite?token=${await guestInviteToken()}&redirectPath=/bookings`);
    await expect(toast(page, 'You are now logged in.')).toBeVisible();
    await expect(page).toHaveURL(/\/bookings/);
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
  });

  test('without a token is refused', async ({ page }) => {
    await page.goto('/invite');
    await expect(toast(page, 'Invalid invite link')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('with an expired token is refused', async ({ page }) => {
    await page.goto(`/invite?token=${await guestInviteToken(-60)}`);
    await expect(toast(page, 'This invite link is invalid or has expired. Please request a new one.')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('OAuth return page', () => {
  for (const query of ['', '?authType=unknown', '?authType=google']) {
    test(`sends a visitor home when the provider data is missing (${query || 'none'})`, async ({ page }) => {
      await page.goto(`/oauth/callback${query}`);
      await expect(page).toHaveURL(/\/$/);
      await expect(shown(page, 'Sign in')).toBeVisible();
    });
  }
});
