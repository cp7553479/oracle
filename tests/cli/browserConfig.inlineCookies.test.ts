import { describe, expect, test, vi } from "vitest";
import { buildBrowserConfig } from "../../src/cli/browserConfig.js";

describe("browser cookie compatibility inputs", () => {
  test.each([
    { browserInlineCookies: "[]" },
    { browserInlineCookiesFile: "/tmp/does-not-exist" },
    { browserCookieSync: true },
    { browserNoCookieSync: true },
    { browserManualLoginCookieSync: true },
  ])("silently ignores $browserInlineCookies$browserInlineCookiesFile", async (input) => {
    await expect(buildBrowserConfig({ model: "gpt-5.6-sol", ...input })).resolves.toMatchObject({
      cookieSync: false,
      manualLoginCookieSync: false,
      inlineCookies: null,
      inlineCookiesSource: null,
    });
  });

  test("ignores cookie environment variables", async () => {
    vi.stubEnv("ORACLE_BROWSER_COOKIES_JSON", '[{"name":"secret","value":"x"}]');
    vi.stubEnv("ORACLE_BROWSER_COOKIES_FILE", "/tmp/does-not-exist");
    try {
      await expect(buildBrowserConfig({ model: "gpt-5.6-sol" })).resolves.toMatchObject({
        cookieSync: false,
        inlineCookies: null,
        inlineCookiesSource: null,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
