---
name: oracle
description: "Run the locally linked Oracle CLI for second-model review, debugging, refactoring, design, and repository analysis. Use browser mode only through the persistent manual-login profile."
---

# Oracle CLI

Oracle bundles a prompt and selected files into a one-shot browser request so
another model can review the task with real repository context. Treat its
response as advisory and verify it against the codebase and tests.

## Mandatory invocation prefix

Use browser mode with GPT-5.6 when the ChatGPT account exposes it. GPT-5.6 Sol
and GPT-5.6 Sol Pro are distinct targets: base Sol uses the Extra High effort
setting, while Pro is a separate picker target for difficult or long-running
work.

Recommended defaults:

- Engine: browser (`--engine browser`)
- Base Sol: `--model gpt-5.6-sol`
- Base Sol maximum reasoning: `--browser-thinking-time extra-high` (Extra High)
- Explicit Pro effort on GPT-5.6 Sol: `--browser-thinking-time pro` (fails closed if Pro cannot be confirmed)
- Browser GPT-5.5 with Pro effort: `--model gpt-5.5 --browser-thinking-time pro`
- API Pro maximum reasoning: `--model gpt-5.6-sol --reasoning-mode pro --reasoning-effort max`
- Fallback: explicitly use `--model gpt-5.5-pro` when GPT-5.6 is unavailable
- Attachments: directories/globs plus excludes; never attach secrets by default

GPT-5.6 availability is account-dependent. Confirm the base Sol picker and
retain model-selection evidence. A bare `Pro` picker label proves picker
selection but does not, by itself, prove the server-side Pro generation.

## GPT-5.6 model selection

This version supports GPT-5.6 on both surfaces, but Pro selection differs:

- `gpt-5.6`: follow the GPT-5.6 family default
- `gpt-5.6-sol`: pin ChatGPT's `GPT-5.6 Sol` entry
- Browser: `gpt-5-pro` selects ChatGPT's `Pro` target
- API: `--reasoning-mode pro` enables Pro execution on `gpt-5.6-sol`; pair it with `--reasoning-effort max` for maximum reasoning

For base Sol, use:

```bash
oracle --engine browser --browser-manual-login --model gpt-5.6-sol \
  --browser-thinking-time extra-high \
  -p "<task>" --file "src/**"
```

For GPT-5.6 Sol Pro through the Responses API, use:

```bash
oracle --engine api --model gpt-5.6-sol \
  --reasoning-mode pro \
  --reasoning-effort max \
  -p "<task>" --file "src/**"
```

Do not use `--model "GPT-5.6 Sol Pro"`. Pro is intentionally handled as a
browser picker target and an API reasoning mode. Browser label validation rejects unknown future
variants such as `gpt-5.6-luna` instead of silently falling back to Sol; API
runs preserve such provider model IDs unchanged.

Browser mode maps these aliases to ChatGPT's Sol picker. API and multi-model
runs preserve the corresponding first-party OpenAI model IDs; provider-qualified
and unrelated custom IDs remain pass-through values.

The GPT-5.6 browser support depends on the unified Intelligence picker. It
recognizes the current English and Chinese effort labels, avoids matching
`高` inside `极高`, and re-queries the composer pill after React replaces it so
selection verification cannot rely on a detached stale node.

## Compatibility with npm 0.15.2

Do not pass `gpt-5.6` or `gpt-5.6-sol` to an unpatched npm 0.15.2 install. That
release can normalize those labels to `gpt-5.2`. Use the explicit fallback:
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

After upgrading to a release containing the GPT-5.6 model-selection and
unified-picker changes, verify all of the following before removing the
fallback guidance: `--help --verbose` exposes the new options, browser dry-run
resolves both aliases to GPT-5.6 Sol, API routing selects first-party OpenAI,
and a live browser run records strict GPT-5.6 selection evidence.

## Golden path

1. Pick the smallest file set that still contains the truth.
2. Preview the bundle with `--dry-run` and `--files-report`.
3. Use browser mode for GPT-5.6; use API only when explicitly intended.
4. If a run detaches or times out, reattach to the stored session instead of
   starting a duplicate.

## Commands

- Show help:
  - `npx -y @steipete/oracle --help --verbose`

- Preview without calling a model:
  - `npx -y @steipete/oracle --dry-run summary -p "<task>" --file "src/**" --file "!**/*.test.*"`
  - `npx -y @steipete/oracle --dry-run full -p "<task>" --file "src/**"`

- Inspect token usage:
  - `npx -y @steipete/oracle --dry-run summary --files-report -p "<task>" --file "src/**"`

- Browser run:
  - `oracle --engine browser --browser-manual-login --model gpt-5.6-sol --browser-thinking-time extra-high -p "<task>" --file "src/**"`

- Manual paste fallback:
  - `npx -y @steipete/oracle --render-markdown --copy-markdown -p "<task>" --file "src/**"`
  - `--render` is an alias for `--render-markdown`.

- Performance trace:
  - `npx -y @steipete/oracle --perf-trace --perf-trace-path /tmp/oracle-perf.json --dry-run summary -p "<task>" --file "src/**"`

## Attaching files

`--file` accepts files, directories, and globs. Pass it multiple times or use
comma-separated entries.

- Include: `--file "src/**"`, `--file src/index.ts`, `--file docs --file README.md`
- Exclude: prefix a pattern with `!`, for example `--file "!src/**/*.test.ts"`
- Default ignored directories: `node_modules`, `dist`, `coverage`, `.git`,
  `.turbo`, `.next`, `build`, and `tmp`
- Globs honor `.gitignore` and do not follow symlinks.
- Dotfiles require an explicit dot-segment in the pattern, such as
  `--file ".github/**"`.
- Files over 1 MB are rejected by default; configure
  `ORACLE_MAX_FILE_SIZE_BYTES` or `maxFileSizeBytes` when necessary.

Keep total input under roughly 196k tokens. Use `--files-report` or
`--dry-run json` to identify oversized inputs. Never attach `.env` files,
private keys, auth tokens, or other secrets unless they have been redacted and
are essential to the question.

## Engines and browser controls

- Auto-selection uses API when `OPENAI_API_KEY` is set and browser otherwise.
- Browser supports GPT models through ChatGPT and Gemini models through Gemini
  web. API-only models include `gpt-5.1-codex`.
- Current model families include GPT-5.5/5.4/5.2/5.1, Gemini 3.x, and Claude
  4.x; availability depends on engine and provider.
- API runs require explicit user consent because they may incur usage costs.
- Browser attachments use `--browser-attachments auto|never|always`.
- For many files, add `--browser-bundle-files --browser-bundle-format auto|zip`.
- Reuse an existing Chrome session with `--browser-tab <ref>`,
  `--browser-attach-running`, or `--remote-chrome <host:port>`.
- Use `--browser-model-strategy select|current|ignore` to control picker
  behavior.
- Use `--browser-follow-up "<prompt>"` for another turn in the same browser
  conversation, or `--followup <sessionId|responseId>` for a stored run.
- Use `--browser-research deep` only when Deep Research is explicitly wanted.

## API preflight

Before an API run, check provider readiness without printing secrets:
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
