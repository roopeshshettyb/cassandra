// Calls the backend directly as a seeded role, for setting up and checking data around a UI test.
const { request } = require('@playwright/test');
const { BACKEND_URL } = require('./env');
const { tokenOf } = require('./session');

/** A request context signed in as the role; each call returns the response body's `data`. */
async function apiAs(role) {
  const ctx = await request.newContext({ baseURL: BACKEND_URL, extraHTTPHeaders: { Authorization: `Bearer ${tokenOf(role)}` } });
  const call = (method) => async (url, data) => {
    const res = await ctx.fetch(url, { method, data });
    if (!res.ok()) throw new Error(`${method} ${url} as ${role} answered ${res.status()}: ${await res.text()}`);
    const body = await res.json();
    return body.data ?? body;
  };
  return { get: call('GET'), post: call('POST'), patch: call('PATCH'), dispose: () => ctx.dispose() };
}

/** A name unique to this run, so what a test creates is easy to find and cannot collide. */
const uniqueName = (prefix) => `${prefix} e2e ${Date.now()}`;

/** A room number unique to this run. */
const uniqueRoom = () => `E2E${Date.now() % 1000000}`;

/** An email address unique to this run. */
const uniqueEmail = (prefix) => `${uniqueName(prefix).replace(/\s+/g, '-').toLowerCase()}@cassandratest.local`;

/** The date `offset` days from today, as YYYY-MM-DD. */
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

module.exports = { apiAs, uniqueName, uniqueRoom, uniqueEmail, day };
