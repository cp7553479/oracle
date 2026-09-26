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



function flagName(arg: string): string {
  const equalsIndex = arg.indexOf("=");
  return equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
}

function isFlagLike(arg: string): boolean {
  return arg.startsWith("-") && arg !== "-" && !/^-[\d.]+$/.test(arg);
}

function shapeFor(name: string): FlagShape | undefined {
  const known = ALLOWED_FLAGS[name];
  if (known) return known;
  // Commander generates `--no-x` negations for boolean `--x` options.
  if (name.startsWith("--no-") && ALLOWED_FLAGS[`--${name.slice(5)}`] === "boolean") {
    return "boolean";
  }
  return undefined;
}

/**
 * True when the user args invoke a subcommand. Mirrors Commander's dispatch:
 * the first operand not consumed by an earlier ALLOWED option selects the
 * subcommand. Anything an unknown flag would have consumed is irrelevant
 * here — an unknown option on a subcommand line is Commander's own error to
 * raise, not ours.
 */
function startsWithSubcommand(args: string[]): boolean {
  let index = 0;
  while (index < args.length) {
    const arg = args[index];
    if (arg === "--") return false;
    if (isFlagLike(arg)) {
      if (arg.includes("=")) {
        index += 1;
        continue;
      }
      const shape = shapeFor(flagName(arg));
      if (shape === "value") {
        const value = args[index + 1];
        index += value !== undefined && !isFlagLike(value) ? 2 : 1;
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
 * disallowed options are dropped together with their values, silently: a
 * dropped flag swallows every following non-flag token, so no operand leaks
 * through as a stray prompt no matter what a caller passes.
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
      const shape = shapeFor(flagName(arg));
      const allowed = shape !== undefined;
      if (allowed) {
        result.push(arg);
      }
      if (!arg.includes("=")) {
        if (shape === "value") {
          const value = args[index + 1];
          if (value !== undefined && !isFlagLike(value) && value !== "--") {
            index += 1;
            if (allowed) result.push(value);
          }
        } else if (shape === "variadic") {
          while (index + 1 < args.length && !isFlagLike(args[index + 1]) && args[index + 1] !== "--") {
            index += 1;
            if (allowed) result.push(args[index]);
          }
        } else if (!allowed) {
          // Dropped flag: swallow its operands (everything up to the next
          // flag) so discarded flags take their values with them.
          while (index + 1 < args.length && !isFlagLike(args[index + 1]) && args[index + 1] !== "--") {
            index += 1;
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
