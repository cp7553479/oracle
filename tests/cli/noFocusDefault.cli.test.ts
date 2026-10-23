import { test, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const exec = promisify(execFile);
const BACKGROUND = "Browser control: launch visible Chrome; keeps Chrome in the background.";
const FOREGROUND = "Browser control: launch visible Chrome; may focus/control the browser UI.";

test("root runs keep no-focus off by default, honor browser.noFocus config, and discard its flags", async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), "oracle-no-focus-cli-"));
  const env = {
    ...process.env,
    ORACLE_HOME_DIR: home,
    ORACLE_NO_DETACH: "1",
    OPENAI_API_KEY: "",
    ORACLE_ENGINE: "",
  };
  const dryRun = async (extra: string[]) =>
    (
      await exec(
        process.execPath,
        [
          "--import",
          "tsx",
          "bin/oracle-cli.ts",
          "--engine",
          "browser",
          "--model",
          "gpt-6",
          "--prompt",
          "no-focus default proof",
          "--dry-run",
          "summary",
          ...extra,
        ],
        { env },
      )
    ).stdout;
  try {
    // Off by default; the fork whitelist discards the flags, so only the
    // persisted browser.noFocus config can switch the window policy.
    expect(await dryRun([])).toContain(FOREGROUND);
    expect(await dryRun(["--browser-no-focus"])).toContain(FOREGROUND);
    expect(await dryRun(["--no-browser-no-focus"])).toContain(FOREGROUND);
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ browser: { noFocus: false } }),
    );
    expect(await dryRun([])).toContain(FOREGROUND);
    await fs.writeFile(
      path.join(home, "config.json"),
      JSON.stringify({ browser: { noFocus: true } }),
    );
    expect(await dryRun([])).toContain(BACKGROUND);
    expect(await dryRun(["--no-browser-no-focus"])).toContain(BACKGROUND);
  } finally {
    await fs.rm(home, { recursive: true, force: true });
  }
}, 60_000);
