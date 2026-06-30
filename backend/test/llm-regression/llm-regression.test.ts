/**
 * LLM regression suite — isolated (no DB), real model calls.
 *
 * Run: npm run test:llm
 * Requires dev.env with OPENROUTER credentials. Makes live model calls, so it is
 * kept out of the default `test:api` run and invoked explicitly.
 */
import { buildHarness, runTurn, judgeQuality, guestCtx, Harness } from './harness';
import { CASES } from './cases';

describe('LLM concierge regression', () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await buildHarness();
  });

  afterAll(async () => {
    if (harness) await harness.close();
  });

  test.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, testCase) => {
    const ctx = testCase.ctx ?? guestCtx();
    const result = await runTurn(harness.service, testCase.userMessage, ctx, testCase.history ?? []);
    const { toolCalled, toolArgs, mustInclude, mustExclude, judgeQuality: judge = true } = testCase.expect;

    const names = result.toolCalls.map((t) => t.toolName);

    // ── deterministic: tool selection ──
    if (toolCalled === null) {
      expect(names).toHaveLength(0);
    } else if (toolCalled !== undefined) {
      expect(names).toContain(toolCalled);
      if (toolArgs) {
        const call = result.toolCalls.find((t) => t.toolName === toolCalled);
        expect(call?.input).toEqual(expect.objectContaining(toolArgs));
      }
    }

    // ── deterministic: content substrings ──
    const lower = result.content.toLowerCase();
    for (const s of mustInclude ?? []) expect(lower).toContain(s.toLowerCase());
    for (const s of mustExclude ?? []) expect(lower).not.toContain(s.toLowerCase());

    // ── LLM judge: response quality ──
    if (judge) {
      const verdict = await judgeQuality(harness.service, testCase.userMessage, result);
      if (!verdict.passed) throw new Error(`judge failed response quality: ${verdict.reasoning}`);
    }
  });
});
