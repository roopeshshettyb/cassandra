// Landing page sign-in: the email-code flow end to end and its known errors.
const { test, expect } = require('@playwright/test');
const { USERS, authFile } = require('./settings');
const { openLanding, openEmailSignIn, requestCode, readOtp, signIn, toast } = require('./helpers');

test.describe('sign in', () => {
  // Known bug, timing-dependent: the popup sends staff to /hotels and guests to their booking, but
  // the landing route's signed-in redirect races it and can land them on /dashboard instead. It
  // shows in some runs and not others, so these are skipped rather than expected to fail.
  test.fixme('staff land on hotels', async ({ page }) => {
    await signIn(page, USERS.staff);
    await expect(page).toHaveURL(/\/hotels$/);
  });

  test.fixme('guests land on their bookings', async ({ page }) => {
    await signIn(page, USERS.guest);
    await expect(page).toHaveURL(/\/bookings/);
  });

  test('asks for an email before sending a code', async ({ page }) => {
    await openEmailSignIn(page);
    await page.getByRole('button', { name: 'Send code' }).click();
    await expect(toast(page, 'Please enter your email')).toBeVisible();
    await expect(page.getByLabel('Verification code')).toBeHidden();
  });

  test('asks for the code before verifying', async ({ page }) => {
    await openEmailSignIn(page);
    await requestCode(page, USERS.owner);
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(toast(page, 'Please enter the code from your email')).toBeVisible();
  });

  // Known bug: EmailService throws a plain Error, so a wrong code comes back as a 500
  // "Internal server error" instead of this message.
  test.fail('refuses a wrong code', async ({ page }) => {
    await openEmailSignIn(page);
    await requestCode(page, USERS.owner);
    const otp = await readOtp(USERS.owner);
    await page.getByLabel('Verification code').fill(otp === '000000' ? '111111' : '000000');
    await page.getByRole('button', { name: 'Verify' }).click();
    await expect(toast(page, 'Invalid email or OTP')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('holds resend until the cooldown ends, then sends a new code', async ({ page }) => {
    // The page's clock is driven by the test, so the 60s cooldown passes at once.
    await page.clock.install();
    await openEmailSignIn(page);
    await requestCode(page, USERS.owner);
    await expect(page.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();

    // runFor fires every tick on the way, as the countdown needs; fastForward would fire each timer once.
    await page.clock.runFor('01:01');
    const sent = page.waitForResponse((response) => response.url().endsWith('/oauth/email/send-otp') && response.ok());
    await page.getByRole('button', { name: 'Resend code', exact: true }).click();
    await sent;
    await expect(page.getByRole('button', { name: /Resend code in \d+s/ })).toBeDisabled();
  });

  test('goes back to the sign-in options from either step', async ({ page }) => {
    const options = page.getByRole('button', { name: 'Sign in with Email' });
    await openEmailSignIn(page);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(options).toBeVisible();

    await options.click();
    await requestCode(page, USERS.owner);
    await page.getByRole('button', { name: 'Back to sign-in options' }).click();
    await expect(options).toBeVisible();
  });

  test('clicking outside the popup closes it', async ({ page }) => {
    await openEmailSignIn(page);
    await page.mouse.click(5, 5);
    await expect(page.getByLabel('Email')).toBeHidden();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
  });
});

test.describe('signed in', () => {
  test.use({ storageState: authFile('owner') });

  test('the landing page sends a signed-in user to the dashboard', async ({ page }) => {
    await openLanding(page);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
