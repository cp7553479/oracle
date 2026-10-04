import { describe, expect, test } from "vitest";
import { stripDisabledBrowserProfileArgs } from "../../src/cli/browserProfilePolicy.js";

describe("stripDisabledBrowserProfileArgs", () => {
  test("silently consumes profile-affecting compatibility flags", () => {
    expect(
      stripDisabledBrowserProfileArgs([
        "node",
        "oracle",
        "--copy-profile",
        "/tmp/source",
        "--browser-manual-login-profile-dir=/tmp/profile",
        "--browser-cookie-sync",
        "--manual-login=false",
        "--browser-inline-cookies-file",
        "/tmp/cookies.json",
        "--browser-attach-running",
        "--remote-chrome=127.0.0.1:9222",
        "--browser-tab",
        "current",
        "-p",
        "hello",
      ]),
    ).toEqual(["node", "oracle", "-p", "hello"]);
  });

  test("keeps required login aliases and unrelated browser controls", () => {
    expect(
      stripDisabledBrowserProfileArgs([
        "--manual-login",
        "--manual-browser-login",
        "--browser-manual-login",
        "--browser-chrome-path",
        "/Applications/Chromium",
      ]),
    ).toEqual([
      "--manual-login",
      "--manual-browser-login",
      "--browser-manual-login",
      "--browser-chrome-path",
      "/Applications/Chromium",
    ]);
  });

  test("preserves prompt text after the option terminator", () => {
    const argv = ["-p", "before", "--", "--copy-profile", "/tmp/prompt-text"];
    expect(stripDisabledBrowserProfileArgs(argv)).toEqual(argv);
  });

  test("consumes every profile, cookie, attach, remote-Chrome, and tab flag in both spellings", () => {
    const booleanFlags = [
      "--browser-allow-cookie-errors",
      "--browser-attach-running",
      "--browser-cookie-sync",
      "--browser-manual-login-cookie-sync",
      "--browser-no-cookie-sync",
      "--no-browser-cookie-sync",
      "--no-browser-manual-login",
      "--no-manual-browser-login",
      "--no-manual-login",
    ];
    for (const flag of booleanFlags) {
      expect(stripDisabledBrowserProfileArgs(["node", "oracle", flag, "-p", "hi"])).toEqual([
        "node",
        "oracle",
        "-p",
        "hi",
      ]);
    }
    const valueFlags = [
      "--browser-chrome-profile",
      "--browser-cookie-names",
      "--browser-cookie-path",
      "--browser-cookie-wait",
      "--browser-inline-cookies",
      "--browser-inline-cookies-file",
      "--browser-manual-login-profile-dir",
      "--browser-profile-dir",
      "--browser-tab",
      "--copy-profile",
      "--manual-login-profile-dir",
      "--remote-chrome",
    ];
    for (const flag of valueFlags) {
      expect(
        stripDisabledBrowserProfileArgs(["node", "oracle", flag, "value", "-p", "hi"]),
      ).toEqual(["node", "oracle", "-p", "hi"]);
      expect(
        stripDisabledBrowserProfileArgs(["node", "oracle", `${flag}=value`, "-p", "hi"]),
      ).toEqual(["node", "oracle", "-p", "hi"]);
    }
  });
});
