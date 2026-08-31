---
name: oracle
description: "Oracle second-model review: bundle prompts/files, debug, refactor, design."
---

# Oracle (CLI) — best use

Oracle bundles a prompt and selected files into a one-shot request so another
model can answer with real repository context through the API or browser. A
prompt is required; attach files only when they add necessary context. Treat
responses as advisory and verify them against the codebase and tests.

## Fork execution policy

Use the globally linked local executable. Every invocation must begin with:

```bash
oracle --manual-login --engine browser
```

The CLI enforces the equivalent persistent manual-login browser configuration
internally. Never use registry `npx`/`pnpm dlx` commands or `--copy-profile`.
Only one browser task runs at a time; later calls wait in the browser queue.
Reattach harvesting closes its recovered target/browser when finished.

## Main use case (browser, GPT-5.6)

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

Do not invoke an unpatched registry release from this fork. Use the globally
linked local executable and fall back to `--model gpt-5.5-pro` if necessary.

After upgrading to a release containing the GPT-5.6 model-selection and
unified-picker changes, verify all of the following before removing the
fallback guidance: `--help --verbose` exposes the new options, browser dry-run
resolves both aliases to GPT-5.6 Sol, API routing selects first-party OpenAI,
and a live browser run records strict GPT-5.6 selection evidence.

## Golden path

1. Pick the smallest file set that still contains the truth.
2. Preview the bundle with `--dry-run` and `--files-report`.
3. Use the mandatory manual-login/browser prefix.
4. If a run detaches or times out, reattach to the stored session instead of
   starting a duplicate.

## Commands

- Show help:
  - `oracle --manual-login --engine browser --help --verbose`

- Preview without calling a model:
  - `oracle --manual-login --engine browser --dry-run summary -p "<task>" --file "src/**" --file "!**/*.test.*"`
  - `oracle --manual-login --engine browser --dry-run full -p "<task>" --file "src/**"`

- Inspect token usage:
  - `oracle --manual-login --engine browser --dry-run summary --files-report -p "<task>" --file "src/**"`

- Browser run:
  - `oracle --engine browser --browser-manual-login --model gpt-5.6-sol --browser-thinking-time extra-high -p "<task>" --file "src/**"`

- Manual paste fallback:
  - `oracle --manual-login --engine browser --render-markdown --copy-markdown -p "<task>" --file "src/**"`
  - `--render` is an alias for `--render-markdown`.

- Performance trace:
  - `oracle --manual-login --engine browser --perf-trace --perf-trace-path /tmp/oracle-perf.json --dry-run summary -p "<task>" --file "src/**"`

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

- This fork's root CLI always selects browser/manual-login regardless of `OPENAI_API_KEY`.
- Browser supports GPT models through ChatGPT and Gemini models through Gemini
  web. API-only models include `gpt-5.1-codex`.
- Current model families include GPT-5.5/5.4/5.2/5.1, Gemini 3.x, and Claude
  4.x; availability depends on engine and provider.
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

```bash
oracle doctor --providers --models gpt-5.4,claude-4.6-sonnet,gemini-3-pro
oracle --preflight --models gpt-5.4,gemini-3-pro
oracle --route --model gpt-5.4
```

Use `--provider openai` or `--no-azure` when first-party OpenAI routing is
required. For multi-model panels where partial success is useful, use
`--allow-partial --write-output <path>` so successful outputs and the manifest
can be recovered.

Set an explicit deadline for automation, for example `--timeout 10m`; Oracle
derives the HTTP timeout unless `--http-timeout` is supplied.

## Sessions and recovery

- Sessions are stored under `~/.oracle/sessions`; override with
  `ORACLE_HOME_DIR`.
- Browser artifacts include `transcript.md` and, when available, research
  reports and generated images.
- List recent sessions with `oracle status --hours 72`.
- Attach with `oracle session <id> --render`.
- Use `--slug "<3-5 words>"` for readable session IDs.
- If a run times out, reattach; do not re-run it. Use `--force` only when a
  genuinely new identical run is intended.
- Successful non-project browser one-shots are archived automatically by
  default; override with `--browser-archive never|always`.

## Prompt template

Oracle starts with zero project knowledge. Include:

- Project briefing: stack, services, build/test commands, and platform constraints
- Where things live: entrypoints, configs, key modules, and dependency boundaries
- Exact question, prior attempts, and verbatim error text
- Constraints such as API compatibility, performance budgets, and files not to change
- Desired output such as a patch plan, tests, risk list, or tradeoff comparison

For a long investigation, make the prompt restorable: put a 6–30 sentence
briefing at the top, concrete reproduction and errors in the middle, and attach
all context files required by a fresh model at the bottom. Oracle runs are
one-shot; the model does not remember prior runs.
