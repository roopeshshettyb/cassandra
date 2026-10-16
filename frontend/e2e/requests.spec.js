// Guest requests as hotel staff see them: the filtered list, and working a request through its
// status, priority and messages.
const { test, expect } = require('@playwright/test');
const { authFile } = require('./settings');
const { toast, shown, unique, failApi, sql } = require('./helpers');

// Seeded: Guest Two's airport transfer at Radisson Blu Plaza Delhi.
const REQUEST_NOTE = 'Flight lands at 14:00';

/**
 * Opens a fresh copy of the seeded airport transfer (high priority, pending), so tests that change
 * a request never change one another's, or the seeded rows the filters check, in any browser.
 */
async function openNewRequest(page) {
  const note = unique('E2E transfer');
  await sql(
    "INSERT INTO requests (hotel_id, guest_id, booking_id, request_type, user_notes, staff_notes, data, urgency, status, created_at, updated_at) SELECT hotel_id, guest_id, booking_id, request_type, jsonb_build_array($1::text), '[]'::jsonb, data, urgency, 'pending', NOW(), NOW() FROM requests WHERE user_notes ? $2",
    [note, REQUEST_NOTE],
  );
  await page.goto('/requests');
  await shown(page, note).click();
  await expect(page).toHaveURL(/\/requests\/\d+$/);
}

test.describe('staff', () => {
  test.use({ storageState: authFile('staff') });

  // Seeded: an airport transfer (high, pending), extra towels (low, pending), room service (completed).
  for (const [filter, option, kept, dropped] of [
    ['Status', 'Completed', 'Please send to room 301', 'Need extra towels'],
    ['Request Type', 'Airport Transfer', REQUEST_NOTE, 'Need extra towels'],
    ['Urgency', 'Low', 'Need extra towels', REQUEST_NOTE],
  ]) {
    test(`filters requests by ${filter.toLowerCase()}`, async ({ page }) => {
      await page.goto('/requests');
      for (const note of [REQUEST_NOTE, 'Need extra towels', 'Please send to room 301']) await expect(shown(page, note)).toBeVisible();
      await page.getByLabel(filter).click();
      await page.getByRole('option', { name: option, exact: true }).click();
      await page.keyboard.press('Escape');
      await expect(shown(page, kept)).toBeVisible();
      await expect(shown(page, dropped)).toBeHidden();
    });
  }

  test('moves a request through its statuses', async ({ page }) => {
    await openNewRequest(page);
    await page.getByRole('button', { name: 'In Progress' }).click();
    await expect(toast(page, 'Status updated')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Status').locator('..')).toContainText('In Progress');
    await page.getByRole('button', { name: 'Pending' }).click();
    await expect(toast(page, 'Status updated')).toBeVisible();
  });

  test('changes the priority', async ({ page }) => {
    // Starts as high priority; lowered, then put back.
    await openNewRequest(page);
    await page.getByRole('button', { name: 'Low', exact: true }).click();
    await expect(toast(page, 'Priority updated')).toBeVisible();
    await expect(shown(page, 'low priority')).toBeVisible();
    await page.getByRole('button', { name: 'High', exact: true }).click();
    await expect(shown(page, 'high priority')).toBeVisible();
  });

  test('replies to the guest', async ({ page }) => {
    const reply = unique('Driver is on the way');
    await openNewRequest(page);
    const box = page.getByPlaceholder('Add a message…').filter({ visible: true });
    await box.fill(reply);
    await box.press('Enter');
    await expect(toast(page, 'Message sent')).toBeVisible();
    await expect(shown(page, reply)).toBeVisible();
    await expect(box).toHaveValue('');
  });

  test('reports a status change the backend refuses', async ({ page }) => {
    await openNewRequest(page);
    await failApi(page, '/requests/\\d+$', 'Request is locked');
    await page.getByRole('button', { name: 'Cancelled' }).click();
    await expect(toast(page, 'Request is locked')).toBeVisible();
  });
});
