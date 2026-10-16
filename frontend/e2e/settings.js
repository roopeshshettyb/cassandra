/**
 * Settings for the UI tests, shared by the Playwright config, the stack it starts and the tests.
 * The database comes from the shell environment (CI), else backend/test.env — the same local
 * Postgres the API tests use, with a database of its own so the two suites never share rows.
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const FRONTEND_DIR = path.join(__dirname, '..');
const BACKEND_DIR = path.join(FRONTEND_DIR, '..', 'backend');
const TEST_ENV = path.join(BACKEND_DIR, 'test.env');

const local = fs.existsSync(TEST_ENV) ? dotenv.parse(fs.readFileSync(TEST_ENV)) : {};
const read = (key) => process.env[key] || local[key];

const BACKEND_PORT = 7679;
const FRONTEND_PORT = 7690;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

// Fixed so tests can sign the tokens the backend emails out, such as invite links.
const JWT_SECRET = 'e2e-jwt-secret';

const DB = {
  host: read('DB_HOST'),
  port: Number(read('DB_PORT')),
  user: read('DB_USERNAME'),
  password: read('DB_PASSWORD'),
  database: 'cassandra_e2e',
};

// The run drops and reseeds its database: never against a shared one.
if (!['localhost', '127.0.0.1'].includes(DB.host)) {
  throw new Error(`UI tests only run against a local database, not ${DB.host}. Set it up in backend/test.env (see frontend/e2e/README.md).`);
}

// What the backend needs on top of dev.env (which it reads itself). automation_test skips email and S3.
const BACKEND_ENV = {
  NODE_ENV: 'automation_test',
  PORT: String(BACKEND_PORT),
  DB_HOST: DB.host,
  DB_PORT: String(DB.port),
  DB_USERNAME: DB.user,
  DB_PASSWORD: DB.password,
  DB_NAME: DB.database,
  DB_SSL: 'false',
  FRONTEND_URL,
  BACKEND_URL,
  JWT_SECRET,
  // Placeholders set over dev.env's real keys, so a run never reaches the real bucket or spends
  // on AI providers. CI has no dev.env, so this also keeps local runs the same as CI.
  AWS_ACCESS_KEY_ID: 'e2e',
  AWS_SECRET_ACCESS_KEY: 'e2e',
  OPENAI_API_KEY: 'e2e',
  OPENROUTER_API_KEY: 'e2e',
  DEEPGRAM_API_KEY: 'e2e',
  SARVAM_API_KEY: 'e2e',
  LIGHTNING_TTS_API_KEY: 'e2e',
  HF_TOKEN: 'e2e',
  TAVILY_API_KEY: 'e2e',
};

const BUILD_DIR = path.join(__dirname, '.build');

const FRONTEND_ENV = {
  REACT_APP_BACKEND_URL: BACKEND_URL,
  REACT_APP_FRONTEND_URL: FRONTEND_URL,
  BUILD_PATH: BUILD_DIR,
  // GitHub sets CI=true, which makes react-scripts fail the build on lint warnings.
  CI: 'false',
};

// Seeded accounts (backend/src/seed.ts): one per role, then one inbox per browser for
// notifications.spec.js, so browsers running at once never clear or toggle each other's.
const USERS = {
  admin: 'flashpactone+admin@gmail.com',
  owner: 'flashpactone+owner1@gmail.com',
  staff: 'flashpactone+staff1@gmail.com',
  guest: 'flashpactone+guest1@gmail.com',
  owner2: 'flashpactone+owner2@gmail.com',
  owner3: 'flashpactone+owner3@gmail.com',
  staff2: 'flashpactone+staff2@gmail.com',
  staff3: 'flashpactone+staff3@gmail.com',
};

const authFile = (role) => path.join(__dirname, '.auth', `${role}.json`);

module.exports = { JWT_SECRET, FRONTEND_DIR, BACKEND_DIR, BACKEND_URL, FRONTEND_URL, FRONTEND_PORT, DB, BACKEND_ENV, FRONTEND_ENV, BUILD_DIR, USERS, authFile };
