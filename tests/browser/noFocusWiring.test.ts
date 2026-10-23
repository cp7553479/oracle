import { beforeEach, describe, expect, test, vi } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BrowserAutomationError } from "../../src/oracle/errors.js";

// Drives the real runBrowserMode through launch, tab creation and focus emulation up to the
// provider submission. CDP and Chrome are faked at their package boundaries; page actions that
// only read or drive ChatGPT's DOM are stubbed so the run reaches the send.
//
// The fork's resolveBrowserConfig forces manual login onto the persistent default profile and
// discards remote-chrome routing, so every test isolates that profile by stubbing HOME and only
// local variants exist; upstream's remote rows would reroute to the same local path.
const created: Array<Record<string, unknown>> = [];
const submissions: Array<Record<string, unknown>> = [];
const activations: string[] = [];
let emulationFails = false;
const SUBMIT_REACHED = new Error("stop after capturing the submission state");

function domain(overrides: Record<string, unknown> = {}) {
  return new Proxy(overrides, {
    // Not thenable: an awaited client must resolve to itself.
    get: (target, key) =>
      key in target
        ? target[key as string]
        : key === "then" || typeof key === "symbol"
          ? undefined
          : vi.fn(async () => ({})),
  });
}

function client(overrides: Record<string, unknown>) {
  // Capitalized keys are CDP domains; anything else is a method on the client.
  const domains = new Map<string, unknown>();
  return new Proxy(overrides, {
    get: (target, key) => {
      if (key in target) return target[key as string];
      if (key === "then" || typeof key === "symbol") return undefined;
      if (/^[A-Z]/.test(key)) {
        if (!domains.has(key)) domains.set(key, domain());
        return domains.get(key);
      }
      return vi.fn(async () => ({}));
    },
  });
}

function pageClient() {
  return client({
    Runtime: domain({
      // A fresh conversation: the baseline read of user message ids finds none.
      evaluate: vi.fn(async (params: { expression?: string }) => ({
        result: {
          value: String(params?.expression).startsWith("Array.from(document.querySelectorAll(")
            ? []
            : undefined,
        },
      })),
    }),
    Emulation: domain({
      setFocusEmulationEnabled: vi.fn(async () => {
        if (emulationFails) throw new Error("Emulation.setFocusEmulationEnabled wasn't found");
        return {};
      }),
    }),
    Page: domain({
      bringToFront: vi.fn(async () => {
        activations.push("bringToFront");
        return {};
      }),
    }),
    Target: domain({
      getTargetInfo: vi.fn(async () => ({
        targetInfo: { targetId: "run-tab", url: "about:blank" },
      })),
    }),
    on: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    close: vi.fn(async () => {}),
  });
}

const cdp = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, { New: vi.fn(), Version: vi.fn(), List: vi.fn(), Close: vi.fn() });
});
vi.mock("chrome-remote-interface", () => ({ default: cdp }));
const onscreen = vi.hoisted(() => vi.fn(async (..._args: unknown[]) => undefined));
// Fake the whole Chrome launch. A manual-login launch on Windows goes through
// chrome-launcher's Launcher class rather than launch(), so faking only launch()
// let a real Chrome start there and hold the temp profile's lockfile.
const launchChrome = vi.hoisted(() =>
  vi.fn(async (..._args: unknown[]) => ({
    pid: 4242,
    port: 9555,
    kill: vi.fn(async () => {}),
    process: { unref: vi.fn() },
  })),
);
vi.mock("../../src/browser/chromeLifecycle.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/browser/chromeLifecycle.js")>()),
  launchChrome,
  // Window placement is not under test; record when a run moves its window on-screen.
  positionChromeWindowOnscreen: onscreen,
  positionChromeWindowOffscreen: vi.fn(async () => undefined),
}));
vi.mock("../../src/browser/pageActions.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../src/browser/pageActions.js")>();
  const stubbed: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(original)) {
    stubbed[name] = typeof value === "function" ? vi.fn(async () => undefined) : value;
  }
  // Returns its cleanup synchronously.
  stubbed.installJavaScriptDialogAutoDismissal = vi.fn(() => () => {});
  return stubbed;
});
vi.mock("../../src/browser/targetClaim.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/browser/targetClaim.js")>()),
  claimBrowserTarget: vi.fn(async () => undefined),
}));
vi.mock("../../src/browser/actions/thinkingTime.js", () => ({
  ensureThinkingTime: vi.fn(async () => undefined),
}));
vi.mock("../../src/browser/providerDomFlow.js", () => ({
  runProviderSubmissionFlow: vi.fn(
    async (_provider: unknown, input: { state: Record<string, unknown> }) => {
      submissions.push(input.state);
      throw SUBMIT_REACHED;
    },
  ),
}));

// Isolated HOME so the forced persistent manual-login profile lives in a temp
// directory, initialized so runs skip the first-time-setup gate.
async function isolatedHome(): Promise<string> {
  const home = await mkdtemp(path.join(os.tmpdir(), "oracle-no-focus-home-"));
  vi.stubEnv("HOME", home);
  await mkdir(path.join(home, ".oracle", "browser-profile", "Default"), { recursive: true });
  return home;
}

describe("runBrowserMode no-focus wiring", () => {
  beforeEach(async () => {
    // The blanket pageActions stub resolves undefined; model selection expects
    // either evidence or a rejection (which the fork falls back from silently).
    const pageActions = await import("../../src/browser/pageActions.js");
    vi.mocked(pageActions.ensureModelSelection).mockResolvedValue({ status: "selected" } as never);
    created.length = 0;
    submissions.length = 0;
    activations.length = 0;
    emulationFails = false;
    onscreen.mockClear();
    launchChrome.mockClear();
    cdp.mockReset();
    cdp.New.mockReset();
    cdp.Version.mockReset();
    cdp.New.mockResolvedValue({ id: "foreground-tab" });
    cdp.Version.mockResolvedValue({
      webSocketDebuggerUrl: "ws://127.0.0.1:9555/devtools/browser/fixture",
    });
    cdp.mockImplementation(async (options: { target?: string }) => {
      if (typeof options?.target === "string" && options.target.startsWith("ws://")) {
        return client({
          Target: domain({
            createTarget: vi.fn(async (params: Record<string, unknown>) => {
              created.push(params);
              return { targetId: "run-tab" };
            }),
          }),
          close: vi.fn(async () => {}),
        });
      }
      return pageClient();
    });
  });

  test.each([true, false])(
    "a run with noFocus=%s wires tab creation and the send",
    async (noFocus) => {
      const home = await isolatedHome();
      try {
        const { runBrowserMode } = await import("../../src/browser/index.js");
        await expect(
          runBrowserMode({
            prompt: "wiring proof",
            config: { noFocus, keepBrowser: true, reuseChromeWaitMs: 0 },
            log: vi.fn<(message: string) => void>(),
          }),
        ).rejects.toBe(SUBMIT_REACHED);
        if (noFocus) {
          // Background run tab through the browser endpoint, never /json/new, and no activation at the
          // send because focus emulation was enabled.
          expect(created).toEqual([{ url: "about:blank", background: true, newWindow: true }]);
          expect(cdp.New).not.toHaveBeenCalled();
        } else {
          expect(created).toEqual([]);
          expect(cdp.New).toHaveBeenCalledOnce();
        }
        expect(submissions).toHaveLength(1);
        expect(submissions[0]?.activateBeforeTrustedInput).toBe(!noFocus);
      } finally {
        vi.unstubAllEnvs();
        await rm(home, { recursive: true, force: true });
      }
    },
    15_000,
  );

  test.each([true, false])(
    "brings Chrome forward once for a Cloudflare check only when noFocus=%s",
    async (noFocus) => {
      const pageActions = await import("../../src/browser/pageActions.js");
      vi.mocked(pageActions.ensureNotBlocked).mockRejectedValueOnce(
        new BrowserAutomationError("Cloudflare challenge detected", {
          stage: "cloudflare-challenge",
        }),
      );
      const home = await isolatedHome();
      const log = vi.fn<(message: string) => void>();
      try {
        const { runBrowserMode } = await import("../../src/browser/index.js");
        await expect(
          runBrowserMode({
            prompt: "challenge",
            config: { noFocus, keepBrowser: true, reuseChromeWaitMs: 0 },
            log,
          }),
        ).rejects.toMatchObject({ details: { stage: "cloudflare-challenge" } });
      } finally {
        vi.unstubAllEnvs();
        await rm(home, { recursive: true, force: true });
      }
      expect(activations).toEqual(noFocus ? ["bringToFront"] : []);
      expect(log.mock.calls.some(([m]) => m.includes("no-focus fallback: bringing Chrome"))).toBe(
        noFocus,
      );
    },
    15_000,
  );

  test.each([true, false])(
    "brings Chrome forward once for manual sign-in only when noFocus=%s",
    async (noFocus) => {
      const pageActions = await import("../../src/browser/pageActions.js");
      // Signed out on the first check, signed in on the next one.
      vi.mocked(pageActions.ensureLoggedIn)
        .mockRejectedValueOnce(new Error("Login button detected"))
        .mockResolvedValue(undefined);
      const home = await isolatedHome();
      const log = vi.fn<(message: string) => void>();
      try {
        const { runBrowserMode } = await import("../../src/browser/index.js");
        await expect(
          runBrowserMode({
            prompt: "sign in",
            config: { noFocus, keepBrowser: true, reuseChromeWaitMs: 0 },
            log,
          }),
        ).rejects.toBe(SUBMIT_REACHED);
      } finally {
        vi.unstubAllEnvs();
        await rm(home, { recursive: true, force: true });
      }
      // The manual-login launch went through the fake, on every platform.
      expect(launchChrome).toHaveBeenCalledOnce();
      expect(log.mock.calls.some(([m]) => m.includes("Manual login required"))).toBe(true);
      expect(activations).toEqual(noFocus ? ["bringToFront"] : []);
    },
    15_000,
  );

  // Recorded from chrome-remote-interface against a closed port.
  const refused = () =>
    Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:9555"), { code: "ECONNREFUSED" });
  // connectToChrome attaches to Chrome's default page with { port, host } and no target.
  const defaultPageConnects = () =>
    cdp.mock.calls.filter(([options]) => !(options as { target?: string })?.target);

  test.each([
    { noFocus: true, failure: "creation" },
    { noFocus: true, failure: "attach" },
    { noFocus: false, failure: "creation" },
  ])(
    "a failed run-tab open with noFocus=$noFocus ($failure) never reaches a default page that a windowless launch lacks",
    async ({ noFocus, failure }) => {
      const home = await isolatedHome();
      try {
        cdp.New.mockRejectedValue(refused());
        if (failure === "creation") cdp.Version.mockRejectedValue(refused());
        const pageConnect = cdp.getMockImplementation();
        cdp.mockImplementation(async (options: { target?: string }) => {
          if (failure === "attach" && options?.target === "run-tab") throw refused();
          return pageConnect?.(options);
        });
        const { runBrowserMode } = await import("../../src/browser/index.js");
        const run = runBrowserMode({
          prompt: "fallback",
          config: { noFocus, keepBrowser: true, reuseChromeWaitMs: 0 },
          log: vi.fn<(message: string) => void>(),
        });
        if (noFocus) {
          // No startup page exists, so the run fails on the isolated tab instead.
          await expect(run).rejects.toThrow(/refusing to attach to default target/);
          expect(defaultPageConnects()).toEqual([]);
        } else {
          // Flag off keeps the old fallback to Chrome's default page.
          await expect(run).rejects.toBe(SUBMIT_REACHED);
          expect(defaultPageConnects()).toHaveLength(1);
        }
      } finally {
        vi.unstubAllEnvs();
        await rm(home, { recursive: true, force: true });
      }
    },
    15_000,
  );

  test.each([true, false])(
    "without focus emulation a run with noFocus=%s activates before its first clicks",
    async (noFocus) => {
      emulationFails = true;
      const home = await isolatedHome();
      // Chat-mode setup clicks with trusted input before the send; record it in the same order.
      const pageActions = await import("../../src/browser/pageActions.js");
      vi.mocked(pageActions.ensureChatMode).mockImplementation(async () => {
        activations.push("trustedClick");
        return undefined as never;
      });
      const log = vi.fn<(message: string) => void>();
      try {
        const { runBrowserMode } = await import("../../src/browser/index.js");
        await expect(
          runBrowserMode({
            prompt: "no emulation",
            config: { noFocus, keepBrowser: true, reuseChromeWaitMs: 0 },
            log,
          }),
        ).rejects.toBe(SUBMIT_REACHED);
      } finally {
        vi.unstubAllEnvs();
        await rm(home, { recursive: true, force: true });
      }
      const fallbackLines = log.mock.calls.filter(([m]) =>
        m.includes("Focus emulation is unavailable; no-focus fallback"),
      );
      vi.mocked(pageActions.ensureChatMode).mockReset();
      // The activation has to come before the first trusted click, not just before the send,
      // which still activates as before.
      expect(activations).toEqual(noFocus ? ["bringToFront", "trustedClick"] : ["trustedClick"]);
      expect(fallbackLines).toHaveLength(noFocus ? 1 : 0);
      expect(submissions[0]?.activateBeforeTrustedInput).toBe(true);
    },
    15_000,
  );

  test.each([true, false])(
    "moves a hidden window on-screen for a local Cloudflare check only when noFocus=%s",
    async (noFocus) => {
      const pageActions = await import("../../src/browser/pageActions.js");
      vi.mocked(pageActions.ensureNotBlocked).mockRejectedValueOnce(
        new BrowserAutomationError("Cloudflare challenge detected", {
          stage: "cloudflare-challenge",
        }),
      );
      const home = await isolatedHome();
      const log = vi.fn<(message: string) => void>();
      try {
        const { runBrowserMode } = await import("../../src/browser/index.js");
        await expect(
          runBrowserMode({
            prompt: "hidden challenge",
            config: { noFocus, hideWindow: true, keepBrowser: true, reuseChromeWaitMs: 0 },
            log,
          }),
        ).rejects.toMatchObject({ details: { stage: "cloudflare-challenge" } });
      } finally {
        vi.unstubAllEnvs();
        await rm(home, { recursive: true, force: true });
      }
      // Hide-window setup keeps the window off-screen; only the challenge brings it back.
      expect(onscreen).toHaveBeenCalledTimes(noFocus ? 1 : 0);
      expect(activations).toEqual(noFocus ? ["bringToFront"] : []);
    },
    15_000,
  );
});
