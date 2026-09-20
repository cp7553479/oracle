const IGNORED_BOOLEAN_FLAGS = new Set([
  "--browser-allow-cookie-errors",
  "--browser-attach-running",
  "--browser-cookie-sync",
  "--browser-manual-login-cookie-sync",
  "--browser-no-cookie-sync",
  "--no-browser-cookie-sync",
  "--no-browser-manual-login",
  "--no-manual-browser-login",
  "--no-manual-login",
]);

const IGNORED_VALUE_FLAGS = new Set([
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
]);

const REQUIRED_MANUAL_LOGIN_FLAGS = new Set([
  "--browser-manual-login",
  "--manual-browser-login",
  "--manual-login",
]);

/**
 * Conversation-continuation flags that stay functional under the forced browser
 * engine and must survive upstream refreshes without being stripped or
 * repurposed. `--followup` reopens a saved ChatGPT browser conversation;
 * `--browser-follow-up` queues planned same-run turns. `--followup-model` is
 * accepted as a pass-through but only the API lineage reader consumes it —
 * browser follow-ups inherit the parent session's stored model.
 */
export const PRESERVED_FOLLOWUP_FLAGS = ["--followup", "--browser-follow-up"] as const;

/** Silently remove legacy inputs that could replace the fixed login profile. */
export function stripDisabledBrowserProfileArgs(argv: string[]): string[] {
  const result: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      result.push(...argv.slice(index));
      break;
    }
    const equalsIndex = arg.indexOf("=");
    const flag = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
    if (equalsIndex !== -1 && REQUIRED_MANUAL_LOGIN_FLAGS.has(flag)) {
      const value = arg
        .slice(equalsIndex + 1)
        .trim()
        .toLowerCase();
      if (["false", "0", "off", "no"].includes(value)) continue;
    }
    if (IGNORED_BOOLEAN_FLAGS.has(flag)) continue;
    if (IGNORED_VALUE_FLAGS.has(flag)) {
      if (
        equalsIndex === -1 &&
        index + 1 < argv.length &&
        argv[index + 1] !== "--" &&
        !argv[index + 1].startsWith("-")
      ) {
        index += 1;
      }
      continue;
    }
    result.push(arg);
  }
  return result;
}
