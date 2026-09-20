import { describe, expect, test } from "vitest";
import { filterRootRunArgs } from "../../src/cli/cliArgWhitelist.js";

describe("filterRootRunArgs", () => {
  test("keeps the allowed consultation surface", () => {
    const args = [
      "-p",
      "review this",
      "--file",
      "src/a.ts",
      "src/b.ts",
      "--model",
      "gpt-5.5-pro",
      "--write-output",
      "/tmp/out.md",
    ];
    expect(filterRootRunArgs(args)).toEqual(args);
  });

  test("keeps aliases for prompt, files, model, and output", () => {
    expect(filterRootRunArgs(["--message", "hi"])).toEqual(["--message", "hi"]);
    expect(filterRootRunArgs(["-f", "a.ts"])).toEqual(["-f", "a.ts"]);
    expect(filterRootRunArgs(["-m", "gemini-3-pro"])).toEqual(["-m", "gemini-3-pro"]);
    expect(filterRootRunArgs(["--output", "img.png"])).toEqual(["--output", "img.png"]);
  });

  test("keeps engine and manual-login flags", () => {
    const args = ["--engine", "browser", "--browser-manual-login", "-p", "hi"];
    expect(filterRootRunArgs(args)).toEqual(args);
  });

  test("silently drops disallowed value flags together with their values", () => {
    expect(filterRootRunArgs(["--timeout", "5m", "-p", "hi"])).toEqual(["-p", "hi"]);
    expect(filterRootRunArgs(["--remote-host", "host:9473", "-p", "hi"])).toEqual(["-p", "hi"]);
    expect(filterRootRunArgs(["--browser-thinking-time=pro", "-p", "hi"])).toEqual(["-p", "hi"]);
  });

  test("silently drops disallowed boolean flags", () => {
    expect(filterRootRunArgs(["--browser-keep-browser", "-p", "hi"])).toEqual(["-p", "hi"]);
    expect(filterRootRunArgs(["--verbose", "--force", "-p", "hi"])).toEqual(["-p", "hi"]);
    expect(filterRootRunArgs(["--no-notify", "-p", "hi"])).toEqual(["-p", "hi"]);
  });

  test("drops unknown flags without inventing a value", () => {
    expect(filterRootRunArgs(["--totally-unknown", "-p", "hi"])).toEqual(["-p", "hi"]);
  });

  test("keeps positional prompt operands", () => {
    expect(filterRootRunArgs(["fix the bug"])).toEqual(["fix the bug"]);
    expect(filterRootRunArgs(["--engine", "browser", "fix the bug"])).toEqual([
      "--engine",
      "browser",
      "fix the bug",
    ]);
  });

  test("handles equals-form values for allowed flags", () => {
    expect(filterRootRunArgs(["--prompt=hi", "--model=gpt-5.5"])).toEqual([
      "--prompt=hi",
      "--model=gpt-5.5",
    ]);
  });

  test("keeps everything after -- verbatim", () => {
    const args = ["-p", "hi", "--", "--weird prompt --with dashes"];
    expect(filterRootRunArgs(args)).toEqual(args);
  });

  test("bypasses subcommand invocations entirely", () => {
    const args = ["status", "--render", "--limit", "5"];
    expect(filterRootRunArgs(args)).toEqual(args);
    const sessionArgs = ["session", "sess-1", "--render-markdown"];
    expect(filterRootRunArgs(sessionArgs)).toEqual(sessionArgs);
    const serveArgs = ["serve", "--port", "9000"];
    expect(filterRootRunArgs(serveArgs)).toEqual(serveArgs);
  });

  test("detects subcommands after allowed option values", () => {
    const args = ["-p", "hi", "status", "--render"];
    expect(filterRootRunArgs(args)).toEqual(args);
  });

  test("keeps internal plumbing flags", () => {
    expect(filterRootRunArgs(["--exec-session", "sess-1"])).toEqual(["--exec-session", "sess-1"]);
    expect(filterRootRunArgs(["--session", "sess-1"])).toEqual(["--session", "sess-1"]);
    expect(filterRootRunArgs(["--status"])).toEqual(["--status"]);
  });

  test("keeps dry-run with its optional mode operand", () => {
    expect(filterRootRunArgs(["--dry-run", "json", "-p", "hi"])).toEqual([
      "--dry-run",
      "json",
      "-p",
      "hi",
    ]);
    expect(filterRootRunArgs(["--dry-run", "-p", "hi"])).toEqual(["--dry-run", "-p", "hi"]);
  });

  test("escape hatch bypasses filtering", () => {
    const args = ["--provider", "openai", "--route", "-p", "hi"];
    expect(filterRootRunArgs(args, { ORACLE_ALLOW_API_ENGINE: "1" })).toEqual(args);
    expect(filterRootRunArgs(args, {})).toEqual(["-p", "hi"]);
  });

  test("keeps followup continuation flags with their values", () => {
    expect(
      filterRootRunArgs([
        "--followup",
        "browser-session-slug",
        "--followup-model",
        "gpt-5.5-pro",
        "--browser-follow-up",
        "turn two",
        "--browser-follow-up=turn three",
        "-p",
        "hello",
      ]),
    ).toEqual([
      "--followup",
      "browser-session-slug",
      "--followup-model",
      "gpt-5.5-pro",
      "--browser-follow-up",
      "turn two",
      "--browser-follow-up=turn three",
      "-p",
      "hello",
    ]);
  });

  test("variadic file values stop at the next flag", () => {
    expect(filterRootRunArgs(["-f", "a.ts", "b.ts", "-p", "hi"])).toEqual([
      "-f",
      "a.ts",
      "b.ts",
      "-p",
      "hi",
    ]);
    expect(filterRootRunArgs(["--files", "a.ts", "--verbose"])).toEqual(["--files", "a.ts"]);
  });
});
