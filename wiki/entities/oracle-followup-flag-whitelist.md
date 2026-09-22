---
type: Entity
id: entity.oracle-followup-flag-whitelist
pageType: entity
title: Oracle Fork Followup Flag Whitelist
summary: Browser-native conversation-continuation flags that must survive upstream refreshes in the cp7553479/oracle fork.
description: Browser-native conversation-continuation flags that must survive upstream refreshes in the cp7553479/oracle fork.
keywords:
  - oracle-fork
  - followup
  - browser-engine
  - whitelist
  - upstream-refresh
createdAt: "2026-09-20T04:15:09Z"
updatedAt: "2026-09-22T14:33:43Z"
status: stable
privacyTier: local-private
sources:
  - resource: https://github.com/cp7553479/oracle
    title: cp7553479/oracle fork
    kind: repository
relationships:
  - type: governed-by
    target: SPEC.md#mandatory-browser-execution-policy
  - type: implemented-by
    target: src/cli/browserProfilePolicy.ts#PRESERVED_FOLLOWUP_FLAGS
---

# Oracle Fork Followup Flag Whitelist

Established 2026-09-20 (commit `eef22e8f`) while merging upstream
`1866b146` (0.21.2-unreleased).

## Policy

- The fork forces `--engine browser` + the persistent manual-login profile
  (`~/.oracle/browser-profile`) for every CLI run; the API engine is reachable
  only through the test escape hatch `ORACLE_ALLOW_API_ENGINE=1`.
- Whitelisted continuation flags (exported as `PRESERVED_FOLLOWUP_FLAGS` in
  `src/cli/browserProfilePolicy.ts`):
  - `--followup <sessionId|slug>` — continues a saved ChatGPT **browser**
    session by reopening its saved conversation (`resolveBrowserFollowupReference`
    in `src/cli/followup.ts`); inherits the parent session's model.
  - `--browser-follow-up <prompt>` — repeatable, queues planned same-run turns;
    browser-only by design.
- Both must remain functional through every upstream refresh; upstream merges
  must not strip or repurpose them.

## Non-functional pass-through

- `--followup-model` is consumed only by the API lineage branch (multi-model API
  parents via `resolveFollowupReference` / `extractResponseIdFromSession`).
  Browser follow-ups inherit the parent's stored model directly, so in this fork
  the flag is a silent pass-through with no browser effect.

## Fail-closed contract

- API-only references (`resp_<id>` values, API parent sessions) fail closed
  without the escape hatch with `--followup requires --engine api`. This is
  intended fork behavior, not a bug.

## Locking tests

- `tests/cli/browserProfilePolicy.test.ts` — flags and values pass
  `stripDisabledBrowserProfileArgs` unchanged; the exported whitelist constant
  is contract-checked.
- `tests/cli/integrationCli.test.ts` ("continues a saved browser session with
  --followup under the forced engine") — a browser parent fixture continues in
  browser mode with inherited model; a `resp_` reference exits non-zero with the
  engine-requirement error.

## Specification anchors

- `SPEC.md` → "Mandatory browser execution policy" (whitelist requirement).
- `AGENTS.md` → manual-login hard-requirement bullet (mirror rule sentence).
- `docs/followup.md` → fork note in the opening section.

## Related model policy (2026-09-20, later same day)

- Model-free browser calls from the root CLI, MCP/Agent integrations, and the
  remote browser service resolve to ChatGPT `Latest` (`gpt-6-astra`) with
  Medium (`standard`) effort. Explicit model choices still win, and the API
  escape hatch retains upstream's `gpt-5.5-pro` default.
- Gemini Flash target renamed to `gemini-3.6-flash` (canonical); `gemini-3.5-flash`
  input is upgraded to it at CLI resolution and at the Gemini web model layer.
- No-stall rule generalized in SPEC "ChatGPT model selection and blocking
  notices": an unrecognized or unavailable model never blocks a run — browser
  flows continue on the page's default/current model; Gemini web falls back to
  its supported default (`gemini-3.1-pro`) and to `gemini-3.1-flash-lite` when
  the selected model is unavailable.
- Single-slot queue re-verified live: second concurrent run queued silently and
  executed after the first released the slot; no rejection, no timeout.
