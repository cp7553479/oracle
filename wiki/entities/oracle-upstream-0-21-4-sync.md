---
type: Entity
id: entity.oracle-upstream-0-21-4-sync
pageType: entity
title: Oracle Upstream 0.21.4 Sync Divergences
summary: Fork-vs-upstream decisions locked in while merging upstream 0.21.4 (Chat/Work layout); what to reapply on every future upstream refresh.
description: Fork-vs-upstream decisions locked in while merging upstream 0.21.4 (Chat/Work layout); what to reapply on every future upstream refresh.
keywords:
  - oracle-fork
  - upstream-refresh
  - keychain
  - manual-login
  - completion-gate
  - chatgpt-layout
createdAt: "2026-10-04T06:00:00Z"
updatedAt: "2026-10-04T06:00:00Z"
status: stable
privacyTier: local-private
sources:
  - resource: https://github.com/steipete/oracle
    title: steipete/oracle upstream
    kind: repository
  - resource: https://github.com/cp7553479/oracle
    title: cp7553479/oracle fork
    kind: repository
relationships:
  - type: governed-by
    target: SPEC.md#mandatory-browser-execution-policy
  - type: implemented-by
    target: src/browser/chromeLifecycle.ts#resolvePersistentChromeProfile
  - type: implemented-by
    target: src/browser/actions/completionAnnouncement.ts#COMPLETE_STATUS_PATTERN
---

# Oracle Upstream 0.21.4 Sync Divergences

Established 2026-10-04 while merging upstream `5dd3cd85` (0.21.4,
"ChatGPT Chat/Work layout") into the fork.

## Chrome launch policy (do not adopt upstream's migration)

- Upstream added `shouldUseNativeManualLoginKeychain` + a
  `.oracle-native-keychain-v1` marker file: only NEW macOS manual-login
  profiles (or marker opt-ins) launch with the native Keychain; existing
  profiles keep the launcher's mock-Keychain default flags.
- The fork rejects that mechanism entirely. Manual-login always launches
  bare (`ignoreDefaultFlags: true` for every non-copied profile, all
  platforms) with the real Keychain, and `resolveChromeLaunchOptions`
  keeps the 2-argument signature. If a refresh reintroduces the marker,
  the else-branch log ("Existing manual-login profile retains its saved
  Chrome login…") is misleading here and must not come back.
- `launchChrome` resolves the persistent profile's initialized
  `Local State` `profile.last_used` subprofile
  (`resolvePersistentChromeProfile`, validated against `info_cache`,
  realpath containment, and a readable `Preferences`) and passes
  `--profile-directory` for manual-login runs, so a signed-in
  non-`Default` subprofile is reused without copying account data.

## Completion gate merge rules

- The fork's triple rule (stop gone + composer send ready + debounced
  finished evidence + stable content) stays; upstream's
  `advanceCompletionAnnouncementGate` + tracked-announcement probes run
  in the same poll loop and only feed `isCompletionVisible`'s
  `allowPageStatus` fast path.
- The structural any-button fallback (2026-09 layout, no stable testids)
  must stay scoped: a button proves completion only when it lives
  outside message content (`pre, code, .markdown, [class*="MarkdownRoot"],
[data-markdown-text-style], [data-message-content],
[data-user-message-bubble]`) AND does not precede the assistant message
  root (`compareDocumentPosition & 2`). Without both, a streaming
  code-block copy button or an earlier message's action bar inside the
  same exchange completes a live answer (upstream regression tests cover
  exactly these).
- Dual-wording completion status ("Response complete" plus
  回复/回答/响应 + 已完成 variants) is exported as
  `COMPLETE_STATUS_PATTERN` (regex source string) from
  `src/browser/actions/completionAnnouncement.ts` and interpolated into
  both the tracker's `completeNode()` and
  `readPageResponseCompleteStatus`. Interpolate the source; a Node-side
  identifier is undefined in the browser context.

## Turn selectors and counting

- `CONVERSATION_TURN_SELECTOR` keeps upstream's `:is()` Chat/Work groups
  plus the fork's `div[data-turn-key], div[data-content-search-turn-key]`
  tail; `ASSISTANT_ROLE_SELECTOR` keeps
  `[data-conversation-role="assistant"]` alongside upstream's
  content-search variants.
- Prior-turn hydration counting must use
  `buildConversationTurnCountExpression()` (container tier first), never
  raw `document.querySelectorAll(CONVERSATION_TURN_SELECTOR).length` —
  the fallback selector double-counts exchanges plus their units (3
  instead of 2 in upstream's fixture).

## Verified intact after the merge

- Root arg whitelist (`src/cli/cliArgWhitelist.ts`), `latest` default for
  the forced browser engine, `light`/Instant default (remote
  `src/remote/server.ts`, MCP `src/mcp/tools/consult.ts`), full
  `maxFileSizeBytes` removal, `copyProfileSource`/`manualLoginProfileDir`
  clearing, single-slot queue (`tests/remote/server.test.ts` fork-side
  flow).

## 2026-10 generated-image gallery (live fix)

- ChatGPT's 2026-10 image answers render a `generated-image-gallery`
  backed by `blob:` URLs with no markdown prose and no estuary links. The
  capture pipeline needs three things the 2026-09 code lacked:
  - Answer text = gallery image alt labels ("Generated image 1"), never
    the overlay's visible "Edit" button label.
  - `isGeneratedImageAssistantAnswer` accepts gallery markup so image-only
    answers finalize immediately.
  - `collectGeneratedImageArtifacts` runs the in-page blob scan (and
    auto-saves to the session artifacts dir) whenever the answer HTML
    carries generated-image markup — no explicit `--output` required.
    Plain text answers never trigger the scan (it scrolls the page).
- Live-verified 2026-10-04: 1312×1199 PNG saved to
  `~/.oracle/sessions/<id>/artifacts/Generated-image-1.png`.
