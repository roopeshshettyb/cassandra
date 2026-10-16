// Signs each seeded role in once through the real login flow and saves the session, so specs
// start signed in with `test.use({ storageState: authFile('owner') })`.
const { test: setup, expect } = require('@playwright/test');
const { USERS, authFile } = require('./settings');
const { signIn } = require('./helpers');

for (const [role, email] of Object.entries(USERS)) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await signIn(page, email);
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBeTruthy();
    await page.context().storageState({ path: authFile(role) });
  });
}
