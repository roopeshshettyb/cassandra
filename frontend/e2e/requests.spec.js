// Manage Requests and a request's page (ManageRequests.js, RequestDetails.js).
const { test, expect } = require('@playwright/test');
const { as, toast, failApi, errorToast } = require('./support/ui');
const { apiAs } = require('./support/api');

/** A new pending request from the seeded guest, on their current stay. */
async function newRequest() {
  const api = await apiAs('guest');
  const [me, booking] = [await api.get('/accounts/me'), await api.get('/bookings/active')];
  const req = await api.post('/requests', { hotelId: booking.hotelId, guestId: me.id, bookingId: booking.id, requestType: 'laundry', urgency: 'low' });
  await api.dispose();
  return req;
}

/** Picks options of a list filter (ListControls.js), then closes its menu. */
async function filterBy(page, label, ...options) {
  await page.getByLabel(label).click();
  for (const option of options) await page.getByRole('option', { name: option }).click();
  await page.keyboard.press('Escape');
}

test.describe('requests list', () => {
  as('admin');

  test('a card opens its request', async ({ page }) => {
    await page.goto('/requests');
    await page.getByText('Laundry').first().click();
    await expect(page).toHaveURL(/\/requests\/\d+$/);
  });

  test('the Status filter keeps only the requests in that status', async ({ page }) => {
    await page.goto('/requests');
    await filterBy(page, 'Status', 'Completed');
    await expect(page.getByText('Completed').first()).toBeVisible();
    await expect(page.getByText('Pending', { exact: true })).toHaveCount(0);
  });

  // The seeded airport transfer is high urgency, so adding Low leaves nothing.
  test('the Request Type and Urgency filters narrow the list', async ({ page }) => {
    await page.goto('/requests');
    await filterBy(page, 'Request Type', 'Airport Transfer');
    await expect(page.getByText('No data found')).toHaveCount(0);
    await expect(page.getByText('Laundry', { exact: true })).toHaveCount(0);
    await filterBy(page, 'Urgency', 'Low');
    await expect(page.getByText('No data found')).toBeVisible();
  });

  test('a list that fails to load shows the error', async ({ page }) => {
    await failApi(page, '/requests(\\?.*)?$', 500, 'Requests unavailable');
    await page.goto('/requests');
    await toast(page, 'Requests unavailable');
  });
});

test.describe('a request page', () => {
  as('admin');

  test('moves a request to In Progress', async ({ page }) => {
    const req = await newRequest();
    await page.goto(`/requests/${req.id}`);
    await page.getByRole('button', { name: 'In Progress' }).first().click();
    await toast(page, 'Status updated');
    await page.reload();
    await expect(page.getByText('In Progress').first()).toBeVisible();
  });

  test('raises the priority to High', async ({ page }) => {
    const req = await newRequest();
    await page.goto(`/requests/${req.id}`);
    await page.getByRole('button', { name: 'High', exact: true }).first().click();
    await toast(page, 'Priority updated');
    const api = await apiAs('admin');
    expect((await api.get(`/requests/${req.id}`)).urgency).toBe('high');
    await api.dispose();
  });

  test('a failed status change shows the error', async ({ page }) => {
    const req = await newRequest();
    await page.goto(`/requests/${req.id}`);
    await failApi(page, `/requests/${req.id}$`, 500, 'Could not update');
    await page.getByRole('button', { name: 'Completed' }).first().click();
    await toast(page, 'Could not update');
  });

  test('adds a message to the request', async ({ page }) => {
    const req = await newRequest();
    const text = `E2E note ${Date.now()}`;
    await page.goto(`/requests/${req.id}`);
    const box = page.getByPlaceholder('Add a message…');
    await box.fill(text);
    await box.press('Enter');
    await expect(page.getByText(text)).toBeVisible();
  });

  test('cannot send an empty message', async ({ page }) => {
    const req = await newRequest();
    await page.goto(`/requests/${req.id}`);
    await expect(page.getByRole('button').filter({ has: page.getByTestId('SendIcon') })).toBeDisabled();
  });

  test('a message that fails to send shows the error', async ({ page }) => {
    const req = await newRequest();
    await page.goto(`/requests/${req.id}`);
    await failApi(page, `/requests/${req.id}/append-message$`, 500, 'Message not sent');
    const box = page.getByPlaceholder('Add a message…');
    await box.fill('Will fail');
    await box.press('Enter');
    await toast(page, 'Message not sent');
  });

  test('a request that does not exist shows an error', async ({ page }) => {
    await page.goto('/requests/99999999');
    await errorToast(page);
    await expect(page.getByPlaceholder('Add a message…')).toHaveCount(0);
  });
});
