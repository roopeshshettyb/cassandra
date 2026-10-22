/**
 * Starts the backend the UI tests run against: a fresh, seeded local database, then the built
 * backend. Playwright runs this as a web server and stops it when the run ends.
 */
const { execSync, spawn } = require('child_process');
const { Client } = require('pg');
const { BACKEND_DIR, DB, BACKEND_ENV } = require('./settings');

const env = { ...process.env, ...BACKEND_ENV };

async function recreateDatabase() {
  const client = new Client({ ...DB, database: 'postgres' });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${DB.database}" WITH (FORCE)`);
  await client.query(`CREATE DATABASE "${DB.database}"`);
  await client.end();
}

async function main() {
  await recreateDatabase();
  execSync('npx nest build', { cwd: BACKEND_DIR, env, stdio: 'inherit' });
  // The compiled seed: `npm run seed` (ts-node) misses the column-option typings the build picks up.
  execSync('node dist/seed.js', { cwd: BACKEND_DIR, env, stdio: 'inherit' });
  const server = spawn(process.execPath, ['dist/main.js'], { cwd: BACKEND_DIR, env, stdio: 'inherit' });
  server.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
