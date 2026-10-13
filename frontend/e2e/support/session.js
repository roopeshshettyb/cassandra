// Seeded accounts (backend/src/seed.ts) and signing them in through the real email OTP flow.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { BACKEND_URL, FRONTEND_URL } = require('./env');

const ACCOUNTS = {
  admin: 'flashpactone+admin@gmail.com',
  owner: 'flashpactone+owner1@gmail.com',
  staff: 'flashpactone+staff1@gmail.com',
  guest: 'flashpactone+guest1@gmail.com',
};

/** The seeded hotel the seeded owner and staff work at. */
const SEEDED_HOTEL = 'Radisson Blu Plaza Delhi';

const stateFile = (role) => path.join(__dirname, '../.auth', `${role}.json`);

/** The OTP the backend just stored for this email. No email is sent under NODE_ENV=automation_test. */
async function readOtp(email) {
  const db = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), user: process.env.DB_USERNAME, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  try {
    const { rows } = await db.query('SELECT otp FROM accounts WHERE email = $1 AND otp IS NOT NULL ORDER BY id LIMIT 1', [email]);
    return rows[0]?.otp;
  } finally {
    await db.end();
  }
}

/** A session token for the email: asks for a code, then signs in with it. */
async function signIn(request, email) {
  const sent = await request.post(`${BACKEND_URL}/oauth/email/send-otp`, { data: { email } });
  if (!sent.ok()) throw new Error(`send-otp for ${email} answered ${sent.status()}`);
  const res = await request.post(`${BACKEND_URL}/oauth/callback`, { data: { authType: 'email', email, otp: await readOtp(email) } });
  if (!res.ok()) throw new Error(`Sign-in for ${email} answered ${res.status()}`);
  return (await res.json()).token;
}

/** Browser storage with the token where the frontend keeps it. */
const storageState = (token) => ({ cookies: [], origins: [{ origin: FRONTEND_URL, localStorage: [{ name: 'token', value: token }] }] });

/** The session token auth.setup.js saved for a role. */
const tokenOf = (role) => JSON.parse(fs.readFileSync(stateFile(role), 'utf8')).origins[0].localStorage[0].value;

/** An invite token for the account, signed as the backend signs one (AuthService.generateInviteToken). */
function inviteToken(accountId) {
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ id: accountId, invite: true, iat: Math.floor(Date.now() / 1000) })}`;
  return `${unsigned}.${crypto.createHmac('sha256', process.env.JWT_SECRET).update(unsigned).digest('base64url')}`;
}

module.exports = { ACCOUNTS, SEEDED_HOTEL, stateFile, readOtp, signIn, storageState, tokenOf, inviteToken };
