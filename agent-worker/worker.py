"""
Browser-agent worker for Samantha.

Pulls queued jobs from the NestJS backend, drives a real browser through the
hotel's PMS to satisfy each one, then posts the result back.

Why this is a separate process rather than a tool the agent calls inline:
measured browser tasks took 20-120s. Conversational latency budget is under a
second, so the work cannot happen inside a turn. The agent enqueues, tells the
guest it is working on it, and reads the result later.

Verification is the point of the `verified` flag. Testing showed the browser
agent's own success signal is not trustworthy in either direction -- its built-in
judge failed a correct answer, and on a form submit it could not read back what
it had just written. So a job is only reportable to a guest when a second,
independent navigation confirmed the value. Anything else comes back unverified
and the agent is instructed not to claim success.

  AGENT_API_URL        backend base url            (default http://localhost:7676)
  AGENT_WORKER_SECRET  shared secret for /agent-worker routes   (required)
  OPENAI_API_KEY       model key for browser-use               (required)
  AGENT_POLL_SECONDS   idle poll interval                      (default 5)
  AGENT_HEADLESS       "false" to watch the browser            (default true)
  PMS_BASE_URL         PMS root url
  PMS_RESERVATIONS_URL page listing reservations   (default PMS_BASE_URL)
  PMS_AUTH_TOKEN       session token for localStorage, if the PMS uses one
  PMS_AUTH_STORAGE_KEY localStorage key for it                 (default "token")
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import sys
import tempfile
import time
from typing import Any

import httpx

from browser_use import Agent, BrowserProfile, ChatOpenAI

API_URL = os.environ.get("AGENT_API_URL", "http://localhost:7676").rstrip("/")
WORKER_SECRET = os.environ.get("AGENT_WORKER_SECRET", "")
OPENAI_KEY = os.environ.get("OPENAI_API_KEY", "")
POLL_SECONDS = float(os.environ.get("AGENT_POLL_SECONDS", "5"))
HEADLESS = os.environ.get("AGENT_HEADLESS", "true").lower() != "false"
MODEL = os.environ.get("AGENT_MODEL", "gpt-4.1-mini")

# gpt-4.1-mini list price, USD per 1M tokens
IN_PER_M, OUT_PER_M = 0.40, 1.60


# ── Action handlers ───────────────────────────────────────────────────────────
# Each action owns its own navigation and is scoped as tightly as possible. A
# spike showed an open-ended instruction took 118s over 8 steps where the same
# goal pinned to one URL took 15s over 2 -- so specificity is the main cost and
# latency lever we have.
#
# `pms_base_url` is per-hotel config; until credential storage lands these read
# from env so the worker can be exercised end to end.
PMS_BASE_URL = os.environ.get("PMS_BASE_URL", "")
# Page that lists reservations. Pinning the agent straight at it is the single
# biggest latency lever we have (see the note above), so prefer setting this.
PMS_RESERVATIONS_URL = os.environ.get("PMS_RESERVATIONS_URL", "") or PMS_BASE_URL
# Some PMS UIs -- including our own portal -- authenticate with a token in
# localStorage rather than a login form. Where that is true we hand the browser
# a ready session instead of teaching the agent to log in: OTP-based sign-in
# needs a mailbox, which a headless worker does not have.
PMS_AUTH_TOKEN = os.environ.get("PMS_AUTH_TOKEN", "")
PMS_AUTH_STORAGE_KEY = os.environ.get("PMS_AUTH_STORAGE_KEY", "token")


def _origin(url: str) -> str:
    parts = url.split("/")
    return f"{parts[0]}//{parts[2]}" if len(parts) > 2 else url


def storage_state(token: str = "") -> dict[str, Any] | None:
    """Pre-seed the browser with an authenticated session, Playwright-style.

    The token normally arrives on the claimed job: the backend mints one per
    claim, scoped to the account that asked for the work and expiring with the
    job's stale window. PMS_AUTH_TOKEN is the standing fallback for a PMS we
    hold a fixed credential for.
    """
    token = token or PMS_AUTH_TOKEN
    if not (token and PMS_BASE_URL):
        return None
    return {
        "cookies": [],
        "origins": [
            {
                "origin": _origin(PMS_BASE_URL),
                "localStorage": [{"name": PMS_AUTH_STORAGE_KEY, "value": token}],
            }
        ],
    }


@contextlib.contextmanager
def storage_state_file(token: str = ""):
    """Yield a path to the storage state, or None when there is no session.

    browser-use only reads storage_state from a file. Handing it the dict it
    also accepts does nothing at all: the watchdog does str() on the value and
    treats the result as a path, which never exists, so the session is dropped
    without a word. That silence cost a debugging cycle -- the agent simply got
    a 404 from our SPA and reported the page was broken.
    """
    state = storage_state(token)
    if state is None:
        yield None
        return

    handle = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    try:
        json.dump(state, handle)
        handle.close()
        yield handle.name
    finally:
        # It holds a live credential, so it does not outlive the run.
        os.unlink(handle.name)


# Phrases that mean the agent never reached the data, as opposed to reaching it
# and finding nothing. "No such reservation" is a real answer; "I could not open
# the page" is not, and must never be dressed up as one.
_NO_READ_MARKERS = (
    "could not access",
    "couldn't access",
    "unable to access",
    "could not load",
    "failed to load",
    "stuck",
    "404",
    "not found error",
    "page did not load",
    "no data was visible",
    "please let me know",
)


def reads_as_failure(text: str) -> bool:
    """True when the answer is really a report that the read did not happen."""
    lowered = text.lower()
    return any(marker in lowered for marker in _NO_READ_MARKERS)


def signed_in_note(token: str = "") -> str:
    """Only claim a session when we actually injected one. Saying it otherwise
    sends the agent hunting for a login form it should be filling in instead."""
    return " You are already signed in; do not try to log in." if (token or PMS_AUTH_TOKEN) else ""


def build_task(action: str, params: dict[str, Any], token: str = "") -> tuple[str, str | None]:
    """Return (task_prompt, verify_prompt). verify_prompt is a second, independent
    read used to confirm the first answer; None means no verification is possible
    for this action, which forces the job to come back unverified."""

    note = signed_in_note(token)

    if action == "pms_lookup_reservation":
        ref = params.get("confirmationNumber", "")
        task = (
            f"Go to {PMS_RESERVATIONS_URL} .{note} "
            f"Find the reservation with confirmation number '{ref}', using the page's search or filter if there is one. "
            "Report the guest name, room number, arrival date and departure date. "
            "If no such reservation exists, say exactly that. "
            "Do not click anything that changes data."
        )
        verify = (
            f"Go to {PMS_RESERVATIONS_URL} .{note} "
            f"Look up confirmation number '{ref}' again from a fresh page load. "
            "Report only the guest name and room number, or that it does not exist."
        )
        return task, verify

    if action == "pms_list_arrivals":
        date = params.get("date", "")
        task = (
            f"Go to {PMS_RESERVATIONS_URL} .{note} "
            f"Find the reservations arriving on {date}. "
            "Report the number of arrivals and the guest names. Read only."
        )
        # A list read is idempotent, so re-reading it is a genuine check.
        verify = (
            f"Go to {PMS_RESERVATIONS_URL} .{note} "
            f"Count the reservations arriving on {date} again and report only the count."
        )
        return task, verify

    raise ValueError(f"worker does not implement action '{action}'")


# ── Browser run ───────────────────────────────────────────────────────────────
async def run_agent(prompt: str, max_steps: int = 12, token: str = "") -> tuple[str, float, int]:
    """Run one browser task. Returns (result_text, cost_usd, steps)."""
    with storage_state_file(token) as state_path:
        profile = BrowserProfile(
            headless=HEADLESS,
            highlight_elements=not HEADLESS,
            storage_state=state_path,
        )
        agent = Agent(task=prompt, llm=ChatOpenAI(model=MODEL, api_key=OPENAI_KEY), browser_profile=profile)

        history = await agent.run(max_steps=max_steps)

    text = (history.final_result() or "").strip()
    steps = len(history.history)

    # Usage lives on the run history; `agent.token_cost_service` does not exist on
    # this version, and reading only that silently reported every job as free.
    cost = 0.0
    usage = getattr(history, "usage", None)
    if usage is None:
        usage = getattr(getattr(agent, "token_cost_service", None), "usage", None)
    if usage is not None:
        tin = getattr(usage, "total_prompt_tokens", 0) or 0
        tout = getattr(usage, "total_completion_tokens", 0) or 0
        cost = tin / 1e6 * IN_PER_M + tout / 1e6 * OUT_PER_M

    return text, cost, steps


def confirms(primary: str, check: str) -> bool:
    """Cheap agreement test between the primary answer and the verification read.

    Deliberately conservative: we would rather mark a correct job unverified than
    tell a guest something that was never confirmed. Only compares the distinctive
    tokens (numbers, long words) both reads should contain.
    """
    if not primary or not check:
        return False

    def salient(text: str) -> set[str]:
        out = set()
        for raw in text.replace(",", " ").replace(".", " ").split():
            tok = raw.strip("()[]'\"“”:;").lower()
            if len(tok) >= 4 or any(c.isdigit() for c in tok):
                out.add(tok)
        return out

    a, b = salient(primary), salient(check)
    if not b:
        return False
    overlap = len(a & b) / len(b)
    return overlap >= 0.5


# ── Backend IO ────────────────────────────────────────────────────────────────
def auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {WORKER_SECRET}"}


async def claim(client: httpx.AsyncClient) -> dict[str, Any] | None:
    r = await client.post(f"{API_URL}/agent-worker/claim", headers=auth(), timeout=30)
    r.raise_for_status()
    return (r.json() or {}).get("data")


async def complete(client: httpx.AsyncClient, job_id: int, payload: dict[str, Any]) -> None:
    r = await client.post(f"{API_URL}/agent-worker/{job_id}/complete", headers=auth(), json=payload, timeout=30)
    if r.status_code >= 400:
        print(f"  ! complete failed {r.status_code}: {r.text[:200]}", flush=True)
        r.raise_for_status()


async def handle(client: httpx.AsyncClient, job: dict[str, Any]) -> None:
    job_id = job["id"]
    action = job["action"]
    params = job.get("params") or {}
    # Minted by the backend for this claim and scoped to the account that asked
    # for the work. Absent for a PMS we log into with a form instead.
    token = job.get("sessionToken") or ""
    print(f"  job {job_id}: {action} {params}{' [session]' if token else ''}", flush=True)

    started = time.time()
    try:
        task_prompt, verify_prompt = build_task(action, params, token)
    except ValueError as exc:
        await complete(client, job_id, {"success": False, "error": str(exc)})
        print(f"  job {job_id}: rejected — {exc}", flush=True)
        return

    try:
        primary, cost, steps = await run_agent(task_prompt, token=token)

        # A read that never happened is a failed job, not a successful one with an
        # apology in it. Skipping this let a job come back "succeeded (verified)"
        # carrying "I could not open the page" -- the second read had failed the
        # same way, and two identical failures agree with each other perfectly.
        if reads_as_failure(primary):
            await complete(
                client,
                job_id,
                {
                    "success": False,
                    "error": f"could not read the PMS: {primary[:400]}",
                    "durationMs": int((time.time() - started) * 1000),
                    "costUsd": round(cost, 6),
                },
            )
            print(f"  job {job_id}: failed — never reached the data", flush=True)
            return

        verified = False
        if verify_prompt:
            check, vcost, _ = await run_agent(verify_prompt, max_steps=8, token=token)
            cost += vcost
            # The check failing to read is not agreement either.
            verified = not reads_as_failure(check) and confirms(primary, check)

        await complete(
            client,
            job_id,
            {
                "success": True,
                "result": {"answer": primary, "steps": steps},
                "verified": verified,
                "durationMs": int((time.time() - started) * 1000),
                "costUsd": round(cost, 6),
            },
        )
        flag = "verified" if verified else "UNVERIFIED"
        print(f"  job {job_id}: done ({flag}) {time.time() - started:.1f}s ${cost:.4f}", flush=True)

    except Exception as exc:  # noqa: BLE001 - any browser failure must still close the job
        await complete(
            client,
            job_id,
            {
                "success": False,
                "error": f"{type(exc).__name__}: {exc}"[:1000],
                "durationMs": int((time.time() - started) * 1000),
            },
        )
        print(f"  job {job_id}: failed — {type(exc).__name__}: {exc}", flush=True)


async def main() -> int:
    if not WORKER_SECRET:
        print("AGENT_WORKER_SECRET is required", file=sys.stderr)
        return 1
    if not OPENAI_KEY:
        print("OPENAI_API_KEY is required", file=sys.stderr)
        return 1

    once = "--once" in sys.argv
    print(f"worker up — api={API_URL} headless={HEADLESS} model={MODEL}{' (single job)' if once else ''}", flush=True)

    async with httpx.AsyncClient() as client:
        while True:
            try:
                job = await claim(client)
            except Exception as exc:  # noqa: BLE001 - backend restart should not kill the worker
                print(f"  claim error: {type(exc).__name__}: {exc}", flush=True)
                job = None

            if job:
                await handle(client, job)
                if once:
                    return 0
            else:
                if once:
                    print("  no queued jobs", flush=True)
                    return 0
                await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
