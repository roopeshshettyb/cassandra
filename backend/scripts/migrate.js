/**
 * Migration script — adds missing columns to existing tables.
 *
 * Usage:
 *   node scripts/migrate.js
 *
 * Reads DB connection from dev.env automatically.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// ─── Load dev.env ─────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', 'dev.env');
const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
const env = {};
for (const line of envLines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = value;
}

// ─── Migrations ───────────────────────────────────────────────────────────────
const MIGRATIONS = [
  {
    name: 'hotels.website',
    sql: `ALTER TABLE hotels ADD COLUMN IF NOT EXISTS website VARCHAR(255);`,
  },
  {
    name: 'hotels.phone_number',
    sql: `ALTER TABLE hotels ADD COLUMN IF NOT EXISTS phone_number VARCHAR(255);`,
  },
  {
    name: 'hotels.hotel_brand_id',
    sql: `ALTER TABLE hotels ADD COLUMN IF NOT EXISTS hotel_brand_id INTEGER REFERENCES hotel_brands(id);`,
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const client = new Client({
    host: env.DB_HOST,
    port: parseInt(env.DB_PORT || '5432', 10),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log(`Connected to ${env.DB_NAME} @ ${env.DB_HOST}\n`);

  for (const migration of MIGRATIONS) {
    try {
      await client.query(migration.sql);
      console.log(`  ✓  ${migration.name}`);
    } catch (err) {
      if (err.message.includes('must be owner')) {
        console.warn(`  ⚠  ${migration.name}: insufficient privileges — run manually as postgres:`);
        console.warn(`     ${migration.sql}`);
      } else {
        console.error(`  ✗  ${migration.name}: ${err.message}`);
      }
    }
  }

  await client.end();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
