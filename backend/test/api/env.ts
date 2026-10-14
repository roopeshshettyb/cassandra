/**
 * Settings for the API suites, loaded once before anything reads them: test.env, then dev.env.
 * dotenv never overwrites a variable already set, so the shell environment wins, then test.env.
 */
import * as path from 'path';
import * as dotenv from 'dotenv';

// Placeholder AWS keys, set first so dev.env's real ones are not used: a run never reaches the real bucket.
Object.assign(process.env, { AWS_ACCESS_KEY_ID: 'api-test', AWS_SECRET_ACCESS_KEY: 'api-test' });

for (const file of ['test.env', 'dev.env']) dotenv.config({ path: path.join(__dirname, '../..', file), quiet: true });

// The suites create and hard-delete rows: never against a shared database.
if (!['localhost', '127.0.0.1'].includes(process.env.DB_HOST)) {
  throw new Error(`API tests only run against a local database, not ${process.env.DB_HOST}. Set it up in backend/test.env (see test/README.md).`);
}
