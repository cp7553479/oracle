import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  buildProjectSourcesBrowserConfig,
  resolveProjectSourceFiles,
} from "../../src/cli/projectSources.js";

describe("project sources CLI helpers", () => {
  test("resolves files without reading their contents into memory", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "oracle-project-sources-test-"));
    try {
      await writeFile(path.join(dir, "context.md"), "PROJECT_SOURCE_OK\n", "utf8");
      const files = await resolveProjectSourceFiles(["context.md"], {
        cwd: dir,
        maxFileSizeBytes: 1_000_000,
      });
      expect(files).toEqual([
        expect.objectContaining({
          path: path.join(dir, "context.md"),
          displayPath: "context.md",
          sizeBytes: 18,
        }),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("builds browser config without a model picker target", async () => {
    const config = await buildProjectSourcesBrowserConfig({
      options: {
        browserKeepBrowser: true,
        browserManualLogin: true,
      },
      projectUrl: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      configuredBrowser: {
        desiredModel: "GPT-5.5 Pro",
        modelStrategy: "select",
      },
    });
    expect(config).toMatchObject({
      url: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      chatgptUrl: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      keepBrowser: true,
      manualLogin: true,
      manualLoginProfileDir: path.join(os.homedir(), ".oracle", "browser-profile"),
      desiredModel: null,
      modelStrategy: "ignore",
      researchMode: "off",
    });
  });

  test("ignores ORACLE_BROWSER_PROFILE_DIR and uses Oracle's default profile", async () => {
    process.env.ORACLE_BROWSER_PROFILE_DIR = "/tmp/env-oracle-profile";
    const config = await buildProjectSourcesBrowserConfig({
      options: {},
      projectUrl: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      configuredBrowser: {},
    });
    expect(config).toMatchObject({
      manualLogin: true,
      manualLoginProfileDir: path.join(os.homedir(), ".oracle", "browser-profile"),
      cookieSync: false,
      desiredModel: null,
      modelStrategy: "ignore",
    });
  });

  test("ignores explicit cookie sync for a persistent manual-login profile", async () => {
    const config = await buildProjectSourcesBrowserConfig({
      options: {},
      projectUrl: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      configuredBrowser: {
        manualLogin: true,
        manualLoginCookieSync: true,
      },
    });

    expect(config).toMatchObject({
      manualLogin: true,
      manualLoginCookieSync: false,
      cookieSync: false,
    });
  });

  test("ignores every cookie sync input for manual-login profiles", async () => {
    const fromConfig = await buildProjectSourcesBrowserConfig({
      options: {},
      projectUrl: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      configuredBrowser: { manualLoginCookieSync: true },
    });
    const fromFlag = await buildProjectSourcesBrowserConfig({
      options: { browserCookieSync: true },
      projectUrl: "https://chatgpt.com/g/g-p-123/project?tab=sources",
      configuredBrowser: {},
    });

    expect(fromConfig.cookieSync).toBe(false);
    expect(fromFlag.cookieSync).toBe(false);
  });
});
