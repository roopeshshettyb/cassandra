// Settings for the UI tests: backend/test.env, then backend/dev.env, locally; the environment in CI.
// dotenv never overwrites a variable already set, so the environment wins, then test.env.
const path = require('path');
const dotenv = require('dotenv');

for (const file of ['test.env', 'dev.env']) dotenv.config({ path: path.join(__dirname, '../../../backend', file), quiet: true });

const FRONTEND_PORT = 7679;
const BACKEND_URL = `http://localhost:${process.env.PORT}`;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;

// The run seeds the database and changes its data: never against a shared one.
if (!['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) {
  throw new Error(`UI tests only run against a local database, not ${process.env.DB_HOST}. Set it up in backend/test.env (see e2e/README.md).`);
}

// Paid services are switched off and AWS gets placeholder keys, so a run never reaches a model, a
// maps or search API, or the real bucket: those calls are faked in the specs (support/ui.js).
const OFFLINE = Object.fromEntries(
  ['OPENAI_API_KEY', 'OPENROUTER_API_KEY', 'DEEPGRAM_API_KEY', 'HF_TOKEN', 'HUGGINGFACE_API_KEY', 'SARVAM_API_KEY', 'LIGHTNING_TTS_API_KEY', 'TAVILY_API_KEY', 'GOOGLE_MAPS_API', 'RAPID_API_KEY'].map(
    (key) => [key, ''],
  ),
);

// What both servers start with. FRONTEND_URL is the backend's CORS origin.
const env = { ...process.env, ...OFFLINE, AWS_ACCESS_KEY_ID: 'e2e', AWS_SECRET_ACCESS_KEY: 'e2e', NODE_ENV: 'automation_test', FRONTEND_URL };

module.exports = { env, BACKEND_URL, FRONTEND_URL, FRONTEND_PORT };
