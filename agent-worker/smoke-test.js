#!/usr/bin/env node
/**
 * End-to-end smoke test for the browser-agent pipeline.
 *
 *   node agent-worker/smoke-test.js            # against local  (localhost:7676)
 *   node agent-worker/smoke-test.js --stage    # against stage
 *   node agent-worker/smoke-test.js --no-worker  # skip the slow browser leg
 *
 * Covers the whole path a guest request actually travels:
 *
 *   auth boundaries -> enqueue -> worker claims -> browser runs -> second
 *   independent read verifies -> answer delivered into the chat
 *
 * Everything it creates it deletes, including on failure. Run it against stage
 * whenever you want to know the pipeline is genuinely alive rather than merely
 * deployed — the two are not the same thing, and the difference is the worker.
 *
 * Requires: backend reachable, backend/dev.env readable (DB + worker secret).
 * The full run needs the worker process up; without it the browser leg is
 * reported as SKIP rather than silently passing.
 */

const path = require('path');
const fs = require('fs');

const BACKEND_DIR = path.resolve(__dirname, '../backend');
const dotenv = require(path.join(BACKEND_DIR, 'node_modules/dotenv'));
const { Client } = require(path.join(BACKEND_DIR, 'node_modules/pg'));

const env = dotenv.parse(fs.readFileSync(path.join(BACKEND_DIR, 'dev.env')));

const STAGE = process.argv.includes('--stage');
const SKIP_WORKER = process.argv.includes('--no-worker');
const API = STAGE ? 'https://samantha-api-dev.flashpact.in' : `http://localhost:${env.PORT || 7676}`;
// Stage has its own worker secret, generated on that box — it is deliberately not
// the same as the local dev one, so reading dev.env would always fail there.
// Export AGENT_WORKER_SECRET to override (see the --stage hint below).
const WORKER_SECRET = process.env.AGENT_WORKER_SECRET || (STAGE ? '' : env.AGENT_WORKER_SECRET) || '';
// A browser task measured 20-120s; two runs happen per job (the read plus the
// verification read), so allow generously before calling it stuck.
const WORKER_TIMEOUT_MS = 5 * 60 * 1000;

const g = (s) => `\x1b[32m${s}\x1b[0m`;
const r = (s) => `\x1b[31m${s}\x1b[0m`;
const y = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let passed = 0;
let failed = 0;
let skipped = 0;

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ${g('PASS')}  ${name}${detail ? dim(' — ' + detail) : ''}`);
  } else {
    failed++;
    console.log(`  ${r('FAIL')}  ${name}${detail ? ' — ' + detail : ''}`);
  }
  return ok;
}

function skip(name, why) {
  skipped++;
  console.log(`  ${y('SKIP')}  ${name}${why ? dim(' — ' + why) : ''}`);
}

async function status(url, options = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000), ...options });
    return res.status;
  } catch {
    return 0;
  }
}

function db() {
  return new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });
}

async function main() {
  console.log(`\n  browser-agent pipeline smoke test`);
  console.log(`  ${dim(`target: ${API}`)}\n`);

  // ── 1. is anything actually there ─────────────────────────────────────────
  check('backend reachable', (await status(`${API}/constants/public`)) === 200);

  // ── 2. the worker routes must not be open ─────────────────────────────────
  check('worker route rejects no credentials', (await status(`${API}/agent-worker/claim`, { method: 'POST' })) === 401);
  check(
    'worker route rejects a wrong secret',
    (await status(`${API}/agent-worker/claim`, { method: 'POST', headers: { Authorization: 'Bearer wrong' } })) === 401,
  );

  if (!WORKER_SECRET) {
    const hint = STAGE
      ? `export AGENT_WORKER_SECRET=$(ssh -i fp-one fp-one@13.204.144.181 \\
      "grep '^AGENT_WORKER_SECRET=' ~/cassandra/backend/dev.env | cut -d= -f2")`
      : 'set AGENT_WORKER_SECRET in backend/dev.env';
    console.log(`\n  ${y('no worker secret available')} — the auth and worker checks cannot run.`);
    console.log(`  ${dim(hint)}\n`);
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${WORKER_SECRET}` };
  check('worker route accepts the real secret', (await status(`${API}/agent-worker/claim`, { method: 'POST', headers: auth })) !== 401);

  // ── 3. schema the delivery path depends on ────────────────────────────────
  const c = db();
  let jobId = null;
  let chatId = null;
  let messageId = null;

  try {
    await c.connect();

    const cols = await c.query(
      'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
      ['agent_jobs'],
    );
    const names = cols.rows.map((x) => x.column_name);
    check('agent_jobs table exists', names.length > 0, `${names.length} columns`);
    // Without chat_id a finished job has nowhere to send its answer, which is the
    // failure mode this whole test exists to catch.
    check('agent_jobs.chat_id present', names.includes('chat_id'));
    check('agent_jobs.verified_at present', names.includes('verified_at'));

    // ── 4. enqueue against a real hotel + chat ──────────────────────────────
    const acct = (await c.query("SELECT id FROM accounts WHERE role = 'admin' ORDER BY id LIMIT 1")).rows[0];
    const chat = (await c.query('SELECT id FROM chats ORDER BY id DESC LIMIT 1')).rows[0];
    const hotel = (await c.query('SELECT id FROM hotels ORDER BY id LIMIT 1')).rows[0];
    if (!acct || !chat || !hotel) {
      console.log(`\n  ${r('need at least one admin account, chat and hotel in the database')}\n`);
      process.exit(1);
    }
    chatId = chat.id;

    const before = Number((await c.query('SELECT count(*) FROM messages WHERE chat_id = $1', [chatId])).rows[0].count);

    const inserted = await c.query(
      `INSERT INTO agent_jobs (hotel_id, requested_by_account_id, chat_id, action, params, status,
                               screenshot_keys, attempt_count, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'queued','[]',0,NOW(),NOW()) RETURNING id`,
      [hotel.id, acct.id, chatId, 'pms_lookup_reservation', JSON.stringify({ confirmationNumber: 'SMOKE-TEST' })],
    );
    jobId = inserted.rows[0].id;
    check('job enqueued', !!jobId, `job ${jobId} on chat ${chatId}`);

    if (SKIP_WORKER) {
      skip('worker picks up and runs the browser', '--no-worker');
      skip('result verified by an independent second read', '--no-worker');
      skip('answer delivered into the chat', '--no-worker');
    } else {
      // ── 5. the slow part: a real browser run ──────────────────────────────
      process.stdout.write(`  ${dim('waiting for the worker (browser runs take 20-120s)...')}`);
      const deadline = Date.now() + WORKER_TIMEOUT_MS;
      let job = null;
      while (Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, 5000));
        job = (await c.query('SELECT status, verified_at, cost_usd, duration_ms, error FROM agent_jobs WHERE id = $1', [jobId])).rows[0];
        if (job && (job.status === 'succeeded' || job.status === 'failed')) break;
        process.stdout.write('.');
      }
      console.log('');

      const finished = job && (job.status === 'succeeded' || job.status === 'failed');
      if (!finished) {
        check('worker picks up and runs the browser', false, 'job never left queued/running — is samantha-agent-worker up?');
        skip('result verified by an independent second read', 'worker never ran');
        skip('answer delivered into the chat', 'worker never ran');
      } else {
        check('worker picks up and runs the browser', true, `${job.status} in ${(job.duration_ms / 1000).toFixed(1)}s`);
        // Cost silently reporting zero is a real bug we have already shipped once.
        check('cost was recorded', Number(job.cost_usd) > 0, `$${Number(job.cost_usd).toFixed(4)}`);

        if (job.status === 'succeeded') {
          check('result verified by an independent second read', !!job.verified_at);
        } else {
          skip('result verified by an independent second read', `job failed: ${String(job.error).slice(0, 60)}`);
        }

        // ── 6. the whole point: did the guest get told ──────────────────────
        const after = await c.query(
          'SELECT id, role, content FROM messages WHERE chat_id = $1 ORDER BY id DESC LIMIT 1',
          [chatId],
        );
        const count = Number((await c.query('SELECT count(*) FROM messages WHERE chat_id = $1', [chatId])).rows[0].count);
        const delivered = count > before && after.rows[0]?.role === 'assistant';
        check('answer delivered into the chat', delivered, delivered ? `"${after.rows[0].content.slice(0, 60)}..."` : 'no new assistant message');
        if (delivered) messageId = after.rows[0].id;

        // An unconfirmed result must never state the answer as fact.
        if (delivered && job.status === 'succeeded' && !job.verified_at) {
          check(
            'unconfirmed result withholds the answer',
            /could not confirm/i.test(after.rows[0].content),
            'message should say it could not be confirmed',
          );
        }
      }
    }
  } finally {
    // Always clean up, including after a failure — a half-finished run must not
    // leave rows behind that make the next run confusing.
    try {
      if (messageId) await c.query('DELETE FROM messages WHERE id = $1', [messageId]);
      if (jobId) await c.query('DELETE FROM agent_jobs WHERE id = $1', [jobId]);
      console.log(dim(`\n  cleaned up${jobId ? ` job ${jobId}` : ''}${messageId ? `, message ${messageId}` : ''}`));
    } catch (e) {
      console.log(r(`  cleanup failed: ${e.message}`));
    }
    await c.end().catch(() => {});
  }

  console.log(`\n  ${passed} passed  ${failed ? r(`${failed} failed`) : '0 failed'}  ${skipped ? y(`${skipped} skipped`) : '0 skipped'}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`\n  ${r('smoke test crashed')}: ${e.message}\n`);
  process.exit(1);
});
