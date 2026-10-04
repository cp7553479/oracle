# Directory Update Log

## 2026-09-20

- **Initialization**: Created wiki.

## 2026-09-22

- **Oracle model default**: Recorded the model-free Latest + Medium policy for root CLI, MCP/Agent, and remote browser callers while preserving explicit models and the API escape hatch.

## 2026-10-04

- **Upstream 0.21.4 sync**: Recorded the fork-vs-upstream merge decisions — native-Keychain bare launch kept (upstream's `.oracle-native-keychain-v1` opt-in rejected), `profile.last_used` subprofile reuse, scoped structural completion fallback, dual-wording status applied to upstream's announcement tracker, container-tier hydration counting. Corrected the model-default note to Instant (`light`).

## 2026-10-04 (later)

- **Generated-image gallery fix**: Live image-generation Q&A through the global oracle exposed a 2026-10 layout regression — answers captured as the gallery overlay's "Edit" button label and blob-backed images never saved. Recorded the three-part fix (alt-label text, gallery-markup fast-accept, in-page blob fetch auto-save) on the upstream-sync entity.

## 2026-10-04 (blocking audit)

- **Profile-flag blocking audit**: Verified the two-layer seal end to end — `stripDisabledBrowserProfileArgs` (browserProfilePolicy.ts, every entry point incl. subcommands) enumerates the full profile/cookie/attach/remote-Chrome/tab family, and `filterRootRunArgs` (cliArgWhitelist.ts, root runs) drops anything else with its values. `--browser-tabs` is a `status` inspection flag, deliberately NOT stripped. Locked with table-driven tests (both spellings per flag) and an adversarial global-oracle dry run (exit 0, silent, prompt intact).
