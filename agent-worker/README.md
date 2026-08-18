# Agent worker

Drives a real browser through a hotel's PMS to satisfy jobs queued by Samantha.

Separate process, and separate language, for one reason: browser tasks measured
**20–120s**, while a voice turn has well under a second. The work cannot happen
inside a conversation, so the agent enqueues a job and reads the result later.

## Why results carry a `verified` flag

The browser agent's own success signal is not trustworthy in either direction.
In testing:

- its built-in judge marked a **correct** answer as failed
- after submitting a form it could not read back the value it had just written,
  and honestly reported that it could not confirm

So the worker performs a **second, independent read** and only sets `verified`
when the two agree. `get_pms_action_status` surfaces this as `reportable`, and
the tool description instructs the agent never to claim success without it.

Better to tell a guest "I couldn't confirm that" than to tell them a room was
changed when it wasn't.

## Setup

Needs Python 3.11+ (browser-use requirement) and a local Chrome.

```bash
cd agent-worker
python3.14 -m venv venv
./venv/bin/pip install -r requirements.txt
```

## Run

```bash
export AGENT_API_URL=http://localhost:7676
export AGENT_WORKER_SECRET=...        # must match AGENT_WORKER_SECRET in backend/dev.env
export OPENAI_API_KEY=...
export PMS_BASE_URL=...               # the PMS to drive

./venv/bin/python worker.py           # poll forever
./venv/bin/python worker.py --once    # take a single job and exit
AGENT_HEADLESS=false ./venv/bin/python worker.py   # watch it, with element highlights
```

## Smoke test

One command tells you whether the pipeline is actually alive, rather than merely
deployed — the difference is the worker, and nothing else catches it:

```bash
node agent-worker/smoke-test.js                 # local
node agent-worker/smoke-test.js --stage         # stage
node agent-worker/smoke-test.js --no-worker     # skip the slow browser leg (~10s)
```

It walks the whole path a guest request travels: auth boundaries → enqueue →
worker claims → browser runs → second independent read verifies → answer lands
in the chat. Everything it creates it deletes, including after a failure.

Stage uses its own worker secret, so pass it explicitly:

```bash
export AGENT_WORKER_SECRET=$(ssh -i fp-one fp-one@13.204.144.181 \
  "grep '^AGENT_WORKER_SECRET=' ~/cassandra/backend/dev.env | cut -d= -f2")
```

A missing worker shows up as a clear failure on "worker picks up and runs the
browser" rather than a silent pass.

## Running on the stage server

The worker runs under PM2 as `samantha-agent-worker`, separate from the API so a
browser crash cannot take the backend down with it.

```bash
pm2 logs samantha-agent-worker      # what it is doing
pm2 restart samantha-agent-worker   # after changing worker.env
```

Note: that box has no `pip` or `python3-venv` and no passwordless sudo, so pip
was bootstrapped into `~/.local` and dependencies installed to
`agent-worker/libs/` via `pip install --target`. `run-worker.sh` sets `PYTHONPATH`
accordingly. This setup is **not** reproduced by the deploy workflow — a rebuilt
box needs it done again.

## Adding an action

Two places, kept in lockstep:

1. `AgentJobAction` in `backend/src/agent-jobs/agent-jobs.model.ts` — the enum the
   tool schema validates against
2. `build_task()` in `worker.py` — returns the task prompt **and** the independent
   verification prompt

Keep each action pinned to a specific URL and a single outcome. A spike showed an
open-ended instruction took 118s over 8 steps where the same goal scoped to one
URL took 15s over 2 — specificity is the main latency and cost lever available.

Return `None` for the verify prompt only when a genuine independent check is
impossible; the job will then always come back unverified, which is the safe
default rather than a silent pass.

## Current state

Read-only actions only. Writes need, at minimum: an allowlist of permitted
mutations, post-write read-back, screenshot capture into the audit trail, and an
answer for PMS multi-factor auth — which is the most likely blocker for the whole
approach and worth testing before building further.
