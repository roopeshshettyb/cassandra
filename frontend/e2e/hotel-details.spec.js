// A hotel's page (HotelDetails.js): every tab. Each test works on its own new hotel, so seeded
// hotels are never changed. The browser's uploads to S3 are faked (fakeS3); the backend calls are real.
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, fakeS3, PNG, errorToast, successToast, tab, save } = require('./support/ui');
const { apiAs, uniqueName, uniqueEmail } = require('./support/api');

/** A new hotel the owner manages, opened on its page. Times are set: see the known problem below. */
async function openNewHotel(page, times = { checkInTime: '14:00', checkOutTime: '11:00' }) {
  const api = await apiAs('owner');
  const name = uniqueName('Hotel');
  const hotel = await api.post('/hotels', { name, address: `${name} Road`, ...times });
  await api.dispose();
  await page.goto(`/hotels/${hotel.id}`);
  await expect(page.getByPlaceholder('Ex. Grand Oberoi Mumbai')).toHaveValue(name);
  // The page loads the hotel a second time once the role is known, wiping any edit typed before it (e2e/README.md).
  await page.waitForLoadState('networkidle');
  return { ...hotel, name };
}

test.describe('owner, hotel page', () => {
  as('owner');

  test('edits the identity, saves, and the change is kept', async ({ page }) => {
    const hotel = await openNewHotel(page);
    const name = page.getByPlaceholder('Ex. Grand Oberoi Mumbai');
    await name.fill(`${hotel.name} Renamed`);
    await expect(page.getByText('Unsaved changes')).toBeVisible();
    await save(page);
    await expect(page.getByText('Unsaved changes')).toHaveCount(0);
    await page.reload();
    await expect(name).toHaveValue(`${hotel.name} Renamed`);
  });

  // Known problem (e2e/README.md): the page sends an unset check-in/out time as '', which the
  // backend refuses ("must be HH:MM"), so such a hotel cannot be saved. Drop `test.fail` once fixed.
  test('a hotel without check-in and check-out times can be saved', async ({ page }) => {
    test.fail();
    const hotel = await openNewHotel(page, {});
    await page.getByPlaceholder('Ex. Grand Oberoi Mumbai').fill(`${hotel.name} Renamed`);
    await save(page);
    await expect(page.getByText('Unsaved changes')).toHaveCount(0, { timeout: 5000 });
  });

  test('Discard drops unsaved edits', async ({ page }) => {
    const hotel = await openNewHotel(page);
    const name = page.getByPlaceholder('Ex. Grand Oberoi Mumbai');
    await name.fill('Not kept');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(name).toHaveValue(hotel.name);
  });

  test('a failed save shows the error and keeps the edit', async ({ page }) => {
    await openNewHotel(page);
    await failApi(page, '/hotels/\\d+$', 500, 'Could not save');
    const name = page.getByPlaceholder('Ex. Grand Oberoi Mumbai');
    await name.fill('Unsaved name');
    await save(page);
    await toast(page, 'Could not save');
    await expect(name).toHaveValue('Unsaved name');
  });

  test('saves the hours and Wi-Fi password', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Hours & Wi-Fi');
    await page.getByPlaceholder('Ex. Hotel@2024').fill('e2e-wifi');
    await page.getByPlaceholder('Ex. 7:00 AM – 10:30 AM').fill('7 – 10 AM');
    await save(page);
    await page.reload();
    await tab(page, 'Hours & Wi-Fi');
    await expect(page.getByPlaceholder('Ex. Hotel@2024')).toHaveValue('e2e-wifi');
    await expect(page.getByPlaceholder('Ex. 7:00 AM – 10:30 AM')).toHaveValue('7 – 10 AM');
  });

  test('saves a theme preset', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Theme');
    await page.getByRole('button', { name: 'Crimson' }).click();
    await save(page);
    await page.reload();
    await tab(page, 'Theme');
    await expect(page.getByText('#7C2D2D')).toBeVisible();
  });

  test('saves the concierge instructions', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Concierge AI');
    await page.locator('textarea:visible').first().fill('Recommend the rooftop bar.');
    await save(page);
    await page.reload();
    await tab(page, 'Concierge AI');
    await expect(page.locator('textarea:visible').first()).toHaveValue('Recommend the rooftop bar.');
  });

  test('uploads a logo', async ({ page }) => {
    await fakeS3(page);
    await openNewHotel(page);
    await page.locator('input[type=file][accept="image/*"]:not([multiple])').setInputFiles(PNG);
    await page.getByRole('button', { name: 'Upload e2e.png' }).click();
    await toast(page, 'Logo uploaded');
  });

  test('refuses a logo that is not an image', async ({ page }) => {
    await openNewHotel(page);
    await page.locator('input[type=file][accept="image/*"]:not([multiple])').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await toast(page, 'Only image files are allowed');
  });

  test('a logo the bucket refuses shows the error', async ({ page }) => {
    await page.route(/amazonaws\.com/, (route) => route.fulfill({ status: 403, headers: { 'Access-Control-Allow-Origin': '*' } }));
    await openNewHotel(page);
    await page.locator('input[type=file][accept="image/*"]:not([multiple])').setInputFiles(PNG);
    await page.getByRole('button', { name: 'Upload e2e.png' }).click();
    await toast(page, 'Logo upload failed: S3 upload failed (403)');
  });

  test('adds a photo, then removes it', async ({ page }) => {
    await fakeS3(page);
    await openNewHotel(page);
    await page.locator('input[type=file][multiple]').setInputFiles(PNG);
    await toast(page, 'Photos uploaded');
    const photo = page.locator('img[src*="amazonaws.com"]');
    await expect(photo).toHaveCount(1);
    await page.getByTestId('CloseIcon').click();
    await expect(photo).toHaveCount(0);
  });

  test('replaces the notification tone, and refuses a file that is not audio', async ({ page }) => {
    await fakeS3(page);
    await openNewHotel(page);
    const tone = page.locator('input[type=file][accept="audio/*"]');
    await tone.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await toast(page, 'Only audio files are allowed');
    await tone.setInputFiles({ name: 'chime.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3') });
    await page.getByRole('button', { name: 'Upload chime.mp3' }).click();
    await toast(page, 'Notification tone uploaded');
    await expect(page.getByText('Custom tone')).toBeVisible();
  });

  test('invites a member by email', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Members');
    const email = uniqueEmail('member');
    await page.getByPlaceholder('Add by email…').fill(email);
    await page.getByRole('button', { name: 'Send invite' }).click();
    await successToast(page);
    await expect(page.getByText(email).first()).toBeVisible();
  });

  test('asks for an email before inviting', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Members');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await toast(page, 'Email is required');
  });

  test('imports members from a csv, and refuses another file type', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Members');
    const email = uniqueEmail('csv');
    const csv = page.locator('input[type=file][accept=".csv,text/csv"]');
    await csv.setInputFiles({ name: 'members.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await toast(page, 'Please upload a csv file');
    await csv.setInputFiles({ name: 'members.csv', mimeType: 'text/csv', buffer: Buffer.from(`email,name,role\n${email},CSV Member,hotel_staff\n`) });
    await expect(page.getByText(email).first()).toBeVisible();
  });

  test('downloads the sample csv', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Members');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download sample csv' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });

  test('generates an integration token, copies it and a webhook, and revokes it', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openNewHotel(page);
    await tab(page, 'Integrations');
    await expect(page.getByText('Not configured')).toBeVisible();
    await page.getByRole('button', { name: 'Generate Token' }).click();
    // The token is shown once, in a dialog over the page.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('This token will not be shown again')).toBeVisible();
    const clipboard = () => page.evaluate(() => navigator.clipboard.readText());
    await dialog.getByRole('button', { name: 'Copy Token' }).click();
    await toast(page, 'Copied to clipboard');
    expect(await clipboard()).toMatch(/^[0-9a-f]{64}$/);
    await dialog.getByRole('button', { name: 'Close' }).click();
    await page.getByTestId('ContentCopyIcon').first().click();
    await expect.poll(clipboard).toMatch(/\/integrations\/v1\/bookings$/);
    await page.getByRole('button', { name: 'Revoke Token' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /revoke/i })
      .click();
    await expect(page.getByText('Revoked', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rotate Token' })).toBeVisible();
  });

  // Known problem (e2e/README.md): constants have no INTEGRATIONS.STATUS_ACTIVE_LABEL, so an active
  // token shows a blank status. Drop `test.fail` once fixed.
  test('an active token is labelled Active', async ({ page }) => {
    test.fail();
    await openNewHotel(page);
    await tab(page, 'Integrations');
    await page.getByRole('button', { name: 'Generate Token' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('button', { name: 'Revoke Token' })).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible({ timeout: 3000 });
  });

  test('cannot delete a hotel', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Danger zone');
    await expect(page.getByRole('button', { name: 'Delete forever' })).toHaveCount(0);
  });
});

test.describe('admin, hotel page', () => {
  as('admin');

  test('disables a member and activates them again', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Members');
    await page.getByRole('button', { name: 'Disable' }).first().click();
    await expect(page.getByText('Disabled').first()).toBeVisible();
    await page.getByRole('button', { name: 'Activate' }).first().click();
    await expect(page.getByRole('button', { name: 'Disable' }).first()).toBeVisible();
  });

  test('deletes a hotel after confirming', async ({ page }) => {
    const hotel = await openNewHotel(page);
    await tab(page, 'Danger zone');
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.getByText(`Delete ${hotel.name}?`)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete forever' }).click();
    await expect(page).toHaveURL(/\/hotels$/);
    await successToast(page);
  });

  test('Cancel keeps the hotel', async ({ page }) => {
    await openNewHotel(page);
    await tab(page, 'Danger zone');
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/hotels\/\d+$/);
  });

  test('a hotel that does not exist shows an error', async ({ page }) => {
    await page.goto('/hotels/99999999');
    await errorToast(page);
  });
});

test.describe('staff, hotel page', () => {
  as('staff');

  test('cannot delete their hotel', async ({ page }) => {
    const api = await apiAs('staff');
    const [hotel] = await api.get('/hotels');
    await api.dispose();
    await page.goto(`/hotels/${hotel.id}`);
    await tab(page, 'Danger zone');
    await expect(page.getByRole('button', { name: 'Delete forever' })).toHaveCount(0);
  });
});
