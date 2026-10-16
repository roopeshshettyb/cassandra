// The notifications page: the inbox, opening a notification, and notification preferences.
// Notifications come from guest activity; tests insert one directly so they know what to expect.
const { test: base, expect } = require('@playwright/test');
const { authFile, USERS } = require('./settings');
const { shown, unique, sql } = require('./helpers');

// Each browser works on its own inbox (see USERS), signed in as that account.
const INBOX = { chromium: 'owner2', firefox: 'owner3', webkit: 'staff2', msedge: 'staff3' };
const test = base.extend({
  inbox: async ({}, use, testInfo) => use(INBOX[testInfo.project.name]),
  storageState: async ({ inbox }, use) => use(authFile(inbox)),
});

/** Gives the inbox an unread notification that links to the hotels page; returns its title. */
async function notify(inbox) {
  const title = unique('E2E Notice');
  await sql(
    "INSERT INTO notifications (account_id, title, message, type, read, link, created_at, updated_at) SELECT id, $2, 'Sent by the UI tests', 'SYSTEM', false, '/hotels', NOW(), NOW() FROM accounts WHERE email = $1",
    [USERS[inbox], title],
  );
  return title;
}

test('says when there is nothing new', async ({ page, inbox }) => {
  await sql('DELETE FROM notifications WHERE account_id = (SELECT id FROM accounts WHERE email = $1)', [USERS[inbox]]);
  await page.goto('/notifications');
  await expect(shown(page, 'No notifications yet')).toBeVisible();
});

test('opening a notification marks it read and follows its link', async ({ page, inbox }) => {
  const title = await notify(inbox);
  await page.goto('/dashboard');
  // The sidebar entry carries the unread count in its name.
  await page.getByRole('button', { name: /^\d+ Notifications$/ }).click();
  await shown(page, title).click();
  await expect(page).toHaveURL(/\/hotels$/);
  await expect.poll(async () => (await sql('SELECT read FROM notifications WHERE title = $1', [title]))[0].read).toBe(true);
});

/** The next preferences call of this method to come back from the backend. */
const preferences = (page, method) => page.waitForResponse((response) => response.url().endsWith('/notifications/preferences') && response.request().method() === method);

/** Flips a preference switch and reloads once the backend has saved it, so the reload shows what was kept. */
async function setAndReload(page, toggle, checked) {
  const saved = preferences(page, 'PATCH');
  await toggle.setChecked(checked);
  await saved;
  await page.reload();
}

// The preference switches have no label of their own: push comes first, then email.
for (const [channel, index] of [['push', 0], ['email', 1]]) {
  test(`${channel} alerts can be turned off and on`, async ({ page }) => {
    const toggle = page.getByRole('checkbox').nth(index);
    const loaded = preferences(page, 'GET');
    await page.goto('/notifications');
    await loaded;
    // Starts from on, so turning it off always sends a save to wait for.
    if (!(await toggle.isChecked())) await setAndReload(page, toggle, true);
    await setAndReload(page, toggle, false);
    await expect(toggle).not.toBeChecked();
    await setAndReload(page, toggle, true);
    await expect(toggle).toBeChecked();
  });
}
