/** Shared steps for the UI tests. */
const { expect } = require('@playwright/test');
const crypto = require('crypto');
const { Client } = require('pg');
const { DB, BACKEND_URL, JWT_SECRET } = require('./settings');

/** Runs a query on the test database: for state the UI cannot reach, such as emailed codes. */
async function sql(query, params = []) {
  const client = new Client(DB);
  await client.connect();
  try {
    return (await client.query(query, params)).rows;
  } finally {
    await client.end();
  }
}

/** The sign-in code the backend stored for this email. automation_test sends no mail, so tests read it here. */
const readOtp = async (email) => (await sql('SELECT otp FROM accounts WHERE uuid = $1', [`email:${email}`]))[0]?.otp;

/** Opens the landing page. Its hero video and external assets can hold the load event for most of a minute. */
const openLanding = (page) => page.goto('/', { waitUntil: 'domcontentloaded' });

/** Opens the login popup from the landing page and moves to the email step. */
async function openEmailSignIn(page) {
  await openLanding(page);
  await page.getByRole('link', { name: 'Sign in' }).first().click();
  await page.getByRole('button', { name: 'Sign in with Email' }).click();
}

/** Asks for a code for this email and waits for the code step. */
async function requestCode(page, email) {
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('Verification code')).toBeVisible();
}

/** On the code step: enters the code the backend stored for this email and verifies it. */
async function enterCode(page, email) {
  await page.getByLabel('Verification code').fill(await readOtp(email));
  await page.getByRole('button', { name: 'Verify' }).click();
}

/** Signs in through the real email-code flow. */
async function signIn(page, email) {
  await openEmailSignIn(page);
  await requestCode(page, email);
  await enterCode(page, email);
}

/**
 * The toast shown for this message. Matched by react-toastify's class, not role: an open MUI dialog
 * hides everything outside it from the accessibility tree, toasts included.
 */
const toast = (page, message) => page.locator('.Toastify__toast').filter({ hasText: message });

/** The visible element showing exactly this text. Lists render a mobile and a desktop copy of each row. */
const shown = (scope, text) => scope.getByText(text, { exact: true }).filter({ visible: true }).first();

/** Opens the list card (or table row) that shows this name, through its Open button. */
async function openCard(page, name) {
  const card = page.locator('div', { has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Open' }) }).last();
  await card.getByRole('button', { name: 'Open' }).click();
}

/** The list row (or card) showing this text, found by the Delete control every row carries. */
const rowWith = (page, text) => page.locator('div', { has: shown(page, text) }).filter({ has: page.getByText('Delete', { exact: true }) }).last();

/** A sidebar entry, e.g. nav(page, 'Manage Hotels'). Notifications carries the unread count, e.g. "2 Notifications". */
const nav = (page, name) => page.getByRole('button', { name: name === 'Notifications' ? /^(\d+ )?Notifications$/ : name, exact: true });

/** The icon-only back button at the top of every signed-in page. MUI tags its icons with a test id. */
const backButton = (page) => page.getByRole('button').filter({ has: page.getByTestId('ArrowBackIcon') }).first();

/** A name no other test or seed row uses, so parallel runs never collide. */
const unique = (prefix) => `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

/** A backend reply in the API's envelope. */
const apiReply = (data, { status = 200, message = 'ok' } = {}) => ({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, message, data }) });

/** Answers one backend endpoint (glob after BACKEND_URL) with this data, in place of a call that leaves the building. */
const answerApi = (page, path, data, message) => page.route(`${BACKEND_URL}${path}`, (route) => route.fulfill(apiReply(data, { message })));

/**
 * Makes every backend call whose path (with query) matches `pathPattern` fail, to check how the page
 * reports it. With `method`, only calls of that method fail, so the page can still load what it shows.
 */
async function failApi(page, pathPattern, message, { method } = {}) {
  const matches = (url) => url.origin === BACKEND_URL && new RegExp(`^${pathPattern}`).test(url.pathname + url.search);
  await page.route(matches, (route) => (method && route.request().method() !== method ? route.fallback() : route.fulfill(apiReply(undefined, { status: 500, message }))));
}

/** The date `offset` days from today, as YYYY-MM-DD. */
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

/** What the fake concierge answers to a guest's message. */
const conciergeReply = (text) => `E2E reply to: ${text}`;

/**
 * Stands in for the backend's socket.io server, which would hand guest messages to an LLM. It speaks
 * just enough of the protocol: /chat (typed chat) and /voice (spoken or tapped prompts) answer each
 * message with conciergeReply; other namespaces, such as notifications, only connect. HTTP polling,
 * socket.io's fallback, is refused so nothing reaches the real server. Returns the [namespace, event, data]
 * the page has sent, newest last.
 */
async function fakeConcierge(page) {
  const sent = [];
  await page.route(`${BACKEND_URL}/socket.io/**`, (route) => route.abort());
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    const emit = (ns, event, payload) => ws.send(`42${ns},${JSON.stringify(payload === undefined ? [event] : [event, payload])}`);
    ws.send(`0${JSON.stringify({ sid: 'e2e', upgrades: [], pingInterval: 600000, pingTimeout: 600000, maxPayload: 1000000 })}`);
    ws.onMessage((frame) => {
      const packet = /^4(\d)(\/[^,]*)?,?\d*(.*)$/.exec(String(frame));
      if (!packet) return;
      const [, type, ns = '', body] = packet;
      if (type === '0') {
        ws.send(ns ? `40${ns},${JSON.stringify({ sid: 'e2e' })}` : `40${JSON.stringify({ sid: 'e2e' })}`);
        if (ns === '/chat') {
          emit(ns, 'chat_history', { chats: [{ id: 1, title: 'Earlier chat', createdAt: new Date().toISOString() }], currentChatId: 1 });
          emit(ns, 'ready', { chatId: 1, messages: [] });
        }
        if (ns === '/voice') emit(ns, 'voice_ready');
        return;
      }
      if (type !== '2') return;
      const [event, data] = JSON.parse(body);
      sent.push([ns, event, data]);
      if (ns === '/chat' && event === 'message') emit(ns, 'stream_end', { content: conciergeReply(data.content) });
      if (ns === '/chat' && (event === 'new_chat' || event === 'open_chat')) emit(ns, 'ready', { chatId: data?.chatId || 2, messages: [] });
      if (ns === '/voice' && event === 'voice_send_text') {
        emit(ns, 'voice_user_message', { text: data.text });
        emit(ns, 'voice_text_end', { text: conciergeReply(data.text) });
        emit(ns, 'voice_ready');
      }
    });
  });
  return sent;
}

/** A token signed as the backend signs its own (HS256), e.g. the invite links it emails. */
function signToken(payload, expiresInSeconds = 3600) {
  const encode = (part) => Buffer.from(JSON.stringify(part)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...payload, iat: now, exp: now + expiresInSeconds })}`;
  return `${unsigned}.${crypto.createHmac('sha256', JWT_SECRET).update(unsigned).digest('base64url')}`;
}

/**
 * Answers every browser request to S3 (presigned uploads and links) without it leaving the machine.
 * `target` is a page or, for links that open a new tab, its context; `{ status: 500 }` makes uploads fail.
 */
const stubS3 = (target, response = { status: 200 }) => target.route((url) => url.hostname.endsWith('amazonaws.com'), (route) => route.fulfill(response));

/**
 * Stands in for the system clipboard, which browsers guard differently: copies are kept in the page
 * (read them with `copiedText`), or with `refuse` they fail as a browser that denies access would.
 */
const fakeClipboard = (page, { refuse = false } = {}) => page.addInitScript((refused) => {
  navigator.clipboard.writeText = async (text) => {
    if (refused) throw new DOMException('Write permission denied.', 'NotAllowedError');
    window.copiedText = text;
  };
}, refuse);

/** What the page last copied, with fakeClipboard in place. */
const copiedText = (page) => page.evaluate(() => window.copiedText);

/** A file for setInputFiles. */
const file = (name, mimeType, content = 'e2e') => ({ name, mimeType, buffer: Buffer.from(content) });

/** A valid 1x1 PNG, for image inputs that decode what they are given. */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** A hotel that is not in the database yet, as the onboarding place search would return it. */
const newPlace = () => {
  const name = unique('E2E Hotel');
  return { id: `place-${name}`, name, address: `${name} Road, Pune 411001` };
};

/**
 * Answers onboarding's place search, analysis and extraction (Google and an LLM in production) with
 * this place and the hotel data "extracted" from it. The final save still goes to the real backend.
 */
async function stubOnboarding(page, place, { analysis = {}, extracted = {} } = {}) {
  await answerApi(page, '/hotels/onboarding/search?*', [place]);
  await answerApi(page, '/hotels/onboarding/analyze/*', { needsWebsite: false, ...analysis });
  await answerApi(page, '/hotels/onboarding/extract', { name: place.name, address: place.address, website: 'https://example.com', phoneNumber: '+91 11 0000 0000', checkInTime: '14:00', checkOutTime: '11:00', ...extracted });
}

/** On the hotels page: opens Add Hotel and picks the place from the search. */
async function searchAndPick(page, place) {
  await page.getByRole('button', { name: '+ Add Hotel' }).click();
  await page.getByPlaceholder('e.g. Radisson Blu Pune Kharadi').fill(place.name);
  await page.getByRole('option', { name: new RegExp(place.name) }).click();
}

/** Onboards a new hotel through the UI and returns its place. `extracted` can set e.g. brandName. */
async function onboardHotel(page, extracted = {}) {
  const place = newPlace();
  await stubOnboarding(page, place, { extracted });
  await page.goto('/hotels');
  await searchAndPick(page, place);
  await page.getByRole('button', { name: 'Confirm & Save' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  return place;
}

/** As the seeded guest: opens the app, which moves a guest on to their active stay's concierge. */
async function openActiveStay(page) {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/bookings\/\d+\?tab=concierge$/);
}

/** Onboards a hotel and opens its detail page, on a tab if given; returns its place. */
async function openNewHotel(page, tab) {
  const place = await onboardHotel(page);
  await openCard(page, place.name);
  await expect(page).toHaveURL(/\/hotels\/\d+$/);
  if (tab) await page.getByRole('button', { name: tab, exact: true }).click();
  return place;
}

module.exports = { sql, signToken, stubS3, fakeClipboard, copiedText, file, PNG, readOtp, openLanding, openEmailSignIn, requestCode, enterCode, signIn, toast, shown, openCard, rowWith, nav, backButton, unique, day, conciergeReply, fakeConcierge, answerApi, failApi, newPlace, stubOnboarding, searchAndPick, onboardHotel, openActiveStay, openNewHotel };
