---
title: Coding Agents
description: "Use Oracle from Claude Code, Codex, Cursor, and any other coding agent — as a CLI, as an MCP server, or as a one-shot skill."
---

Oracle is built to be called _by_ coding agents as much as by humans. The flow is always the same: the agent gathers context, hands the bundle to ChatGPT, and gets a second opinion back. In this fork, a model-free root call selects ChatGPT Latest with Medium effort.

## The 30-second wiring

Drop this into the project's `AGENTS.md` or `CLAUDE.md`:

```
- Oracle bundles a prompt plus the right files so ChatGPT Latest can answer with
  real repo context. Use when stuck,
  debugging hard bugs, doing architecture review, or cross-validating a plan.
- Run the globally linked `oracle --help` once per session before first use.
- Do not pass `--model` or a thinking-effort flag unless the user explicitly
  requests a non-default target.
```

That's enough for most agents to discover and use Oracle correctly. The patterns below cover the deeper integrations.

For explicit API/browser/render selection and per-run model/effort provenance,
use the optional `skills/oracle-advisor` companion skill instead. It reuses the
existing backends and does not implement native desktop delegation. See
[Advisory consultations](advisor.md) for its capability boundary and result
contract. The existing `skills/oracle` workflow remains available unchanged.

## Claude Code

### As an MCP server (recommended)

```bash
oracle bridge claude-config --local-browser > .mcp.json
```

That writes a `.mcp.json` configured for the local browser path, so Claude Code can call `oracle.consult` and `oracle.sessions` without any API keys. Omit `model`, `preset`, and thinking-effort inputs to use Latest with Medium effort. Add `dryRun: true` to inspect the resolved bundle before sending; use `preset: "chatgpt-pro-heavy"` only when the user explicitly requests the legacy GPT-5.5 Pro target.

See [MCP](mcp.md) for connection details and other clients.

### As a skill

Copy the bundled skill into the agent's shared skill directory. Existing
host-specific copies must be refreshed too, because an older copy can keep
passing an explicit GPT-5.5 model and override the CLI default:

```bash
for root in ~/.agents/skills ~/.claude/skills ~/.codex/skills ~/.openclaw/skills; do
  mkdir -p "$root/oracle"
  rsync -a --delete skills/oracle/ "$root/oracle/"
done
```

Then reference `oracle` in `CLAUDE.md`. Claude Code will load `SKILL.md` whenever the trigger conditions match (debugging, refactor, design check).

### As a slash command

Alias Oracle behind a custom `/consult` command only through the globally linked local executable,
using the required `oracle --manual-login --engine browser …` prefix. Browser tasks share the fixed
persistent profile and queue one at a time.

## Codex

Codex can use the same shared skill. If the installation expects a Codex-local
copy instead, install the repository version there:

```bash
mkdir -p ~/.codex/skills
cp -R skills/oracle ~/.codex/skills/oracle
```

Then reference it in `AGENTS.md`. Codex will pick it up automatically.

For Codex slash prompts, drop a wrapper in `~/.codex/prompts/oracle.md` that
calls the globally linked `oracle` command without a model unless the user asks
for a specific target.

## Cursor

Cursor speaks MCP. Drop a `.cursor/mcp.json` like:

```json
{
  "oracle": {
    "command": "oracle-mcp",
    "args": []
  }
}
```

Or use the [one-click install](https://cursor.com/en-US/install-mcp?name=oracle&config=eyJjb21tYW5kIjoibnB4IC15IEBzdGVpcGV0ZS9vcmFjbGUgb3JhY2xlLW1jcCJ9). The `oracle` source then shows up in Cursor's MCP picker.

## Generic CLI usage from any agent

When the agent has shell access, the simplest hand-off is a direct call:

```bash
oracle -p "$TASK" --file "$RELEVANT_FILES"
```

The fork forces the persistent manual-login browser path and defaults to Latest
with Medium effort. No API key or model flag is needed.

For autonomous dry-runs, use the JSON preview to inspect the resolved bundle before spending model time:

```bash
oracle --dry-run json -p "$TASK" --file "$RELEVANT_FILES"
```

Completed runs persist answers, usage, cost, session ids, model choices, and lineage under `~/.oracle/sessions/<id>/`. Exit code is non-zero on failure.

## Multi-agent shared profile (browser mode)

When multiple agents share the signed-in fixed profile, Oracle queues browser tasks instead of
running them concurrently. The compatibility concurrency flag cannot raise this limit. Timing knobs
still available for launch recovery include:

- `--browser-max-concurrent-tabs` — accepted for compatibility; effective value is always 1.
- `--browser-profile-lock-timeout` — wait for the profile lock before sending.
- `--browser-reuse-wait` — wait for a shared Chrome profile before launching.

All callers use `~/.oracle/browser-profile`; profile, cookie, existing-tab, attach-running, and
remote-Chrome overrides are silently ignored. See [Browser Mode](browser-mode.md).

## Cost / safety hygiene

- **Always preview Pro runs.** `--dry-run summary --files-report` before a Pro API call on a large bundle. Token counts are a close-enough proxy for dollars.
- **Cap file size.** `~/.oracle/config.json` → `maxFileSizeBytes`, or `ORACLE_MAX_FILE_SIZE_BYTES`. Default is 1 MB per file.
- **Excludes are your friend.** `--file "src/**" --file "!**/*.test.ts" --file "!**/*.snap"` cuts most fixtures.
- **API mode runs cost real money.** If your agent runs Oracle autonomously, scope it: pin `--model`, set `--timeout`, and review the session log. Many users gate API mode behind explicit user consent and let browser mode run free.

## Patterns that work

- **Stuck → Oracle.** When the agent has been spinning on the same bug for 3+ turns, hand the failing test plus the involved files to GPT-5.5 Pro. It often spots the issue in one round.
- **Plan → Oracle → execute.** Draft the plan, ask Claude Opus or Gemini 3 Pro to challenge it, then implement.
- **Refactor → cross-check.** After a non-trivial refactor, send the diff plus the spec to a different provider than the one that wrote the diff. Catches drift fast.
- **Followup chain.** Use `--followup <id>` to keep one Pro session alive across iterations rather than re-bundling the whole repo every time. See [Followup](followup.md).
