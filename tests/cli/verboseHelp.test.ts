import { execFile } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
let oracleHome: string;

beforeAll(async () => {
  oracleHome = await mkdtemp(path.join(os.tmpdir(), "oracle-help-"));
});
afterAll(async () => {
  await rm(oracleHome, { recursive: true, force: true });
});

async function help(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--import", "tsx", path.join(process.cwd(), "bin/oracle-cli.ts"), ...args],
    {
      env: { ...process.env, ORACLE_HOME_DIR: oracleHome, ORACLE_FORCE_TUI: "0", NO_COLOR: "1" },
      timeout: 15_000,
    },
  );
  expect(await readdir(oracleHome)).toEqual([]);
  return stdout;
}

test.each([
  ["--help", "--verbose"],
  ["--verbose", "--help"],
  ["-h", "--verbose"],
])(
  "keeps root help concise when --verbose is discarded for %j",
  async (...args) => {
    const output = await help(args);
    expect(output).toContain("Usage:");
    // The fork whitelist drops --verbose on root runs, so the advanced
    // sections stay hidden; --debug-help remains the explicit entrypoint.
    expect(output).not.toContain("Advanced Options");
    expect(output).not.toContain("Browser Options");
    expect(output).not.toContain("--browser-cookie-path");
  },
  20_000,
);

test("keeps plain and subcommand help concise", async () => {
  expect(await help(["--help"])).not.toContain("Advanced Options");
  const subcommand = await help(["status", "--help", "--verbose"]);
  expect(subcommand).toContain("Usage:");
  expect(subcommand).not.toContain("Advanced Options");
}, 20_000);

test("keeps the explicit debug-help entrypoint", async () => {
  expect(await help(["--debug-help"])).toContain("Advanced Options");
}, 20_000);

// Hidden aliases, deprecated spellings, and internal flags that stay out of advanced help.
const UNLISTED_HIDDEN_FLAGS = [
  "--message",
  "--include",
  "--files",
  "--path",
  "--paths",
  "--mode",
  "--preview",
  "--copy",
  "--exec-session",
  "--session",
  "--status",
  "--browser",
  "--browser-debug-port",
  "--no-wait",
];

test("discarded root options stay registered for the escape hatch", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--import",
      pathToFileURL(path.join(process.cwd(), "tests/fixtures/dump-cli-options.mjs")).href,
      path.join(process.cwd(), "bin/oracle-cli.ts"),
    ],
    {
      env: { ...process.env, ORACLE_HOME_DIR: oracleHome, ORACLE_FORCE_TUI: "0", NO_COLOR: "1" },
      timeout: 15_000,
    },
  );
  // The whitelist hides these from help and discards their values at runtime,
  // but they must stay registered so ORACLE_ALLOW_API_ENGINE=1 can parse them.
  const hiddenFlags = (JSON.parse(stdout) as Array<{ long?: string; hidden: boolean }>)
    .filter((option) => option.hidden && option.long)
    .map((option) => option.long as string);
  expect(hiddenFlags).toEqual(expect.arrayContaining(UNLISTED_HIDDEN_FLAGS));

  // The fork's --debug-help documents a curated advanced set, not every hidden
  // registration; it only has to stay available and lead with the section.
  const output = await help(["--debug-help"]);
  expect(output.indexOf("Advanced Options")).toBeGreaterThan(-1);
}, 20_000);
