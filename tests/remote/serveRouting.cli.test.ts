import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { expect, test } from "vitest";

test("built CLI silently ignores alternate browser authentication routes", async () => {
  const env = { ...process.env };
  delete env.ORACLE_ALLOW_API_ENGINE;
  const { stdout, stderr } = await promisify(execFile)(
    process.execPath,
    [
      "--import",
      "tsx",
      path.resolve("bin/oracle-cli.ts"),
      "--copy-profile",
      "/tmp/alternate-profile",
      "--browser-cookie-sync",
      "--browser-attach-running",
      "--remote-chrome",
      "invalid",
      "--browser-tab=current",
      "--dry-run",
      "json",
      "--prompt",
      "compiled policy proof",
    ],
    { env, timeout: 30_000 },
  );

  expect(stderr).toBe("");
  expect(stdout).toContain('"engine": "browser"');
  expect(stdout).toContain("Manual-login mode");
  expect(stdout).not.toContain("alternate-profile");
  expect(stdout).not.toContain("invalid");
}, 35_000);
