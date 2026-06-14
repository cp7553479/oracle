import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { setOracleHomeDirOverrideForTest } from "../../src/oracleHome.js";
import {
  applyNamedProfileToBrowserOptions,
  getDefaultNamedProfileDir,
  listNamedProfiles,
  openNamedProfileBrowser,
  resolveNamedProfileDir,
  validateNamedProfileName,
} from "../../src/cli/namedProfiles.js";

let tmpHome: string;

beforeEach(async () => {
  tmpHome = await mkdtemp(path.join(os.tmpdir(), "oracle-profile-test-"));
  setOracleHomeDirOverrideForTest(tmpHome);
});

afterEach(async () => {
  setOracleHomeDirOverrideForTest(null);
  await rm(tmpHome, { recursive: true, force: true });
});

describe("named profiles", () => {
  test("resolves default to browser-profile and other names under browser-profiles", () => {
    expect(getDefaultNamedProfileDir()).toBe(path.join(tmpHome, "browser-profile"));
    expect(resolveNamedProfileDir("default")).toBe(path.join(tmpHome, "browser-profile"));
    expect(resolveNamedProfileDir("main")).toBe(path.join(tmpHome, "browser-profiles", "main"));
  });

  test("rejects unsafe profile names", () => {
    expect(() => validateNamedProfileName("../main")).toThrow(/invalid profile name/i);
    expect(() => validateNamedProfileName(".hidden")).toThrow(/invalid profile name/i);
  });

  test("applies named profile to browser manual-login options", () => {
    const options = { profile: "main" };
    const profileDir = applyNamedProfileToBrowserOptions(options, () => "default");
    expect(profileDir).toBe(path.join(tmpHome, "browser-profiles", "main"));
    expect(options).toMatchObject({
      browserManualLogin: true,
      browserManualLoginProfileDir: path.join(tmpHome, "browser-profiles", "main"),
    });
  });

  test("maps default profile to the legacy manual-login directory", () => {
    const options = { profile: "default" };
    const profileDir = applyNamedProfileToBrowserOptions(options, () => "default");
    expect(profileDir).toBe(path.join(tmpHome, "browser-profile"));
    expect(options).toMatchObject({
      browserManualLogin: true,
      browserManualLoginProfileDir: path.join(tmpHome, "browser-profile"),
    });
  });

  test("rejects explicit manual-login profile dir conflicts", () => {
    expect(() =>
      applyNamedProfileToBrowserOptions(
        { profile: "main", browserManualLoginProfileDir: "/tmp/profile" },
        (key) => (key === "browserManualLoginProfileDir" ? "cli" : "default"),
      ),
    ).toThrow(/browser-manual-login-profile-dir/i);
  });

  test("lists initialized profile metadata", async () => {
    const defaultDir = path.join(tmpHome, "browser-profile");
    await mkdir(path.join(defaultDir, "Default"), { recursive: true });

    const profileDir = path.join(tmpHome, "browser-profiles", "main");
    await mkdir(path.join(profileDir, "Default"), { recursive: true });
    await writeFile(path.join(profileDir, "DevToolsActivePort"), "12345\n/devtools/browser\n");

    const profiles = await listNamedProfiles();
    expect(profiles).toEqual([
      expect.objectContaining({
        name: "default",
        path: defaultDir,
        initialized: true,
        devToolsPort: null,
        devToolsReachable: false,
      }),
      expect.objectContaining({
        name: "main",
        path: profileDir,
        initialized: true,
        devToolsPort: 12345,
        devToolsReachable: false,
      }),
    ]);
  });

  test("opens profile setup in a normal Chrome process", async () => {
    const spawned: Array<{ command: string; args: string[] }> = [];
    const spawnProcess = vi.fn((command: string, args: string[]) => {
      spawned.push({ command, args });
      const child = new EventEmitter();
      Object.assign(child, { pid: 1234, unref: vi.fn() });
      queueMicrotask(() => child.emit("spawn"));
      return child;
    });

    const stalePortPath = path.join(tmpHome, "browser-profiles", "main", "DevToolsActivePort");
    await mkdir(path.dirname(stalePortPath), { recursive: true });
    await writeFile(stalePortPath, "12345\n/devtools/browser\n");

    const result = await openNamedProfileBrowser({
      name: "main",
      browserChromePath: "/tmp/chrome-for-testing",
      create: true,
      spawnProcess: spawnProcess as never,
      log: () => {},
    });

    expect(result.pid).toBe(1234);
    expect(existsSync(path.join(tmpHome, "browser-profiles", "main"))).toBe(true);
    expect(existsSync(stalePortPath)).toBe(false);
    expect(spawned[0]?.command).toBe("/tmp/chrome-for-testing");
    expect(spawned[0]?.args).toEqual(
      expect.arrayContaining([
        `--user-data-dir=${path.join(tmpHome, "browser-profiles", "main")}`,
        "--no-first-run",
        "--new-window",
        "https://chatgpt.com/",
      ]),
    );
  });
});
