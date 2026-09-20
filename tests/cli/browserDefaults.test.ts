import { describe, expect, test } from "vitest";
import { Command, Option } from "commander";
import {
  applyBrowserDefaultsFromConfig,
  type BrowserDefaultsOptions,
} from "../../src/cli/browserDefaults.js";
import type { UserConfig } from "../../src/config.js";
import { buildBrowserConfig } from "../../src/cli/browserConfig.js";

const source = (_key: keyof BrowserDefaultsOptions) => undefined;

describe("applyBrowserDefaultsFromConfig", () => {
  test("applies provider evidence preference while respecting explicit opt-out", async () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = { browser: { captureProviderNative: true } };
    applyBrowserDefaultsFromConfig(options, config, source);
    expect(
      (
        await buildBrowserConfig({
          browserCaptureProviderNative: options.browserCaptureProviderNative,
          model: "gpt-5.6-sol",
        })
      ).captureProviderNative,
    ).toBe(true);
    options.browserCaptureProviderNative = false;
    applyBrowserDefaultsFromConfig(options, config, () => "cli");
    expect(
      (
        await buildBrowserConfig({
          browserCaptureProviderNative: options.browserCaptureProviderNative,
          model: "gpt-5.6-sol",
        })
      ).captureProviderNative,
    ).toBe(false);
  });
  test("does not inherit profile, cookie, attach, or remote browser settings", () => {
    const options: BrowserDefaultsOptions = {};
    applyBrowserDefaultsFromConfig(
      options,
      {
        browser: {
          remoteChrome: { host: "127.0.0.1", port: 9222 },
          attachRunning: true,
          chromeProfile: "Work",
          chromeCookiePath: "/tmp/cookies",
          cookieSync: true,
          manualLogin: false,
          manualLoginCookieSync: true,
        },
      },
      source,
    );
    expect(options).not.toHaveProperty("remoteChrome");
    expect(options).not.toHaveProperty("browserAttachRunning");
    expect(options).not.toHaveProperty("browserChromeProfile");
    expect(options).not.toHaveProperty("browserCookiePath");
    expect(options).not.toHaveProperty("browserCookieSync");
    expect(options).not.toHaveProperty("browserManualLogin");
    expect(options).not.toHaveProperty("browserManualLoginCookieSync");
  });
  test("applies chatgptUrl from user config when flags are absent", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        chatgptUrl: "https://chatgpt.com/g/g-p-foo/project",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.chatgptUrl).toBe("https://chatgpt.com/g/g-p-foo/project");
  });

  test("does not override when CLI provided chatgptUrl", () => {
    const options: BrowserDefaultsOptions = { chatgptUrl: "https://override.example.com/" };
    const config: UserConfig = {
      browser: {
        chatgptUrl: "https://chatgpt.com/g/g-p-foo/project",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.chatgptUrl).toBe("https://override.example.com/");
  });

  test("falls back to browser.url when chatgptUrl missing", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        url: "https://chatgpt.com/g/g-p-bar/project",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.chatgptUrl).toBe("https://chatgpt.com/g/g-p-bar/project");
  });

  test("applies chrome defaults when CLI flags are untouched or defaulted", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        chromePath: "/Applications/Comet.app/Contents/MacOS/Comet",
        chromeProfile: "Work",
        chromeCookiePath: "/tmp/cookies",
        timeoutMs: 120_000,
        inputTimeoutMs: 15_000,
        attachmentTimeoutMs: 90_000,
        profileLockTimeoutMs: 90_000,
        maxConcurrentTabs: 4,
        cookieSync: true,
        cookieSyncWaitMs: 4_000,
        headless: true,
        hideWindow: true,
        keepBrowser: true,
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserChromePath).toBe("/Applications/Comet.app/Contents/MacOS/Comet");
    expect(options.browserChromeProfile).toBeUndefined();
    expect(options.browserCookiePath).toBeUndefined();
    expect(options.browserTimeout).toBe("120000");
    expect(options.browserInputTimeout).toBe("15000");
    expect(options.browserAttachmentTimeout).toBe("90000");
    expect(options.browserProfileLockTimeout).toBe("90000");
    expect(options.browserMaxConcurrentTabs).toBe("4");
    expect(options.browserCookieWait).toBe("4000");
    expect(options.browserCookieSync).toBeUndefined();
    expect(options.browserHeadless).toBe(true);
    expect(options.browserHideWindow).toBe(true);
    expect(options.browserKeepBrowser).toBe(true);
  });

  test("applies thinking time when CLI flag is untouched", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        thinkingTime: "extended",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserThinkingTime).toBe("extended");
  });

  test("keeps the GPT-6 Pro effort default when the model comes from CLI", async () => {
    const options: BrowserDefaultsOptions = { model: "gpt-6-pro" };
    const config: UserConfig = {
      browser: {
        thinkingTime: "extended",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (key) => (key === "model" ? "cli" : "default"));

    expect(options.browserThinkingTime).toBeUndefined();
    await expect(
      buildBrowserConfig({
        model: options.model!,
        browserThinkingTime: options.browserThinkingTime,
      }),
    ).resolves.toMatchObject({ thinkingTime: "pro" });
  });

  test("keeps an explicit CLI effort for GPT-6 Pro", () => {
    const options: BrowserDefaultsOptions = {
      model: "gpt-6-pro",
      browserThinkingTime: "extended",
    };
    const config: UserConfig = {
      browser: {
        thinkingTime: "standard",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (key) =>
      key === "model" || key === "browserThinkingTime" ? "cli" : "default",
    );

    expect(options.browserThinkingTime).toBe("extended");
  });

  test("preserves configured effort when GPT-6 Pro does not come from CLI", () => {
    const options: BrowserDefaultsOptions = { model: "gpt-6-pro" };
    const config: UserConfig = {
      browser: {
        thinkingTime: "extended",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserThinkingTime).toBe("extended");
  });

  test("applies browser research mode when CLI flag is untouched", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        researchMode: "deep",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserResearch).toBe("deep");
  });

  test("does not override thinking time when CLI provided a value", () => {
    const options: BrowserDefaultsOptions = { browserThinkingTime: "light" };
    const config: UserConfig = {
      browser: {
        thinkingTime: "heavy",
      },
    };

    const source = (key: keyof BrowserDefaultsOptions) =>
      key === "browserThinkingTime" ? "cli" : "default";
    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.browserThinkingTime).toBe("light");
  });

  test("does not inherit thinking time when CLI requests the current model", () => {
    const options: BrowserDefaultsOptions = { browserModelStrategy: "current" };
    const config: UserConfig = {
      browser: {
        thinkingTime: "extended",
      },
    };

    const source = (key: keyof BrowserDefaultsOptions) =>
      key === "browserModelStrategy" ? "cli" : "default";
    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.browserThinkingTime).toBeUndefined();
  });

  test("keeps explicit thinking time when CLI requests the current model", () => {
    const options: BrowserDefaultsOptions = {
      browserModelStrategy: "current",
      browserThinkingTime: "extended",
    };
    const config: UserConfig = {
      browser: {
        thinkingTime: "heavy",
      },
    };

    const source = (key: keyof BrowserDefaultsOptions) =>
      key === "browserModelStrategy" || key === "browserThinkingTime" ? "cli" : "default";
    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.browserThinkingTime).toBe("extended");
  });

  test("preserves config-defined current strategy with its thinking time", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        modelStrategy: "current",
        thinkingTime: "extended",
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserModelStrategy).toBe("current");
    expect(options.browserThinkingTime).toBe("extended");
  });

  test.each(["select", "ignore"] as const)(
    "inherits thinking time when CLI requests %s strategy",
    (strategy) => {
      const options: BrowserDefaultsOptions = { browserModelStrategy: strategy };
      const config: UserConfig = { browser: { thinkingTime: "extended" } };
      const source = (key: keyof BrowserDefaultsOptions) =>
        key === "browserModelStrategy" ? "cli" : undefined;

      applyBrowserDefaultsFromConfig(options, config, source);

      expect(options.browserThinkingTime).toBe("extended");
    },
  );

  test.each([
    { args: ["--browser-model-strategy", "current"], expectedThinkingTime: undefined },
    {
      args: ["--browser-model-strategy", "current", "--browser-thinking-time", "extended"],
      expectedThinkingTime: "extended",
    },
  ])("honors Commander CLI option sources for $args", ({ args, expectedThinkingTime }) => {
    const program = new Command()
      .exitOverride()
      .addOption(
        new Option("--browser-model-strategy <mode>").choices(["select", "current", "ignore"]),
      )
      .addOption(
        new Option("--browser-thinking-time <level>").choices([
          "light",
          "standard",
          "extended",
          "heavy",
        ]),
      );
    program.parse(args, { from: "user" });
    const options = program.opts<BrowserDefaultsOptions>();
    const config: UserConfig = { browser: { thinkingTime: "heavy" } };

    applyBrowserDefaultsFromConfig(options, config, (key) => program.getOptionValueSource(key));

    expect(program.getOptionValueSource("browserModelStrategy")).toBe("cli");
    expect(options.browserThinkingTime).toBe(expectedThinkingTime);
  });

  test("ignores manual-login and cookie-sync defaults from config", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        manualLogin: true,
        manualLoginCookieSync: true,
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserManualLogin).toBeUndefined();
    expect(options.browserManualLoginCookieSync).toBeUndefined();
  });

  test("ignores attach-running defaults from config", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        attachRunning: true,
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserAttachRunning).toBeUndefined();
  });

  test("explicit legacy attach input does not enable profile defaults", () => {
    const options: BrowserDefaultsOptions = { browserAttachRunning: true };
    const config: UserConfig = {
      browser: {
        chromeProfile: "Default",
        chromeCookiePath: "/tmp/cookies",
        attachRunning: false,
        debugPort: 9222,
        timeoutMs: 120_000,
        headless: true,
        manualLoginCookieSync: true,
        hideWindow: true,
        keepBrowser: true,
        manualLogin: true,
        thinkingTime: "extended",
      },
    };
    const source = (key: keyof BrowserDefaultsOptions) =>
      key === "browserAttachRunning" ? "cli" : "default";

    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.browserAttachRunning).toBe(true);
    expect(options.browserChromeProfile).toBeUndefined();
    expect(options.browserCookiePath).toBeUndefined();
    expect(options.browserPort).toBe(9222);
    expect(options.browserHeadless).toBe(true);
    expect(options.browserManualLoginCookieSync).toBeUndefined();
    expect(options.browserHideWindow).toBe(true);
    expect(options.browserKeepBrowser).toBe(true);
    expect(options.browserManualLogin).toBeUndefined();
    expect(options.browserTimeout).toBe("120000");
    expect(options.browserThinkingTime).toBe("extended");
  });

  test("saved attach-running is ignored while unrelated display settings remain", () => {
    const options: BrowserDefaultsOptions = {};
    const config: UserConfig = {
      browser: {
        attachRunning: true,
        headless: true,
        hideWindow: true,
      },
    };

    applyBrowserDefaultsFromConfig(options, config, (_key) => "default");

    expect(options.browserAttachRunning).toBeUndefined();
    expect(options.browserHeadless).toBe(true);
    expect(options.browserHideWindow).toBe(true);
  });

  test("does not override manual-login when CLI enabled it", () => {
    const options: BrowserDefaultsOptions = { browserManualLogin: true };
    const config: UserConfig = {
      browser: {
        manualLogin: false,
      },
    };

    const source = (key: keyof BrowserDefaultsOptions) =>
      key === "browserManualLogin" ? "cli" : "default";
    applyBrowserDefaultsFromConfig(options, config, source);

    expect(options.browserManualLogin).toBe(true);
  });
});
