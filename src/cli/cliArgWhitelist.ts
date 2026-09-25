/**
 * Fork CLI argument policy for root `oracle` runs.
 *
 * Callers (hermes, openclaw, codex, MCP bridges, shell users) may only steer a
 * root browser consultation with a small surface: which AI/model to target, the
 * prompt, attached files, and the output/download paths. Every other option is
 * silently discarded: no warning, no error, no exit-code change. Engine and
 * manual-login are forced downstream (`runRootCommand` appends the equivalent
 * of `--engine browser --manual-browser-login`), and the whitelisted engine and
 * manual-login flags are accepted so callers can pass them explicitly without
 * changing the outcome.
 *
 * Subcommand invocations (`oracle status`, `oracle session <id>`, `oracle
 * serve`, ...) bypass this policy entirely so session management and service
 * tooling keep their full option sets.
 */

export type FlagShape = "boolean" | "value" | "variadic";

const SUBCOMMANDS = new Set([
  "add",
  "bridge",
  "check",
  "claude-config",
  "client",
  "codex-config",
  "doctor",
  "docs",
  "host",
  "list",
  "project-sources",
  "restart",
  "serve",
  "session",
  "status",
  "tui",
]);

/**
 * Flags a root run accepts. `variadic` consumes every following operand, which
 * mirrors Commander's `-f, --file <paths...>` behavior.
 */
const ALLOWED_FLAGS: Record<string, FlagShape> = {
  // Prompt
  "-p": "value",
  "--prompt": "value",
  "--message": "value",
  // Attached files
  "-f": "variadic",
  "--file": "variadic",
  "--include": "variadic",
  "--files": "variadic",
  "--path": "variadic",
  "--paths": "variadic",
  // AI/model selection
  "-m": "value",
  "--model": "value",
  "--models": "value",
  // Conversation continuation: --followup reopens a saved ChatGPT browser
  // conversation, repeated --browser-follow-up queues planned same-run turns,
  // and --followup-model stays a pass-through (browser follow-ups inherit the
  // parent session's model).
  "--followup": "value",
  "--followup-model": "value",
  "--browser-follow-up": "value",
  // Output / download paths
  "--write-output": "value",
  "--output": "value",
  // Local preview: never calls a model, used by fork policy checks and debugging
  "--dry-run": "value",
  // Engine and manual login (both are forced downstream anyway)
  "-e": "value",
  "--engine": "value",
  "--mode": "value",
  "--browser-manual-login": "boolean",
  "--manual-login": "boolean",
  "--manual-browser-login": "boolean",
  // Internal plumbing: detached worker, root aliases, perf diagnostics
  "--exec-session": "value",
  "--session": "value",
  "--status": "boolean",
  "--perf-trace": "boolean",
  "--perf-trace-path": "value",
  // Meta
  "-h": "boolean",
  "--help": "boolean",
  "-V": "boolean",
  "--version": "boolean",
  "--debug-help": "boolean",
};

/**
 * Every remaining root-run option the CLI defines, with the number of operands
 * each consumes. Dropped flags surrender their values so no operand leaks
 * through as a stray prompt.
 */
const KNOWN_FLAG_SHAPES: Record<string, FlagShape> = {
  "-e": "value",
  "-f": "variadic",
  "-m": "value",
  "-p": "value",
  "-s": "value",
  "-v": "boolean",
  "--allow-partial": "boolean",
  "--aspect": "value",
  "--azure-api-version": "value",
  "--azure-deployment": "value",
  "--azure-endpoint": "value",
  "--background": "boolean",
  "--base-url": "value",
  "--browser": "boolean",
  "--browser-allow-cookie-errors": "boolean",
  "--browser-approval-wait": "value",
  "--browser-archive": "value",
  "--browser-attachment-timeout": "value",
  "--browser-attachments": "value",
  "--browser-auto-reattach-delay": "value",
  "--browser-auto-reattach-interval": "value",
  "--browser-auto-reattach-timeout": "value",
  "--browser-bundle-files": "boolean",
  "--browser-bundle-format": "value",
  "--browser-capture-provider-native": "boolean",
  "--browser-chrome-path": "value",
  "--browser-chrome-profile": "value",
  "--browser-cookie-path": "value",
  "--browser-cookie-wait": "value",
  "--browser-debug-port": "value",
  "--browser-follow-up": "value",
  "--browser-headless": "boolean",
  "--browser-hide-window": "boolean",
  "--browser-inline-cookies": "value",
  "--browser-inline-cookies-file": "value",
  "--browser-inline-files": "boolean",
  "--browser-input-timeout": "value",
  "--browser-keep-browser": "boolean",
  "--browser-manual-login-profile-dir": "value",
  "--browser-max-concurrent-tabs": "value",
  "--browser-model-strategy": "value",
  "--browser-no-cookie-sync": "boolean",
  "--browser-port": "value",
  "--browser-profile-lock-timeout": "value",
  "--browser-recheck-delay": "value",
  "--browser-recheck-timeout": "value",
  "--browser-research": "value",
  "--browser-reuse-wait": "value",
  "--browser-thinking-time": "value",
  "--browser-timeout": "value",
  "--browser-url": "value",
  "--chatgpt-url": "value",
  "--copy": "boolean",
  "--copy-markdown": "boolean",
  "--debug-help": "boolean",
  "--dry-run": "boolean",
  "--edit-image": "value",
  "--exec-session": "value",
  "--files": "variadic",
  "--files-report": "boolean",
  "--followup": "value",
  "--followup-model": "value",
  "--force": "boolean",
  "--gemini-fallback": "boolean",
  "--gemini-show-thoughts": "boolean",
  "--generate-image": "value",
  "--heartbeat": "value",
  "--http-timeout": "value",
  "--include": "variadic",
  "--manual-browser-login": "boolean",
  "--manual-login": "boolean",
  "--max-file-size-bytes": "value",
  "--max-input": "value",
  "--max-output": "value",
  "--message": "value",
  "--mode": "value",
  "--models": "value",
  "--no-azure": "boolean",
  "--no-background": "boolean",
  "--no-browser-capture-provider-native": "boolean",
  "--no-gemini-fallback": "boolean",
  "--no-notify": "boolean",
  "--no-notify-sound": "boolean",
  "--no-wait": "boolean",
  "--notify": "boolean",
  "--notify-sound": "boolean",
  "--output": "value",
  "--partial": "value",
  "--path": "variadic",
  "--paths": "variadic",
  "--perf-trace": "boolean",
  "--perf-trace-path": "value",
  "--preflight": "boolean",
  "--preview": "boolean",
  "--provider": "value",
  "--reasoning-effort": "value",
  "--reasoning-mode": "value",
  "--remote-host": "value",
  "--remote-token": "value",
  "--render": "boolean",
  "--render-markdown": "boolean",
  "--render-plain": "boolean",
  "--retain-hours": "value",
  "--route": "boolean",
  "--search": "value",
  "--session": "value",
  "--slug": "value",
  "--status": "boolean",
  "--timeout": "value",
  "--verbose": "boolean",
  "--verbose-render": "boolean",
  "--wait": "boolean",
  "--write-artifacts": "boolean",
  "--write-output": "value",
  "--youtube": "value",
  "--zombie-last-activity": "boolean",
  "--zombie-timeout": "value",
};

function flagName(arg: string): string {
  const equalsIndex = arg.indexOf("=");
  return equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
}

function isFlagLike(arg: string): boolean {
  return arg.startsWith("-") && arg !== "-" && !/^-[\d.]+$/.test(arg);
}

function shapeFor(name: string): FlagShape | undefined {
  const known = ALLOWED_FLAGS[name] ?? KNOWN_FLAG_SHAPES[name];
  if (known) return known;
  // Commander generates `--no-x` negations for boolean `--x` options.
  if (name.startsWith("--no-")) {
    const positive = `--${name.slice(5)}`;
    if (KNOWN_FLAG_SHAPES[positive] === "boolean" || ALLOWED_FLAGS[positive] === "boolean") {
      return "boolean";
    }
  }
  return undefined;
}

/**
 * True when the user args invoke a subcommand. Mirrors Commander's dispatch:
 * the first operand that is not consumed by an earlier option selects the
 * subcommand.
 */
function startsWithSubcommand(args: string[]): boolean {
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === "--") return false;
    if (isFlagLike(arg)) {
      const shape = shapeFor(flagName(arg));
      if (arg.includes("=")) {
        index += 1;
        continue;
      }
      if (shape === "value") {
        index += 2;
        continue;
      }
      if (shape === "variadic") {
        index += 1;
        while (index < args.length && !isFlagLike(args[index])) index += 1;
        continue;
      }
      index += 1;
      continue;
    }
    return SUBCOMMANDS.has(arg);
  }
  return false;
}

/**
 * Filter root-run CLI arguments down to the fork's allowed surface. Unknown or
 * disallowed options are dropped together with their values, silently.
 *
 * Setting `ORACLE_ALLOW_API_ENGINE=1` bypasses this policy. The escape hatch
 * exists for upstream API integration tests, which exercise the full upstream
 * option surface on purpose.
 */
export function filterRootRunArgs(args: string[], env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.ORACLE_ALLOW_API_ENGINE === "1") return args;
  if (startsWithSubcommand(args)) return args;
  const result: string[] = [];
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === "--") {
      result.push(...args.slice(index));
      return result;
    }
    if (isFlagLike(arg)) {
      const name = flagName(arg);
      const shape = shapeFor(name);
      const allowed = ALLOWED_FLAGS[name] !== undefined;
      if (allowed) {
        result.push(arg);
      }
      const effectiveShape = shape ?? "boolean";
      if (!arg.includes("=") && effectiveShape !== "boolean") {
        if (effectiveShape === "value") {
          const value = args[index + 1];
          if (
            index + 1 < args.length &&
            value !== undefined &&
            !isFlagLike(value) &&
            value !== "--"
          ) {
            index += 1;
            if (allowed) result.push(value);
          }
        } else {
          while (
            index + 1 < args.length &&
            !isFlagLike(args[index + 1]) &&
            args[index + 1] !== "--"
          ) {
            index += 1;
            if (allowed) result.push(args[index]);
          }
        }
      }
      index += 1;
      continue;
    }
    result.push(arg);
    index += 1;
  }
  return result;
}
