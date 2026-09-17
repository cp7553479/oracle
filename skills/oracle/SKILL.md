---
name: oracle
description: "Oracle second-model review: bundle prompts/files, debug, refactor, design."
---

# Oracle (CLI) — best use

Oracle bundles a prompt and selected files into a one-shot request so another
model can answer with real repository context through the browser. A prompt is
required; attach files only when they add necessary context. Treat responses as
advisory and verify them against the codebase and tests.

## Fork execution policy

Use the globally linked local executable (`oracle`). Never use registry
`npx`/`pnpm dlx` commands or `--copy-profile`.

- Every root run is forced onto the persistent manual-login browser path;
  `--engine browser` and the manual-login behavior are applied automatically.
  Passing `--engine browser`, `--manual-login`, or `--browser-manual-login`
  explicitly is accepted but never changes the outcome.
- Only one browser task runs at a time. Additional calls are queued silently —
  they are never rejected — until the active task releases the single slot.
  Identical prompts queue too; reattach to a stored session instead of
  submitting duplicates.
- Oracle closes the browser it launched when the run finishes, is cancelled, or
  is reattached and harvested.
- Root runs accept only this flag surface: the prompt (`-p/--prompt`,
  `--message`, or a positional prompt), attached files (`-f/--file` and its
  `--include/--files/--path/--paths` aliases), the AI/model selection
  (`-m/--model`, `--models`), the output/download paths (`--write-output`,
  `--output`), the engine/manual-login flags above, `--dry-run`, and the
  `--perf-trace` diagnostics. Every other root flag — including legacy profile,
  cookie, attach-running, remote-Chrome, browser-tab, thinking-time,
  follow-up/research, archive, render/copy, notify, and timeout flags — is
  silently discarded without a warning or error. Do not pass them and do not
  rely on them.
- Session management subcommands (`oracle status`, `oracle session <id>`,
  `oracle serve`, `oracle doctor`, ...) keep their full option sets.

## Main use case (browser, GPT-5.6)

Use browser mode with GPT-5.6 when the ChatGPT account exposes it. GPT-5.6 Sol
is the base target; Pro is handled as a separate picker target for difficult or
long-running work and is reached with `--model gpt-5-pro`.

Recommended defaults:

- Engine: browser (forced; `--engine browser` optional)
- Base Sol: `--model gpt-5.6-sol`
- Maximum reasoning: `--model gpt-5-pro`
- Fallback: explicitly use `--model gpt-5.5-pro` when GPT-5.6 is unavailable
- Attachments: directories/globs plus excludes; never attach secrets by default

Reasoning effort and picker strategy are decided by Oracle's defaults; callers
cannot steer them with flags in this fork.

GPT-5.6 availability is account-dependent. Confirm the base Sol picker and
retain model-selection evidence. A bare `Pro` picker label proves picker
selection but does not, by itself, prove the server-side Pro generation.

## GPT-5.6 model selection

- `gpt-5.6`: follow the GPT-5.6 family default
- `gpt-5.6-sol`: pin ChatGPT's `GPT-5.6 Sol` entry
- Browser: `gpt-5-pro` selects ChatGPT's `Pro` target

For base Sol, use:

```bash
oracle --model gpt-5.6-sol -p "<task>" --file "src/**"
```

Do not use `--model "GPT-5.6 Sol Pro"`. Pro is intentionally handled as a
browser picker target. Browser label validation rejects unknown future
variants such as `gpt-5.6-luna` instead of silently falling back to Sol.

Browser mode maps these aliases to ChatGPT's Sol picker. The picker
verification recognizes the current English, Chinese, and Korean Latest/effort
labels, avoids matching `高` inside `极高`, and re-queries the composer pill
after React replaces it so selection verification cannot rely on a detached
stale node.

## Compatibility with npm 0.15.2

Do not invoke an unpatched registry release from this fork. Use the globally
linked local executable and fall back to `--model gpt-5.5-pro` if necessary.

## Golden path

1. Pick the smallest file set that still contains the truth.
2. Preview the bundle with `--dry-run`.
3. Pass the prompt, files, and model only.
4. If a run detaches or times out, reattach to the stored session instead of
   starting a duplicate.

## Commands

- Show help:
  - `oracle --help`

- Preview without calling a model:
  - `oracle --dry-run summary -p "<task>" --file "src/**" --file "!**/*.test.*"`
  - `oracle --dry-run full -p "<task>" --file "src/**"`

- Browser run:
  - `oracle --model gpt-5.6-sol -p "<task>" --file "src/**"`

- Write the answer to a file:
  - `oracle --model gpt-5.5-pro -p "<task>" --file "src/**" --write-output /tmp/answer.md`

- Performance trace:
  - `oracle --perf-trace --perf-trace-path /tmp/oracle-perf.json --dry-run summary -p "<task>" --file "src/**"`

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

Keep total input under roughly 196k tokens. Use `--dry-run json` to identify
oversized inputs. Never attach `.env` files, private keys, auth tokens, or
other secrets unless they have been redacted and are essential to the question.

## Engines and browser controls

- This fork's root CLI always selects browser/manual-login regardless of
  `OPENAI_API_KEY`.
- Browser supports GPT models through ChatGPT and Gemini models through Gemini
  web. API-only models include `gpt-5.1-codex` and Claude models; they are
  routed through the API automatically when requested with `--model`.
- Current model families include GPT-5.6/5.5/5.4/5.2/5.1, Gemini 3.x, and
  Claude 4.x; availability depends on the signed-in accounts.
- File delivery (inline paste vs native upload) and upload bundling are chosen
  automatically by Oracle; callers cannot steer them with flags in this fork.
- Oracle always launches or recovers its fixed persistent browser profile;
  callers cannot select a different profile, cookie source, existing tab,
  attached browser, or remote Chrome endpoint.
- Model-picker behavior defaults to selecting the requested model and silently
  falls back to ChatGPT's current model when selection cannot be verified.

## Sessions and recovery

- Sessions are stored under `~/.oracle/sessions`; override with
  `ORACLE_HOME_DIR`.
- Browser artifacts include `transcript.md` and, when available, research
  reports and generated images.
- List recent sessions with `oracle status --hours 72`.
- Attach with `oracle session <id> --render`.
- If a run times out, reattach; do not re-run it. Identical prompts queue
  behind the active run instead of being rejected.
- Successful non-project browser one-shots are archived automatically by
  default.

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
