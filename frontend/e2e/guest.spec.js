// The guest portal on a guest's active booking: home, requests and the concierge entry points.
// The concierge's server is faked (fakeConcierge), so replies are known and no LLM is called.
const { test: base, expect } = require('@playwright/test');
const { authFile, BACKEND_URL } = require('./settings');
const { toast, shown, fakeConcierge, conciergeReply, sql, stubS3, openActiveStay } = require('./helpers');

// Every test talks to the fake concierge; `concierge` holds what the page sent it.
const test = base.extend({ concierge: [async ({ page }, use) => use(await fakeConcierge(page)), { auto: true }] });

test.use({ storageState: authFile('guest') });

/** Guest One's active stay, opened on a tab. */
async function openStay(page, tab) {
  await openActiveStay(page);
  await page.goto(page.url().replace(/\?.*$/, `?tab=${tab}`));
}

/** The voice concierge's microphone button, an icon with no label. */
const micButton = (page) => page.getByRole('button').filter({ has: page.getByTestId('MicIcon') });

test('lands on the concierge for the active stay', async ({ page }) => {
  await openActiveStay(page);
  await expect(shown(page, 'Your Concierge')).toBeVisible();
  for (const chip of ['I need room service', 'I need a cab', 'Prefer to type?']) await expect(page.getByRole('button', { name: chip })).toBeVisible();
});

test('home shows the stay, quick actions and recent requests', async ({ page }) => {
  await openStay(page, 'home');
  await expect(shown(page, 'Guest One')).toBeVisible();
  for (const action of ['Housekeeping', 'Laundry', 'Dining', 'Facilities']) await expect(shown(page, action)).toBeVisible();
  await expect(shown(page, 'Need extra towels')).toBeVisible();
});

test('every home shortcut opens the concierge, and View all opens the requests', async ({ page }) => {
  for (const shortcut of ['Laundry', 'Speak to your concierge']) {
    await openStay(page, 'home');
    await shown(page, shortcut).click();
    await expect(page).toHaveURL(/tab=concierge/);
  }
  await openStay(page, 'home');
  await page.getByRole('button', { name: 'Yes, please' }).click();
  await expect(page).toHaveURL(/tab=concierge/);

  await openStay(page, 'home');
  await shown(page, 'View all').click();
  await expect(page).toHaveURL(/tab=requests/);
});

test('the reservation document opens in a new tab', async ({ page, context }) => {
  await openStay(page, 'home');
  const bookingId = page.url().match(/\/bookings\/(\d+)/)[1];
  await sql("UPDATE bookings SET reservation_document_s3_key = 'e2e/reservation.pdf' WHERE id = $1", [bookingId]);
  // The tab opens a presigned S3 link; it is answered here instead of reaching S3.
  await stubS3(context, { contentType: 'text/html', body: 'document' });
  await page.reload();
  const tab = context.waitForEvent('page');
  await page.getByRole('button', { name: 'View reservation document' }).click();
  await (await tab).waitForURL(/reservation.pdf/);
});

test('a suggestion can be dismissed', async ({ page }) => {
  await openStay(page, 'home');
  await expect(shown(page, 'Turndown Service')).toBeVisible();
  // The dismiss control is a clickable box around a close icon, not a button.
  const nudge = page.locator('div', { has: shown(page, 'Turndown Service') }).filter({ has: page.getByTestId('CloseIcon') }).last();
  await nudge.getByTestId('CloseIcon').click();
  await expect(shown(page, 'Turndown Service')).toBeHidden();
});

test('requests can be filtered by type', async ({ page }) => {
  await openStay(page, 'requests');
  await expect(shown(page, 'Your Requests')).toBeVisible();
  // Guest One has a pending housekeeping request and a completed room-service one.
  await expect(shown(page, 'Completed')).toBeVisible();
  await page.getByRole('button', { name: 'Housekeeping', exact: true }).click();
  await expect(shown(page, 'Pending')).toBeVisible();
  await expect(shown(page, 'Completed')).toBeHidden();
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(shown(page, 'Completed')).toBeVisible();
});

test('a request opens its thread, without the staff controls', async ({ page }) => {
  await openStay(page, 'home');
  await shown(page, 'Need extra towels').click();
  await expect(page).toHaveURL(/\/requests\/\d+$/);
  await expect(page.getByPlaceholder('Add a message…').filter({ visible: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'In Progress' })).toHaveCount(0);
});

// In voice mode the answer is spoken, so the check is what reached the concierge.
test('a suggestion chip asks the voice concierge', async ({ page, concierge }) => {
  await openStay(page, 'concierge');
  await page.getByRole('button', { name: 'I need a cab' }).click();
  await expect.poll(() => concierge.some(([ns, event, data]) => ns === '/voice' && event === 'voice_send_text' && data.text === 'I need a cab')).toBe(true);
});

test('a microphone the browser refuses is reported', async ({ page }) => {
  // Defined rather than patched: WebKit's Windows build has no navigator.mediaDevices at all.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) } });
  });
  await openStay(page, 'concierge');
  await expect(shown(page, 'Tap to speak')).toBeVisible();
  await micButton(page).click();
  await expect(toast(page, 'Permission denied')).toBeVisible();
  await expect(shown(page, 'Tap to speak')).toBeVisible();
});

test('outside the stay the concierge says it is not available yet', async ({ page }) => {
  // The backend decides whether today is within the stay; its answer is flipped for this booking.
  await page.route((url) => url.origin === BACKEND_URL && /^\/bookings\/\d+$/.test(url.pathname), async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, data: { ...body.data, isWithinStay: false } } });
  });
  await openStay(page, 'concierge');
  await expect(shown(page, 'Available during your stay')).toBeVisible();
  for (const control of [micButton(page), page.getByRole('button', { name: 'Prefer to type?' })]) {
    await control.click();
    await expect(toast(page, 'Chat is only available during your stay (check-in to check-out)').first()).toBeVisible();
  }
  await expect(page).not.toHaveURL(/mode=chat/);
});

test('typed chat sends a message and shows the answer', async ({ page }) => {
  await openStay(page, 'concierge');
  await page.getByRole('button', { name: 'Prefer to type?' }).click();
  const box = page.getByPlaceholder('Type a message…');
  await box.fill('Is the pool open?');
  await box.press('Enter');
  await expect(shown(page, 'Is the pool open?')).toBeVisible();
  await expect(shown(page, conciergeReply('Is the pool open?'))).toBeVisible();
  await expect(box).toHaveValue('');
});
