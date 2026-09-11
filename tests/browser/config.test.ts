import { afterEach, describe, expect, test } from "vitest";
import os from "node:os";
import path from "node:path";
import { DEFAULT_CHATGPT_COOKIE_NAMES, resolveBrowserConfig } from "../../src/browser/config.js";
import { CHATGPT_URL, DEEP_RESEARCH_DEFAULT_TIMEOUT_MS } from "../../src/browser/constants.js";

describe("resolveBrowserConfig", () => {
  const originalProfileDir = process.env.ORACLE_BROWSER_PROFILE_DIR;
  afterEach(() => {
    if (originalProfileDir === undefined) {
      delete process.env.ORACLE_BROWSER_PROFILE_DIR;
    } else {
      process.env.ORACLE_BROWSER_PROFILE_DIR = originalProfileDir;
    }
  });

  test("returns defaults when config missing", () => {
    const resolved = resolveBrowserConfig(undefined);
    expect(resolved.url).toBe(CHATGPT_URL);
    expect(resolved.cookieSync).toBe(false);
    expect(resolved.cookieNames).toEqual(DEFAULT_CHATGPT_COOKIE_NAMES);
    expect(resolved.headless).toBe(false);
    expect(resolved.manualLogin).toBe(true);
    expect(resolved.profileLockTimeoutMs).toBe(300_000);
    expect(resolved.attachmentTimeoutMs).toBe(45_000);
    expect(resolved.maxConcurrentTabs).toBe(1);
    expect(resolved.researchMode).toBe("off");
    expect(resolved.archiveConversations).toBe("auto");
  });

  test("applies overrides", () => {
    const resolved = resolveBrowserConfig({
      url: "https://example.com",
      timeoutMs: 123,
      inputTimeoutMs: 456,
      attachmentTimeoutMs: 789,
      cookieSync: false,
      headless: true,
      desiredModel: "Custom",
      chromeProfile: "Profile 1",
      chromePath: "/Applications/Chrome",
      browserTabRef: "current",
      debug: true,
      maxConcurrentTabs: 5,
      researchMode: "deep",
      archiveConversations: "never",
    });
    expect(resolved.url).toBe("https://example.com/");
    expect(resolved.timeoutMs).toBe(123);
    expect(resolved.inputTimeoutMs).toBe(456);
    expect(resolved.attachmentTimeoutMs).toBe(789);
    expect(resolved.cookieSync).toBe(false);
    expect(resolved.headless).toBe(true);
    expect(resolved.desiredModel).toBe("Custom");
    expect(resolved.chromeProfile).toBeNull();
    expect(resolved.chromePath).toBe("/Applications/Chrome");
    expect(resolved.browserTabRef).toBeNull();
    expect(resolved.debug).toBe(true);
    expect(resolved.maxConcurrentTabs).toBe(1);
    expect(resolved.researchMode).toBe("deep");
    expect(resolved.archiveConversations).toBe("never");
  });

  test("allows temporary chat URLs when desiredModel is Pro", () => {
    const resolved = resolveBrowserConfig({
      url: "https://chatgpt.com/?temporary-chat=true",
      desiredModel: "GPT-5.2 Pro",
    });

    expect(resolved.url).toBe("https://chatgpt.com/?temporary-chat=true");
    expect(resolved.desiredModel).toBe("GPT-5.2 Pro");
    expect(resolved.modelStrategy).toBe("select");
  });

  test("always uses Oracle's default manual-login profile and ignores config and env overrides", () => {
    process.env.ORACLE_BROWSER_PROFILE_DIR = "/tmp/env-profile";
    const defaultDir = path.join(os.homedir(), ".oracle", "browser-profile");

    expect(
      resolveBrowserConfig({
        manualLogin: true,
        manualLoginProfileDir: " /tmp/config-profile ",
      }).manualLoginProfileDir,
    ).toBe(defaultDir);

    expect(resolveBrowserConfig({ manualLogin: true }).manualLoginProfileDir).toBe(defaultDir);

    process.env.ORACLE_BROWSER_PROFILE_DIR = "   ";
    expect(resolveBrowserConfig({ manualLogin: true }).manualLoginProfileDir).toBe(defaultDir);

    expect(resolveBrowserConfig({ manualLogin: false }).manualLoginProfileDir).toBe(defaultDir);
  });

  test("forces manual login and clears alternate authentication routes", () => {
    const resolved = resolveBrowserConfig({
      manualLogin: false,
      copyProfileSource: "/tmp/copied-profile-source",
      cookieSync: true,
      inlineCookies: [{ name: "session", value: "secret", domain: ".chatgpt.com" }],
      attachRunning: true,
      browserTabRef: "current",
      remoteChrome: { host: "elsewhere", port: 9222 },
    });

    expect(resolved.manualLogin).toBe(true);
    expect(resolved.copyProfileSource).toBeNull();
    expect(resolved.cookieSync).toBe(false);
    expect(resolved.inlineCookies).toBeNull();
    expect(resolved.attachRunning).toBe(false);
    expect(resolved.browserTabRef).toBeNull();
    expect(resolved.remoteChrome).toBeNull();
  });

  test("forces a single browser tab regardless of config and environment", () => {
    process.env.ORACLE_BROWSER_MAX_CONCURRENT_TABS = "5";
    expect(resolveBrowserConfig({ maxConcurrentTabs: 2 }).maxConcurrentTabs).toBe(1);
    expect(resolveBrowserConfig(undefined).maxConcurrentTabs).toBe(1);
  });

  test("uses the longer Deep Research timeout unless explicitly overridden", () => {
    expect(resolveBrowserConfig({ researchMode: "deep" }).timeoutMs).toBe(
      DEEP_RESEARCH_DEFAULT_TIMEOUT_MS,
    );
    expect(resolveBrowserConfig({ researchMode: "deep", timeoutMs: 123 }).timeoutMs).toBe(123);
  });
});
