import { describe, expect, test } from "vitest";
import {
  PRESERVED_FOLLOWUP_FLAGS,
  stripDisabledBrowserProfileArgs,
} from "../../src/cli/browserProfilePolicy.js";

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

  test("keeps followup continuation flags with their values", () => {
    const argv = [
      "--followup",
      "browser-session-slug",
      "--followup-model",
      "gpt-5.5-pro",
      "--browser-follow-up",
      "turn two",
      "--browser-follow-up=turn three",
      "-p",
      "hello",
    ];
    expect(stripDisabledBrowserProfileArgs(argv)).toEqual(argv);
    expect(PRESERVED_FOLLOWUP_FLAGS).toEqual(["--followup", "--browser-follow-up"]);
  });
});
