import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

const {
  launchChrome,
  connectWithNewTab,
  connectToRemoteChrome,
  resolveAttachRunningConnection,
  closeTab,
  readDevToolsPort,
  writeDevToolsActivePort,
  writeChromePid,
  cleanupStaleProfileState,
  verifyDevToolsReachable,
  terminateRecordedChromeForProfile,
} = vi.hoisted(() => ({
  launchChrome: vi.fn(),
  connectWithNewTab: vi.fn(),
  connectToRemoteChrome: vi.fn(),
  resolveAttachRunningConnection: vi.fn(),
  closeTab: vi.fn(async () => undefined),
  readDevToolsPort: vi.fn(async () => null),
  writeDevToolsActivePort: vi.fn(async () => undefined),
  writeChromePid: vi.fn(async () => undefined),
  cleanupStaleProfileState: vi.fn(async () => undefined),
  verifyDevToolsReachable: vi.fn(async () => ({ ok: false, error: "unreachable" })),
  terminateRecordedChromeForProfile: vi.fn(async () => true),
}));

vi.mock("../../src/browser/chromeLifecycle.js", () => ({
  launchChrome,
  connectWithNewTab,
  connectToRemoteChrome,
  closeTab,
}));

vi.mock("../../src/browser/attachRunning.js", () => ({ resolveAttachRunningConnection }));

vi.mock("../../src/browser/profileState.js", () => ({
  readDevToolsPort,
  writeDevToolsActivePort,
  writeChromePid,
  cleanupStaleProfileState,
  verifyDevToolsReachable,
  terminateRecordedChromeForProfile,
}));

describe("openGeminiBrowserSession", () => {
  const originalProfileDir = process.env.ORACLE_BROWSER_PROFILE_DIR;
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(path.join(os.tmpdir(), "oracle-gemini-profile-"));
    delete process.env.ORACLE_BROWSER_PROFILE_DIR;

    launchChrome.mockReset();
    connectWithNewTab.mockReset();
    connectToRemoteChrome.mockReset();
    resolveAttachRunningConnection.mockReset();
    closeTab.mockClear();
    readDevToolsPort.mockReset();
    writeDevToolsActivePort.mockClear();
    writeChromePid.mockClear();
    cleanupStaleProfileState.mockClear();
    verifyDevToolsReachable.mockReset();
    terminateRecordedChromeForProfile.mockClear();

    launchChrome.mockResolvedValue({
      port: 9222,
      pid: 12345,
      kill: vi.fn(),
    });
    connectWithNewTab.mockResolvedValue({
      targetId: "target-1",
      client: {
        close: vi.fn(async () => undefined),
      },
    });
    readDevToolsPort.mockResolvedValue(null);
    verifyDevToolsReachable.mockResolvedValue({ ok: false, error: "unreachable" });
  });

  afterEach(async () => {
    if (originalProfileDir === undefined) {
      delete process.env.ORACLE_BROWSER_PROFILE_DIR;
    } else {
      process.env.ORACLE_BROWSER_PROFILE_DIR = originalProfileDir;
    }
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("waits for launcher termination and verifies the profile PID before finishing cleanup", async () => {
    let finishKill!: () => void;
    const kill = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishKill = resolve;
        }),
    );
    launchChrome.mockResolvedValue({ port: 9222, pid: 12345, kill });
    const { openGeminiBrowserSession } =
      await import("../../src/gemini-web/browserSessionManager.js");
    const session = await openGeminiBrowserSession({
      browserConfig: {},
      keepBrowserDefault: false,
      purpose: "test",
    });
    const closing = session.close();
    await vi.waitFor(() => expect(kill).toHaveBeenCalledOnce());
    expect(terminateRecordedChromeForProfile).not.toHaveBeenCalled();
    finishKill();
    await closing;
    expect(terminateRecordedChromeForProfile).toHaveBeenCalledWith(session.profileDir, undefined);
    expect(cleanupStaleProfileState).toHaveBeenCalled();
  });

  it("ignores explicit and environment profile overrides", async () => {
    const explicitDir = path.join(tempRoot, "explicit-profile");
    process.env.ORACLE_BROWSER_PROFILE_DIR = path.join(tempRoot, "env-profile");
    const defaultDir = path.join(os.homedir(), ".oracle", "browser-profile");

    const { openGeminiBrowserSession } =
      await import("../../src/gemini-web/browserSessionManager.js");
    const session = await openGeminiBrowserSession({
      browserConfig: { manualLoginProfileDir: explicitDir },
      keepBrowserDefault: false,
      purpose: "test",
    });

    expect(session.profileDir).toBe(defaultDir);
    expect(launchChrome).toHaveBeenCalledWith(
      expect.objectContaining({
        manualLogin: true,
        manualLoginProfileDir: defaultDir,
      }),
      defaultDir,
      expect.any(Function),
    );
  });

  it.each([{}, { noFocus: true }])(
    "keeps the startup window on a cold Gemini launch (%j)",
    async (browserConfig) => {
      // Gemini still opens its tab through /json/new, and a failed open falls back to the
      // startup page, so its launch must not go windowless under the no-focus default.
      const { openGeminiBrowserSession } =
        await import("../../src/gemini-web/browserSessionManager.js");
      const session = await openGeminiBrowserSession({
        browserConfig: { ...browserConfig, manualLoginProfileDir: tempRoot },
        keepBrowserDefault: true,
        purpose: "fixture",
      });
      expect(launchChrome).toHaveBeenCalledOnce();
      expect(launchChrome.mock.calls[0]?.[0]).toMatchObject({ noFocus: false });
      expect(connectWithNewTab).toHaveBeenCalledWith(9222, expect.any(Function), undefined);
      await session.close();
    },
  );

  it("uses the default profile even when ORACLE_BROWSER_PROFILE_DIR is set", async () => {
    const envDir = path.join(tempRoot, "env-profile");
    process.env.ORACLE_BROWSER_PROFILE_DIR = envDir;

    const { openGeminiBrowserSession } =
      await import("../../src/gemini-web/browserSessionManager.js");
    const session = await openGeminiBrowserSession({
      browserConfig: {},
      keepBrowserDefault: true,
      purpose: "test",
    });

    const defaultDir = path.join(os.homedir(), ".oracle", "browser-profile");
    expect(session.profileDir).toBe(defaultDir);
    expect(launchChrome).toHaveBeenCalledWith(
      expect.objectContaining({
        keepBrowser: true,
        manualLogin: true,
        manualLoginProfileDir: defaultDir,
      }),
      defaultDir,
      expect.any(Function),
    );
  });

  it("ignores blank environment profile dirs and falls back to the default", async () => {
    process.env.ORACLE_BROWSER_PROFILE_DIR = "   ";
    const homedir = path.join(tempRoot, "home");
    const homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(homedir);
    const defaultDir = path.join(homedir, ".oracle", "browser-profile");

    const { openGeminiBrowserSession } =
      await import("../../src/gemini-web/browserSessionManager.js");
    const session = await openGeminiBrowserSession({
      browserConfig: {},
      keepBrowserDefault: false,
      purpose: "test",
    });

    expect(session.profileDir).toBe(defaultDir);
    expect(launchChrome).toHaveBeenCalledWith(
      expect.objectContaining({
        manualLogin: true,
        manualLoginProfileDir: defaultDir,
      }),
      defaultDir,
      expect.any(Function),
    );
    homedirSpy.mockRestore();
  });
});
