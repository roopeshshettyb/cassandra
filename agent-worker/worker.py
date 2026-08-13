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
"""

from __future__ import annotations

import asyncio
import os
import sys
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


def build_task(action: str, params: dict[str, Any]) -> tuple[str, str | None]:
    """Return (task_prompt, verify_prompt). verify_prompt is a second, independent
    read used to confirm the first answer; None means no verification is possible
    for this action, which forces the job to come back unverified."""

    if action == "pms_lookup_reservation":
        ref = params.get("confirmationNumber", "")
        task = (
            f"Go to {PMS_BASE_URL} . Find the reservation with confirmation number '{ref}'. "
            "Report the guest name, room number, arrival date and departure date. "
            "Do not click anything that changes data."
        )
        verify = (
            f"Go to {PMS_BASE_URL} . Look up confirmation number '{ref}' again from a fresh page load. "
            "Report only the guest name and room number."
        )
        return task, verify

    if action == "pms_list_arrivals":
        date = params.get("date", "")
        task = (
            f"Go to {PMS_BASE_URL} . Open the arrivals list for {date}. "
            "Report the number of arrivals and the guest names. Read only."
        )
        # A list read is idempotent, so re-reading it is a genuine check.
        verify = f"Go to {PMS_BASE_URL} . Open arrivals for {date} again and report only the count."
        return task, verify

    raise ValueError(f"worker does not implement action '{action}'")


# ── Browser run ───────────────────────────────────────────────────────────────
async def run_agent(prompt: str, max_steps: int = 12) -> tuple[str, float, int]:
    """Run one browser task. Returns (result_text, cost_usd, steps)."""
    profile = BrowserProfile(headless=HEADLESS, highlight_elements=not HEADLESS)
    agent = Agent(task=prompt, llm=ChatOpenAI(model=MODEL, api_key=OPENAI_KEY), browser_profile=profile)

    history = await agent.run(max_steps=max_steps)
    text = (history.final_result() or "").strip()
    steps = len(history.history)

    cost = 0.0
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
    print(f"  job {job_id}: {action} {params}", flush=True)

    started = time.time()
    try:
        task_prompt, verify_prompt = build_task(action, params)
    except ValueError as exc:
        await complete(client, job_id, {"success": False, "error": str(exc)})
        print(f"  job {job_id}: rejected — {exc}", flush=True)
        return

    try:
        primary, cost, steps = await run_agent(task_prompt)

        verified = False
        if verify_prompt:
            check, vcost, _ = await run_agent(verify_prompt, max_steps=8)
            cost += vcost
            verified = confirms(primary, check)

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
