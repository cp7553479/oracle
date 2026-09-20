---
name: oracle-advisor
description: Request a second-model consultation through Oracle's fixed browser transport with per-run provenance. Use when model evidence or transport provenance is part of the request; the existing oracle skill remains the browser-first workflow.
---

# Oracle advisor

Use Oracle to ask an advisory model about selected context. The advisor returns
advice; the calling agent remains responsible for checking it and making edits.
This skill reuses the existing Oracle CLI and MCP tools. It does not add a new
command, MCP method, or native desktop adapter.

## Transport

This fork exposes exactly one execution transport: the persistent manual-login
browser. Every root run is forced onto it; `--engine api`, `--render`, effort,
and research flags are silently discarded and must not be used. Continuation
flags (`--followup <sessionId|slug>`, repeatable `--browser-follow-up`) stay
available for browser conversations.

- **Browser:** use the authorized signed-in browser route. Pass the requested
  model with `--model`; Oracle records model-selection evidence in the session
  metadata. Browser availability alone does not authorize a fallback.
- **API, render, and native desktop:** unavailable as caller-selected routes in
  this fork. Do not improvise private IPC, cookie extraction, or UI automation
  as an adapter, and do not pass flags to reach them.

If the request cannot be satisfied through the browser route, explain the
missing capability instead of reducing the required model or effort silently.

## Run the consultation

Inspect `oracle --help` for the installed version. Preview the exact bundle
with `--dry-run full` before executing; a preview's predicted route is not
execution evidence. Include the problem, relevant constraints, and the
requested answer format in the prompt. Send only the selected task context,
with credentials excluded.

Example using the installed Oracle:

```bash
oracle --model gpt-5.6-sol \
  --prompt "Review this package metadata for compatibility risks." --file package.json
```

MCP callers can use `consult` with an explicit `model`, and inspect `sessions`
with `detail:true`. If a call detaches or times out, inspect its existing
session (`oracle status`, `oracle session <id>`) before retrying; do not create
a duplicate consultation. New submissions with the same prompt queue behind the
active run instead of being rejected.

## Return evidence with the advice

Keep required model and effort separate. Report the answer (or the incomplete
state), the session reference, available conversation reference, requested
model, observed or effective values, and the evidence supporting each
observation. Use session metadata and logs; mark missing observations as
unknown.

A configured model is a requested/effective route, not independent proof of the
backend that served it. A browser picker label proves UI selection, not
server-side execution identity. A completed answer alone cannot prove an effort
constraint. If a required constraint is contradicted or remains unverified,
report that the consultation did not satisfy it, even if text was returned.

Keep uncertainty attached to the relevant claim. Verify the advice against the
repository and tests before acting on it.
