# Oracle Fork Specification

This file is the source of truth for the current requirements of this fork. It describes the
required end state, not the history of how the project reached it. Version notes and change logs
belong in `CHANGELOG.md`, not here.

When this file conflicts with upstream defaults or general documentation, this file governs the
fork. Upstream refreshes must reapply and verify every requirement below.

## Project purpose

- Keep Oracle's core CLI, browser automation, Gemini integration, tests, and documentation aligned
  with the latest upstream source wherever that does not conflict with this specification.
- Provide one globally linked local Oracle build that Hermes, OpenClaw, direct CLI users, and MCP
  callers can resolve consistently.
- Preserve deterministic session artifacts and upstream-compatible behavior outside the explicit
  fork policies below.

## Mandatory browser execution policy

- Every root CLI run must behave as though `--engine browser --manual-browser-login` were appended
  after all user, environment, and configuration arguments. `--manual-login`, `--manual-browser-login`,
  and `--browser-manual-login` are compatible spellings of the same required behavior.
- Browser runs must reuse only the persistent signed-in profile at `~/.oracle/browser-profile`.
  Legacy profile-selection, cookie-injection/copy, attach-running, remote-Chrome, and browser-tab
  CLI options must be silently consumed and ignored at every command entry point: they must not
  print a notice, report an error, block, or stop the task. Equivalent environment, configuration,
  MCP, remote, and stored-session inputs must also be discarded without changing this path or
  bypassing default manual login.
- `--copy-profile` and the other ignored compatibility options must not be exposed in CLI help.
  Low-level configuration must clear every copied-profile, cookie, attach, remote-Chrome, and tab
  source so CLI, MCP, remote, and reattach paths cannot activate one indirectly.

## Root CLI argument whitelist

- Root `oracle` runs accept only the consultation surface: the prompt
  (`-p/--prompt`, `--message`, or the positional prompt), attached files
  (`-f/--file` plus `--include`, `--files`, `--path`, `--paths`), the AI/model
  selection (`-m/--model`, `--models`), the output/download paths
  (`--write-output`, `--output`), the engine/manual-login flags, `--dry-run`,
  the `--perf-trace` diagnostics, the internal session plumbing
  (`--exec-session`, `--session`, `--status`), and meta flags (`--help`,
  `--version`, `--debug-help`).
- Every other root flag is silently discarded together with its values: no
  notice, no error, no exit-code change, no dependence on whether the caller
  passes it. This includes effort, follow-up, research, archive, render/copy,
  notification, timeout, provider, profile, cookie, attach, remote-Chrome, and
  browser-tab flags. New upstream root flags default to discarded until they
  are deliberately allowlisted here.
- Session management and service subcommands (`status`, `session`, `serve`,
  `doctor`, `tui`, and the rest) keep their full option sets.
- When no model comes from the CLI, saved configuration, or a multi-model
  list, root runs default to `--model latest` with Medium effort (the
  `standard` thinking level, which clicks ChatGPT's Medium label) instead of
  upstream's `gpt-5.5-pro` default.
- `ORACLE_ALLOW_API_ENGINE=1` bypasses the model default, the browser forcing,
  and the whitelist. The escape hatch exists solely so upstream's API
  integration tests can exercise their original surface.

## Queueing and concurrency

- Oracle browser work uses one shared execution slot per persistent profile.
- At most one task may run at a time. Additional tasks must remain queued until the active task
  releases the slot.
- Queue waiting has no timeout, prints nothing about the wait, and never
  rejects a run: identical prompts are queued behind the active run instead of
  being blocked by the duplicate-prompt guard. Configuration or remote input
  must not raise the concurrency limit or introduce a finite queue timeout.
- Success, failure, cancellation, and reattach completion must all release the slot.

## ChatGPT model selection and blocking notices

- A visible blocking notice with a safe confirmation control such as `Got it` must be dismissed
  when it prevents the model selector from being read.
- After dismissing the notice, Oracle must rescan the model selector once. Recovery must be bounded
  so a persistent or changing page cannot cause an infinite dismissal loop.
- A `Too many requests` notice is not, by itself, a fatal Oracle error and must not be promoted to a
  `chatgpt-throttled` failure.
- If model selection still fails for any reason, Oracle must silently skip model selection and use
  the model currently active in the ChatGPT page. Prompt submission and answer capture must
  continue normally.
- Notice dismissal, rescanning, and current-model fallback must not print CLI log messages. The
  fallback may remain in structured session metadata as unverified, skipped model evidence.

## Browser lifecycle

- Oracle-owned browser targets must close after a completed run.
- Reattach must close the recovered Oracle-owned target after harvesting the final answer or image.
- If reattach launches a replacement browser, that browser must close during final cleanup.
- Cleanup must not close an explicitly attached user tab, a Cloudflare challenge retained for
  manual intervention, or a sibling task's active target.

## ChatGPT image submission

- Image requests must use the normal assistant-response completion path. Oracle must not poll for
  an image to appear or keep a task alive solely to detect image presence.
- After the normal response completes, Oracle may make one immediate artifact scan and download an
  image that is already present. If none is present, it must return or fail immediately rather than
  starting an image-specific wait loop.

## Global build and runtime resolution

- The global `oracle` executable must resolve to this repository's `dist/bin/oracle-cli.js`.
- TypeScript source changes require `pnpm build` before global verification because the linked
  command executes `dist/`.
- Verify both NVM and Homebrew command locations when present, plus the effective PATH used by
  Hermes and OpenClaw LaunchAgents.
- A successful `npm link` alone is not sufficient evidence; resolve the final executable symlink or
  real path from each runtime environment.

## Required validation

- Add or update focused tests for each changed policy.
- Run formatting, linting, type checking, build, relevant targeted tests, and the full test suite.
- Browser changes should receive live ChatGPT and Gemini smoke tests when account and service state
  permit. External service limits must be reported accurately and must not be confused with local
  code failures.
- Do not push changes that are subject to an explicit user requirement that all named live tests
  pass until those tests have passed.

## Specification maintenance

- Read this file in full before developing, modifying, refactoring, or optimizing project code.
- When requirements change, update this file in the same work so it continues to describe the
  current desired system.
- Edit existing requirements instead of appending dated amendments or version-by-version history.
- Keep implementation history, release notes, migration notes, and dated changes in
  `CHANGELOG.md` or commit history.
