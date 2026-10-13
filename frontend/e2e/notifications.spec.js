// Notifications (Notifications.js): the inbox and the notification preferences.
const { test, expect } = require('@playwright/test');
const { as, navigate, failApi, errorToast } = require('./support/ui');

// Push comes first, then Email (PreferencesSection); the switches carry no names of their own.
const emailSwitch = (page) => page.getByRole('checkbox').nth(1);
const saved = (page) => page.waitForResponse((r) => r.url().endsWith('/notifications/preferences') && r.request().method() === 'PATCH');
const unread = (page) => page.locator('.MuiBadge-badge').first();

test.describe('owner notifications', () => {
  as('owner');

  test('opens from the sidebar with the inbox and the preferences', async ({ page }) => {
    await page.goto('/dashboard');
    await navigate(page, 'Notifications');
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    await expect(page.getByText('My Notifications')).toBeVisible();
  });

  test('opening an unread notification marks it read', async ({ page }) => {
    await page.goto('/notifications');
    const before = Number(await unread(page).textContent());
    await page
      .getByText(/^New (Booking|Request|Message)$/)
      .first()
      .click();
    await expect(unread(page)).not.toHaveText(String(before));
  });

  test('turning email off is kept, and can be turned back on', async ({ page }) => {
    await page.goto('/notifications');
    await expect(emailSwitch(page)).toBeChecked();
    await Promise.all([saved(page), emailSwitch(page).click()]);
    await page.reload();
    await expect(emailSwitch(page)).not.toBeChecked();
    await Promise.all([saved(page), emailSwitch(page).click()]);
    await page.reload();
    await expect(emailSwitch(page)).toBeChecked();
  });

  // Known problem (e2e/README.md): a failed save is not shown and the switch stays flipped.
  // Drop `test.fail` once fixed.
  test('a preference that fails to save is shown and put back', async ({ page }) => {
    test.fail();
    await page.goto('/notifications');
    await failApi(page, '/notifications/preferences$', 500, 'Preference not saved');
    await emailSwitch(page).click();
    await errorToast(page, { timeout: 3000 });
    await expect(emailSwitch(page)).toBeChecked();
  });
});
