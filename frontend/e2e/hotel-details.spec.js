// A hotel's detail page, tab by tab. Each test works on a hotel it onboards itself, so nothing
// seeded changes. Browser uploads go to presigned S3 URLs, which stubS3 answers.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, shown, unique, openCard, openNewHotel, stubS3, fakeClipboard, copiedText, failApi, file, PNG, sql } = require('./helpers');

const nameBox = (page) => page.getByPlaceholder('Ex. Grand Oberoi Mumbai');
const save = (page) => page.getByRole('button', { name: 'Save', exact: true });
const logoInput = (page) => page.locator('input[type=file][accept="image/*"]:not([multiple])');
const photosInput = (page) => page.locator('input[type=file][multiple]');
const toneInput = (page) => page.locator('input[type=file][accept="audio/*"]');
const playTone = (page) => page.getByRole('button').filter({ has: page.getByTestId('PlayArrowIcon') });
const hotelPhotos = (page) => page.locator('img[src*="amazonaws.com"]');
const deleteForever = (page) => page.getByRole('button', { name: 'Delete forever' });

const LOGO = file('logo.png', 'image/png', PNG);
const PHOTO = file('a.png', 'image/png', PNG);
const TONE = file('ding.mp3', 'audio/mpeg');
/** Just over the 5MB limit the logo and tone inputs set. */
const OVERSIZED = Buffer.alloc(5 * 1024 * 1024 + 1);

/** Saves the open tab, then reloads and reopens it, so checks after this see what the backend kept. */
async function saveAndReopen(page, tab) {
  await save(page).click();
  await expect(save(page)).toBeHidden();
  await page.reload();
  await page.getByRole('button', { name: tab, exact: true }).click();
}

test.describe('admin', () => {
  test.use({ storageState: authFile('admin') });

  test('renames a hotel, and discard undoes an edit', async ({ page }) => {
    const place = await openNewHotel(page);
    await nameBox(page).fill('Not kept');
    await page.getByRole('button', { name: 'Discard' }).click();
    await expect(nameBox(page)).toHaveValue(place.name);

    const renamed = unique('E2E Renamed Hotel');
    await nameBox(page).fill(renamed);
    await save(page).click();
    await expect(page.getByRole('button', { name: 'Discard' })).toBeHidden();
    await page.reload();
    await expect(nameBox(page)).toHaveValue(renamed);
  });

  test('reports a save the backend refuses, and keeps the edit', async ({ page }) => {
    await openNewHotel(page);
    await failApi(page, '/hotels/\\d+$', 'Hotel is locked', { method: 'PATCH' });
    await nameBox(page).fill('Not saved');
    await save(page).click();
    await expect(toast(page, 'Hotel is locked')).toBeVisible();
    await expect(nameBox(page)).toHaveValue('Not saved');
    await expect(page.getByRole('button', { name: 'Discard' })).toBeVisible();
  });

  test('every tab swaps the identity form out, and Identity brings it back', async ({ page }) => {
    await page.goto('/hotels');
    await openCard(page, 'ITC Maurya');
    for (const tab of ['Hours & Wi-Fi', 'Theme', 'Concierge AI', 'Restaurant', 'Members', 'Integrations', 'Danger zone']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(nameBox(page)).toBeHidden();
    }
    await page.getByRole('button', { name: 'Identity', exact: true }).click();
    await expect(nameBox(page)).toHaveValue('ITC Maurya');
  });

  test('the breadcrumb goes back to hotels', async ({ page }) => {
    await page.goto('/hotels');
    await openCard(page, 'ITC Maurya');
    await shown(page, 'Hotels').click();
    await expect(page).toHaveURL(/\/hotels$/);
  });

  test('uploads a logo, and refuses a file that is not an image or is too big', async ({ page }) => {
    await stubS3(page);
    await openNewHotel(page);

    await logoInput(page).setInputFiles(file('notes.txt', 'text/plain'));
    await expect(toast(page, 'Only image files are allowed')).toBeVisible();
    await logoInput(page).setInputFiles(file('huge.png', 'image/png', OVERSIZED));
    await expect(toast(page, 'File size must not exceed 5MB')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Upload huge.png' })).toHaveCount(0);

    await logoInput(page).setInputFiles(LOGO);
    await page.getByRole('button', { name: 'Upload logo.png' }).click();
    await expect(toast(page, 'Logo uploaded')).toBeVisible();
  });

  test('reports a logo that fails to upload', async ({ page }) => {
    await stubS3(page, { status: 500 });
    await openNewHotel(page);
    await logoInput(page).setInputFiles(LOGO);
    await page.getByRole('button', { name: 'Upload logo.png' }).click();
    await expect(toast(page, 'Logo upload failed: S3 upload failed (500)')).toBeVisible();
  });

  test('uploads photos and deletes one', async ({ page }) => {
    await stubS3(page);
    await openNewHotel(page);
    await photosInput(page).setInputFiles([PHOTO]);
    await expect(toast(page, 'Photos uploaded')).toBeVisible();

    await expect(hotelPhotos(page)).toHaveCount(1);
    await page.getByRole('button').filter({ has: page.getByTestId('CloseIcon') }).first().click();
    await expect(hotelPhotos(page)).toHaveCount(0);
  });

  test('reorders photos by dragging, and keeps the order', async ({ page }) => {
    // The photos are fetched back from S3 too: real image bytes give them a size to drag by.
    await stubS3(page, { status: 200, contentType: 'image/png', body: PNG });
    await openNewHotel(page);
    await photosInput(page).setInputFiles([PHOTO, file('b.png', 'image/png', PNG)]);
    await expect(hotelPhotos(page)).toHaveCount(2);
    const order = () => hotelPhotos(page).evaluateAll((images) => images.map((image) => image.src));
    const [first, second] = await order();

    // The page never settles enough for the "stable" check (it keeps animating), so the drag skips it.
    await hotelPhotos(page).nth(1).dragTo(hotelPhotos(page).nth(0), { force: true });
    await expect.poll(order).toEqual([second, first]);
    await page.reload();
    await expect.poll(order).toEqual([second, first]);
  });

  test('refuses a photo that is not an image', async ({ page }) => {
    await openNewHotel(page);
    await photosInput(page).setInputFiles([file('notes.txt', 'text/plain')]);
    await expect(toast(page, 'Only image files up to 100MB are allowed')).toBeVisible();
  });

  test('reports a photo that fails to upload', async ({ page }) => {
    await stubS3(page, { status: 500 });
    await openNewHotel(page);
    await photosInput(page).setInputFiles([PHOTO]);
    await expect(toast(page, 'Photo upload failed: S3 upload failed (500)')).toBeVisible();
    await expect(hotelPhotos(page)).toHaveCount(0);
  });

  test('plays the built-in tone, and uploads a custom one', async ({ page }) => {
    await stubS3(page);
    await openNewHotel(page);
    await playTone(page).click();

    await toneInput(page).setInputFiles(file('photo.png', 'image/png'));
    await expect(toast(page, 'Only audio files are allowed')).toBeVisible();
    await toneInput(page).setInputFiles(file('long.mp3', 'audio/mpeg', OVERSIZED));
    await expect(toast(page, 'File must not exceed 5MB')).toBeVisible();

    await toneInput(page).setInputFiles(TONE);
    await page.getByRole('button', { name: 'Upload ding.mp3' }).click();
    await expect(toast(page, 'Notification tone uploaded')).toBeVisible();
  });

  test('reports a tone that fails to upload', async ({ page }) => {
    await stubS3(page, { status: 500 });
    await openNewHotel(page);
    await toneInput(page).setInputFiles(TONE);
    await page.getByRole('button', { name: 'Upload ding.mp3' }).click();
    await expect(toast(page, 'Tone upload failed: S3 upload failed (500)')).toBeVisible();
  });

  test('says there is nothing to play for a silent tone', async ({ page }) => {
    // The page offers no control for "silent"; a hotel gets it from the API.
    await openNewHotel(page);
    const hotelId = page.url().match(/\/hotels\/(\d+)$/)[1];
    await sql("UPDATE hotels SET notification_tone = 'none' WHERE id = $1", [hotelId]);
    await page.reload();
    await expect(shown(page, 'Silent')).toBeVisible();
    await playTone(page).click();
    await expect(toast(page, 'Silent tone selected')).toBeVisible();
  });

  test('saves hours and the Wi-Fi password', async ({ page }) => {
    await openNewHotel(page, 'Hours & Wi-Fi');
    await page.getByPlaceholder('Ex. 24 hours').fill('6:00 AM – 11:00 PM');
    await page.getByPlaceholder('Ex. Hotel@2024').fill('e2e-wifi');
    await saveAndReopen(page, 'Hours & Wi-Fi');
    await expect(page.getByPlaceholder('Ex. 24 hours')).toHaveValue('6:00 AM – 11:00 PM');
    await expect(page.getByPlaceholder('Ex. Hotel@2024')).toHaveValue('e2e-wifi');
  });

  test('applies a colour preset', async ({ page }) => {
    await openNewHotel(page, 'Theme');
    await page.getByRole('button', { name: 'Coastal' }).click();
    await expect(shown(page, '#1F4E5F')).toBeVisible();
    await saveAndReopen(page, 'Theme');
    await expect(shown(page, '#1F4E5F')).toBeVisible();
  });

  test('saves concierge instructions', async ({ page }) => {
    const instructions = 'Always recommend the rooftop bar.';
    await openNewHotel(page, 'Concierge AI');
    await page.getByPlaceholder(/^Ex\. Always recommend the rooftop bar/).fill(instructions);
    await saveAndReopen(page, 'Concierge AI');
    await expect(page.getByPlaceholder(/^Ex\. Always recommend the rooftop bar/)).toHaveValue(instructions);
  });

  test('invites a member, then disables and reactivates them', async ({ page }) => {
    await openNewHotel(page, 'Members');
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(toast(page, 'Email is required')).toBeVisible();

    const email = `e2e.member.${Date.now()}@example.com`;
    await page.getByPlaceholder('Add by email…').fill(email);
    await page.getByRole('button', { name: 'Send invite' }).click();
    await expect(shown(page, email)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable' })).toHaveCount(0);

    // Accepting an invite happens by email; mark it accepted so the status controls appear.
    await sql("UPDATE hotel_accounts SET status = 'active' WHERE account_id = (SELECT id FROM accounts WHERE email = $1)", [email]);
    await page.reload();
    await page.getByRole('button', { name: 'Members', exact: true }).click();
    await page.getByRole('button', { name: 'Disable' }).click();
    await expect(page.getByRole('button', { name: 'Activate' })).toBeVisible();
    await page.getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByRole('button', { name: 'Disable' })).toBeVisible();
  });

  test('imports members from a CSV, and refuses another file type', async ({ page }) => {
    await openNewHotel(page, 'Members');
    const csvInput = page.locator('input[type=file][accept=".csv,text/csv"]');

    await csvInput.setInputFiles(file('members.txt', 'text/plain'));
    await expect(toast(page, 'Please upload a csv file')).toBeVisible();

    const email = `e2e.csv.${Date.now()}@example.com`;
    await csvInput.setInputFiles(file('members.csv', 'text/csv', `email,name,role\n${email},E2E Csv,hotel_staff\n`));
    await expect(shown(page, email)).toBeVisible();
  });

  test('downloads the sample CSV', async ({ page }) => {
    await openNewHotel(page, 'Members');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download sample csv' }).click();
    expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  });

  test('generates, copies, rotates and revokes an integration token', async ({ page }) => {
    await fakeClipboard(page);
    await openNewHotel(page, 'Integrations');
    await expect(shown(page, 'Not configured')).toBeVisible();

    await page.getByRole('button', { name: 'Generate Token' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('This token will not be shown again');
    await dialog.getByRole('button', { name: 'Copy Token' }).click();
    await expect(toast(page, 'Copied to clipboard')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toBeHidden();

    // The two webhook copy buttons are icon-only: bookings first, then requests.
    const copyButtons = page.getByRole('button').filter({ has: page.getByTestId('ContentCopyIcon') });
    await copyButtons.nth(0).click();
    await expect.poll(() => copiedText(page)).toMatch(/\/integrations\/v1\/bookings$/);
    await copyButtons.nth(1).click();
    await expect.poll(() => copiedText(page)).toMatch(/\/integrations\/v1\/requests$/);

    await page.getByRole('button', { name: 'Rotate Token' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Revoke Token' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Revoke Token' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revoke Token' }).click();
    await expect(shown(page, 'Revoked')).toBeVisible();
  });

  test('reports a copy the browser refuses', async ({ page }) => {
    await fakeClipboard(page, { refuse: true });
    await openNewHotel(page, 'Integrations');
    await page.getByRole('button', { name: 'Generate Token' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Copy Token' }).click();
    await expect(toast(page, 'Copy failed')).toBeVisible();
  });

  test('reports a delete the backend refuses, and stays on the hotel', async ({ page }) => {
    await openNewHotel(page, 'Danger zone');
    await failApi(page, '/hotels/\\d+$', 'Hotel has bookings', { method: 'DELETE' });
    await deleteForever(page).click();
    await deleteForever(page.getByRole('dialog')).click();
    await expect(toast(page, 'Hotel has bookings')).toBeVisible();
    await expect(page).toHaveURL(/\/hotels\/\d+$/);
  });

  test('deletes a hotel after confirming', async ({ page }) => {
    const place = await openNewHotel(page, 'Danger zone');
    await deleteForever(page).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await deleteForever(page).click();
    await deleteForever(page.getByRole('dialog')).click();
    await expect(page).toHaveURL(/\/hotels$/);
    await expect(shown(page, place.name)).toBeHidden();
  });
});

test.describe('owner', () => {
  test.use({ storageState: authFile('owner') });

  test('cannot delete a hotel', async ({ page }) => {
    await page.goto('/hotels');
    await page.getByRole('button', { name: 'Open' }).first().click();
    await page.getByRole('button', { name: 'Danger zone' }).click();
    await expect(deleteForever(page)).toHaveCount(0);
  });
});
