# Test Standard

Tests in this project should be small behavioral contracts, not snapshots of current implementation.

- Prefer one file per behavior surface.
- Mock external browser/API boundaries only at the protocol edge.
- Do not assert incidental DOM selector strings unless the selector is the product contract.
- Browser completion tests must model real terminal states: generated image card, finished action buttons, stop button absence, and prompt echo avoidance.
- A generated image is a completed assistant response even when no assistant markdown/text is present.
