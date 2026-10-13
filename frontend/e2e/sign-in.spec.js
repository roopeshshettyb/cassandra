// Signing in: the emailed code (LoginPopup.js), invite links (InviteHandler.js) and the return
// from Google (OAuthCallback.js).
const { test, expect } = require('@playwright/test');
const { ACCOUNTS, readOtp, tokenOf, inviteToken } = require('./support/session');
const { toast, failApi, fakeApi, errorToast } = require('./support/ui');
const { apiAs } = require('./support/api');

/** Opens the login popup from the landing page. */
async function openLogin(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).first().click();
}

/** Fills the email step and asks for a code. */
async function requestCode(page, email) {
  await page.getByRole('button', { name: /Email$/ }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
}

test('Sign in on the landing page opens the sign-in options', async ({ page }) => {
  await openLogin(page);
  await expect(page.getByRole('button', { name: /Email$/ })).toBeVisible();
});

// Only the sign-in is checked, not where it lands: that races with the "/" redirect (e2e/README.md).
for (const role of ['staff', 'guest']) {
  test(`${role} signs in with the emailed code`, async ({ page }) => {
    await openLogin(page);
    await requestCode(page, ACCOUNTS[role]);
    // The code step opens once the backend has stored the code, so it can be read from then on.
    await expect(page.getByLabel('Verification code')).toBeVisible();
    await page.getByLabel('Verification code').fill(await readOtp(ACCOUNTS[role]));
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeTruthy();
  });
}

test('asks for an email before sending a code', async ({ page }) => {
  await openLogin(page);
  await page.getByRole('button', { name: /Email$/ }).click();
  await page.getByRole('button', { name: 'Send code' }).click();
  await toast(page, 'Please enter your email');
});

test('asks for the code before verifying', async ({ page }) => {
  await openLogin(page);
  await requestCode(page, ACCOUNTS.staff);
  await page.getByRole('button', { name: 'Verify' }).click();
  await toast(page, 'Please enter the code from your email');
});

test('a wrong code is refused and keeps the visitor signed out', async ({ page }) => {
  await openLogin(page);
  await requestCode(page, ACCOUNTS.staff);
  await page.getByLabel('Verification code').fill('000000');
  await page.getByRole('button', { name: 'Verify' }).click();
  await errorToast(page);
  await expect(page.getByLabel('Verification code')).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeNull();
});

test('a failure sending the code is shown and stays on the email step', async ({ page }) => {
  await failApi(page, '/oauth/email/send-otp', 500, 'Could not send the code');
  await openLogin(page);
  await requestCode(page, ACCOUNTS.staff);
  await toast(page, 'Could not send the code');
  await expect(page.getByLabel('Email')).toBeVisible();
});

test('an invite link signs the member in and opens the page it names', async ({ page }) => {
  const api = await apiAs('owner');
  const me = await api.get('/accounts/me');
  await api.dispose();
  await page.goto(`/invite?token=${inviteToken(me.id)}&redirectPath=/bookings`);
  await toast(page, 'You are now logged in.');
  await expect(page).toHaveURL(/\/bookings$/);
  expect(await page.evaluate(() => window.localStorage.getItem('token'))).toBeTruthy();
});

test('an invalid invite link is refused', async ({ page }) => {
  await page.goto('/invite?token=not-a-token');
  await toast(page, 'This invite link is invalid or has expired. Please request a new one.');
  await expect(page).toHaveURL(/\/$/);
});

test('an invite link without a token is refused', async ({ page }) => {
  await page.goto('/invite');
  await toast(page, 'Invalid invite link');
  await expect(page).toHaveURL(/\/$/);
});

// Checking a Google id_token needs Google, so the backend's answer to the callback is faked with a
// real owner session.
test('returning from Google signs the user in', async ({ page }) => {
  await fakeApi(page, '/oauth/callback$', 201, { token: tokenOf('owner'), account: { role: 'hotel_owner' } });
  await page.goto('/oauth/callback?authType=google&id_token=e2e');
  await expect(page).toHaveURL(/\/hotels$/);
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible();
});

test('a Google sign-in the backend refuses returns to the landing page', async ({ page }) => {
  await failApi(page, '/oauth/callback$', 401, 'Google sign-in failed');
  await page.goto('/oauth/callback?authType=google&id_token=e2e');
  await toast(page, 'Google sign-in failed');
  await expect(page).toHaveURL(/\/$/);
});

test('a callback without a sign-in type returns to the landing page', async ({ page }) => {
  await page.goto('/oauth/callback');
  await expect(page).toHaveURL(/\/$/);
});

test('Back returns to the sign-in options', async ({ page }) => {
  await openLogin(page);
  await requestCode(page, ACCOUNTS.staff);
  await page.getByRole('button', { name: 'Back to sign-in options' }).click();
  await expect(page.getByRole('button', { name: /Email$/ })).toBeVisible();
});
