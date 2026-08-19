---
name: oracle
description: "Run the locally linked Oracle CLI for second-model review, debugging, refactoring, design, and repository analysis. Use browser mode only through the persistent manual-login profile."
---

# Oracle CLI

Oracle bundles a prompt and selected files into a one-shot browser request so
another model can review the task with real repository context. Treat its
response as advisory and verify it against the codebase and tests.

## Mandatory invocation prefix

Every Oracle command MUST begin with this exact prefix:

```bash
oracle --manual-login --engine browser
```

This requirement applies to normal runs, previews, help, diagnostics, status,
session reattachment, Project Sources, and every Hermes profile.

- Always use the globally linked local `oracle` executable.
- Always pass both `--manual-login` and `--engine browser` explicitly.
- Never use `npx`, `pnpm dlx`, a registry-pinned Oracle package, or a direct
  registry package executable.
- Never use `--engine api`, `--copy-profile`, `--no-manual-login`, or omit the
  mandatory prefix.
- Reuse the persistent signed-in profile at `~/.oracle/browser-profile` unless
  `ORACLE_BROWSER_PROFILE_DIR` or `--browser-manual-login-profile-dir` selects
  another persistent manual-login profile.

## Recommended browser models

- Default: `--model gpt-5.6-sol`
- Maximum base-Sol reasoning: `--browser-thinking-time heavy`
- Pro: `--model gpt-5-pro` without a thinking-time flag
- Fallback when GPT-5.6 is unavailable: `--model gpt-5.5-pro`

Do not use `--model "GPT-5.6 Sol Pro"`. Pro is a distinct picker target.
Model availability is account-dependent, so preserve model-selection evidence.

## Workflow

1. Choose the smallest file set that contains the truth.
2. Preview the bundle before any long browser run.
3. Run Oracle in browser mode with the mandatory prefix.
4. If a run detaches or times out, reattach to its stored session instead of
   starting a duplicate.
5. Verify Oracle's advice against source and tests.

## Commands

Show help:

```bash
oracle --manual-login --engine browser --help --verbose
```

Preview without submitting:

```bash
oracle --manual-login --engine browser --dry-run summary \
  -p "<task>" --file "src/**" --file "!**/*.test.*"

oracle --manual-login --engine browser --dry-run full \
  -p "<task>" --file "src/**"
```

Inspect per-file token usage:

```bash
oracle --manual-login --engine browser --dry-run summary --files-report \
  -p "<task>" --file "src/**"
```

Run GPT-5.6 Sol in ChatGPT:

```bash
oracle --manual-login --engine browser --model gpt-5.6-sol \
  --browser-thinking-time heavy \
  -p "<task>" --file "src/**"
```

Run the explicit Pro target:

```bash
oracle --manual-login --engine browser --model gpt-5-pro \
  -p "<task>" --file "src/**"
```

Render the bundle for manual inspection:

```bash
oracle --manual-login --engine browser --render-markdown \
  -p "<task>" --file "src/**"
```

Write a performance trace for a preview:

```bash
oracle --manual-login --engine browser --perf-trace \
  --perf-trace-path /tmp/oracle-perf.json --dry-run summary \
  -p "<task>" --file "src/**"
```

List and reattach sessions:

```bash
oracle --manual-login --engine browser status --hours 72
oracle --manual-login --engine browser session <id> --render
```

Manage ChatGPT Project Sources:

```bash
oracle --manual-login --engine browser project-sources list \
  --chatgpt-url "<project-url>"

oracle --manual-login --engine browser project-sources add \
  --chatgpt-url "<project-url>" --file "docs/**"
```

## Files and context

- Pass `--file` multiple times or use comma-separated entries.
- Include files, directories, or globs; prefix exclusions with `!`.
- Default ignored directories include `node_modules`, `dist`, `coverage`,
  `.git`, `.turbo`, `.next`, `build`, and `tmp`.
- Globs honor `.gitignore`, do not follow symlinks, and require an explicit
  dot-segment such as `.github/**` for dotfiles.
- Files over 1 MB are rejected unless `ORACLE_MAX_FILE_SIZE_BYTES` or
  `maxFileSizeBytes` raises the limit.
- Keep total input under roughly 196k tokens. Use `--files-report` or
  `--dry-run json` to find oversized inputs.
- Never attach `.env` files, credentials, private keys, cookies, auth tokens,
  or other secrets unless essential and redacted.

## Prompt quality

Assume Oracle starts with no project knowledge. Include:

- stack, services, build commands, and platform constraints;
- entrypoints, configuration, and key module boundaries;
- the exact question, reproduction, prior attempts, and verbatim errors;
- constraints and files that must not change;
- the desired output, such as a patch plan, test cases, or tradeoff analysis.

For a long investigation, use a self-contained prompt with a short project
briefing, concrete reproduction details, and every required context file.

## Sessions and recovery

- Sessions live under `~/.oracle/sessions` unless `ORACLE_HOME_DIR` overrides
  the location.
- Use a readable 3-5 word `--slug` for long-running work.
- Reattach after timeout; do not start the same request again.
- Use `--force` only when a genuinely new duplicate run is intended.
- Never click ChatGPT's `Answer now` button during Pro thinking. Wait for the
  real assistant response or reattach to the saved session.
