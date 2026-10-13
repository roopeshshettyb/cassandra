// Page helpers shared by the specs.
const { test, expect } = require('@playwright/test');
const { stateFile } = require('./session');
const { BACKEND_URL, FRONTEND_URL } = require('./env');

/** Runs the rest of the describe block signed in as this seeded role. */
const as = (role) => test.use({ storageState: stateFile(role) });

/** Sidebar items each role sees (src/components/Sidebar.js); admin sees them all. */
const NAV = {
  admin: ['Dashboard', 'Manage Hotels', 'Manage Rooms', 'Manage Brands', 'Manage Bookings', 'Manage Requests', 'Manage Costs', 'Manage Organisations'],
  owner: ['Dashboard', 'Manage Hotels', 'Manage Rooms', 'Manage Bookings', 'Manage Requests', 'Manage Organisations'],
  staff: ['Dashboard', 'Manage Hotels', 'Manage Rooms', 'Manage Bookings', 'Manage Requests'],
};

/** Clicks a sidebar item. Not exact: Notifications carries its unread count. */
const navigate = (page, text) => page.getByRole('button', { name: text }).click();

/** The top-right back button. */
const back = (page) => page.getByTestId('ArrowBackIcon').click();

/** Opens a hotel's page from Manage Hotels: a card opens from its Open button, not its name. */
async function openHotel(page, name) {
  await page.goto('/hotels');
  await page.getByLabel('Search by name or address').fill(name);
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page).toHaveURL(/\/hotels\/\d+$/);
}

/** The common toast with this text. */
const toast = (page, text) => expect(page.locator('.Toastify__toast').filter({ hasText: text }).first()).toBeVisible();

/** Some error toast, for errors whose wording the backend owns. */
const errorToast = (page, options) => expect(page.locator('.Toastify__toast--error').first()).toBeVisible(options);

/** Some success toast. */
const successToast = (page) => expect(page.locator('.Toastify__toast--success').first()).toBeVisible();

/** Opens a tab of a details page. */
const tab = (page, name) => page.getByRole('button', { name, exact: true }).click();

/** Saves a details page. */
const save = (page) => page.getByRole('button', { name: 'Save', exact: true }).click();

const CORS = { 'Access-Control-Allow-Origin': FRONTEND_URL, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE' };

/**
 * Answers backend calls whose path matches the regex source with this status and body, standing in
 * for the backend or for a paid service it would call. The CORS preflight still passes.
 */
const fakeApi = (page, pathPattern, status, body) =>
  page.route(new RegExp(`^${BACKEND_URL}${pathPattern}`), (route) =>
    route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status, headers: CORS, contentType: 'application/json', body: JSON.stringify(body) }),
  );

/** A server fault on the matching backend calls, with this message. */
const failApi = (page, pathPattern, status, message) => fakeApi(page, pathPattern, status, { success: false, message, data: null });

/** Accepts the browser's direct uploads to S3, so no file reaches a bucket. */
const fakeS3 = (page) =>
  page.route(/amazonaws\.com/, (route) => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'PUT' } }));

/** A small PNG for upload inputs. */
const PNG = { name: 'e2e.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') };

module.exports = { as, NAV, navigate, back, openHotel, toast, errorToast, successToast, tab, save, fakeApi, failApi, fakeS3, PNG };
