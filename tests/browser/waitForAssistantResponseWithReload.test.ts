import { describe, expect, test, vi } from "vitest";
import { BrowserAutomationError } from "../../src/oracle/errors.js";
import { __test__ } from "../../src/browser/index.js";
import type { AssistantAnswer } from "../../src/browser/index.js";

const { runIdleReloadLoop } = __test__;

const OK: AssistantAnswer = { text: "hello", html: "<p>hello</p>", meta: { turnId: "t1" } };
const WATCHDOG_ERROR = new Error("assistant-response watchdog timeout before completion");
const CONVERSATION_URL = "https://chatgpt.com/c/abc123";

interface DepsOverrides {
  waitOnce?: (sliceMs: number) => Promise<AssistantAnswer>;
  readConversationUrl?: () => Promise<string | null>;
  navigate?: (url: string) => Promise<unknown>;
  sleep?: (ms: number) => Promise<unknown>;
  readThinking?: () => Promise<{ active: boolean; strong: boolean }>;
  checkRateLimit?: () => Promise<void>;
  readProgressKey?: () => Promise<string | null>;
  timeoutMs?: number;
  idleReloadMs?: number;
  maxIdleReloads?: number;
}

function makeDeps(overrides: DepsOverrides = {}) {
  return {
    waitOnce:
      overrides.waitOnce ?? vi.fn<(sliceMs: number) => Promise<AssistantAnswer>>(async () => OK),
    readConversationUrl: overrides.readConversationUrl ?? vi.fn(async () => CONVERSATION_URL),
    navigate: overrides.navigate ?? vi.fn(async () => ({})),
    sleep: overrides.sleep ?? vi.fn(async () => undefined),
    readThinking: overrides.readThinking ?? vi.fn(async () => ({ active: false, strong: false })),
    readProgressKey: overrides.readProgressKey ?? vi.fn(async () => null),
    isConversationUrl: (url: string) => /chatgpt\.com\/c\//.test(url),
    shouldReload: (error: unknown) =>
      error instanceof Error && /watchdog|timeout|assistant-response/.test(error.message),
    formatElapsed: (ms: number) => `${Math.round(ms / 1000)}s`,
    timeoutMs: overrides.timeoutMs ?? 10 * 60_000,
    idleReloadMs: overrides.idleReloadMs ?? 60_000,
    maxIdleReloads: overrides.maxIdleReloads ?? 3,
    logger: vi.fn<(message: string) => void>(),
    checkRateLimit: overrides.checkRateLimit,
  };
}

describe("runIdleReloadLoop", () => {
  test("happy path: returns on the first window without reloading", async () => {
    const deps = makeDeps();
    const result = await runIdleReloadLoop(deps);
    expect(result).toEqual(OK);
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.logger).not.toHaveBeenCalled();
  });

  test("continues when the UI warning check is informational", async () => {
    const checkRateLimit = vi.fn().mockResolvedValue(undefined);
    const deps = makeDeps({ checkRateLimit });

    await expect(runIdleReloadLoop(deps)).resolves.toEqual(OK);
    expect(checkRateLimit).toHaveBeenCalledTimes(1);
  });

  test("propagates a non-rate-limit blocking UI warning", async () => {
    const warningError = new Error("authentication challenge");
    const deps = makeDeps({ checkRateLimit: vi.fn().mockRejectedValue(warningError) });

    await expect(runIdleReloadLoop(deps)).rejects.toBe(warningError);
    expect(deps.waitOnce).not.toHaveBeenCalled();
  });

  test("reloads once and succeeds on the second window", async () => {
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValueOnce(WATCHDOG_ERROR).mockResolvedValueOnce(OK),
    });
    const result = await runIdleReloadLoop(deps);
    expect(result).toEqual(OK);
    expect(deps.navigate).toHaveBeenCalledTimes(1);
    expect(deps.navigate).toHaveBeenCalledWith(CONVERSATION_URL);
    expect(deps.logger).toHaveBeenCalledWith(
      expect.stringMatching(/No assistant progress.*reloading conversation \(1\/3\)/),
    );
  });

  test("does not reload while thinking is active; extends the window instead", async () => {
    const deps = makeDeps({
      waitOnce: vi
        .fn()
        .mockRejectedValueOnce(WATCHDOG_ERROR) // first window stalls
        .mockResolvedValueOnce(OK), // extended window succeeds
      readThinking: vi.fn(async () => ({ active: true, strong: false })),
    });
    const result = await runIdleReloadLoop(deps);
    expect(result).toEqual(OK);
    // thinking was active → navigate must NOT have been called (reload deferred)
    expect(deps.navigate).not.toHaveBeenCalled();
    expect(deps.logger).toHaveBeenCalledWith(
      expect.stringMatching(/still thinking.*extending wait.*reload deferred/),
    );
  });

  test("throws BrowserAutomationError after exhausting maxIdleReloads", async () => {
    const deps = makeDeps({
      // every window stalls
      waitOnce: vi.fn().mockRejectedValue(WATCHDOG_ERROR),
    });
    await expect(runIdleReloadLoop(deps)).rejects.toMatchObject({
      constructor: BrowserAutomationError,
      message: expect.stringMatching(/exhausted 3 idle reloads/),
    });
    // maxIdleReloads = 3 → exactly 3 navigations before giving up
    expect(deps.navigate).toHaveBeenCalledTimes(3);
  });

  test("the exhausted error carries idleReloadsExhausted detail and the cause", async () => {
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValue(WATCHDOG_ERROR),
    });
    await expect(runIdleReloadLoop(deps)).rejects.toMatchObject({
      details: { stage: "assistant-timeout", idleReloadsExhausted: true },
      cause: WATCHDOG_ERROR,
    });
  });

  test("non-reloadable error is rethrown immediately without consuming a reload", async () => {
    const unrelated = new Error("cloudflare challenge detected");
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValueOnce(unrelated).mockResolvedValueOnce(OK),
    });
    await expect(runIdleReloadLoop(deps)).rejects.toBe(unrelated);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  test("rethrows original error when overall budget runs out before next reload", async () => {
    // tiny budget: after the first stall, less than 10s remains → not enough to reload
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValueOnce(WATCHDOG_ERROR),
      timeoutMs: 5_000,
      idleReloadMs: 60_000,
    });
    await expect(runIdleReloadLoop(deps)).rejects.toBe(WATCHDOG_ERROR);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  test("missing conversation URL rethrows the stall error instead of navigating", async () => {
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValueOnce(WATCHDOG_ERROR),
      readConversationUrl: vi.fn(async () => null),
    });
    await expect(runIdleReloadLoop(deps)).rejects.toBe(WATCHDOG_ERROR);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  test("a still-growing answer extends the window instead of reloading", async () => {
    const deps = makeDeps({
      // window 1 stalls while the answer grows; window 2 stalls with no growth
      // (→ reload); window 3 succeeds after the reload.
      waitOnce: vi
        .fn()
        .mockRejectedValueOnce(WATCHDOG_ERROR)
        .mockRejectedValueOnce(WATCHDOG_ERROR)
        .mockResolvedValueOnce(OK),
      readProgressKey: vi
        .fn()
        .mockResolvedValueOnce("turn-a::100") // window 1 start
        .mockResolvedValueOnce("turn-a::350") // window 1 end: content grew → extend
        .mockResolvedValueOnce("turn-a::350"), // window 2 end: unchanged → reload
    });
    const result = await runIdleReloadLoop(deps);
    expect(result).toEqual(OK);
    expect(deps.navigate).toHaveBeenCalledTimes(1);
    expect(deps.logger).toHaveBeenCalledWith(
      expect.stringMatching(/still growing.*extending wait.*reload deferred/),
    );
  });

  test("answer text appearing mid-window counts as progress", async () => {
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValueOnce(WATCHDOG_ERROR).mockResolvedValueOnce(OK),
      readProgressKey: vi
        .fn()
        .mockResolvedValueOnce(null) // window start: no assistant turn yet
        .mockResolvedValueOnce("turn-a::42"), // window end: partial answer appeared → extend
    });
    const result = await runIdleReloadLoop(deps);
    expect(result).toEqual(OK);
    expect(deps.navigate).not.toHaveBeenCalled();
  });

  test("unchanged answer content does not defer the reload", async () => {
    const deps = makeDeps({
      waitOnce: vi.fn().mockRejectedValueOnce(WATCHDOG_ERROR).mockResolvedValueOnce(OK),
      readProgressKey: vi.fn(async () => "turn-a::350"),
    });
    const result = await runIdleReloadLoop(deps);
    expect(result).toEqual(OK);
    expect(deps.navigate).toHaveBeenCalledTimes(1);
    expect(deps.logger).not.toHaveBeenCalledWith(
      expect.stringMatching(/still growing/),
    );
  });
});
