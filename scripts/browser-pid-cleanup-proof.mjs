#!/usr/bin/env node
// Real Chrome process proof; disposable profile, no account or provider requests.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { launch } from "chrome-launcher";
import {
  readChromePid,
  writeChromePid,
  writeDevToolsActivePort,
  terminateRecordedChromeForProfile,
  verifyDevToolsReachable,
  isProcessAlive,
} from "../dist/src/browser/profileState.js";
import { maybeReuseRunningChrome } from "../dist/src/browser/reuseChrome.js";
import { findEphemeralPort } from "../dist/src/browser/chromeLifecycle.js";

if (process.platform === "win32") {
  console.log("Skipped: stale PID process discovery requires a POSIX process list.");
  process.exit(0);
}
const profile = await fs.mkdtemp(path.join(os.homedir(), "oracle-pid-cleanup-proof-"));
let chrome;
try {
  chrome = await launch({
    port: await findEphemeralPort(),
    userDataDir: profile,
    handleSIGINT: false,
    chromeFlags: ["--headless=new", "--no-first-run", "--no-default-browser-check"],
  });
  await writeDevToolsActivePort(profile, chrome.port);
  // A recycled PID can name another live controller. Neither reuse nor cleanup
  // may trust it, even while the recorded DevTools port remains reachable.
  await writeChromePid(profile, process.pid);
  const reused = await maybeReuseRunningChrome(profile, console.log);
  assert.equal(reused?.pid, chrome.pid);
  assert.equal(await readChromePid(profile), chrome.pid);
  assert.ok(isProcessAlive(process.pid));

  // Exercise termination's independent recovery, not just reuse's metadata.
  await writeChromePid(profile, process.pid);
  assert.equal(await terminateRecordedChromeForProfile(profile, console.log), true);
  assert.equal(isProcessAlive(chrome.pid), false);
  assert.equal((await verifyDevToolsReachable({ port: chrome.port })).ok, false);
  assert.ok(isProcessAlive(process.pid));
  console.log(
    "PASS: stale PID refreshed, actual Chrome exited, DevTools closed, unrelated controller preserved.",
  );
} finally {
  await Promise.resolve(chrome?.kill()).catch(() => {});
  await fs.rm(profile, { recursive: true, force: true });
}
