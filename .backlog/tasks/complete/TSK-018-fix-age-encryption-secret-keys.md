---
id: TSK-018
title: Fix: age encryption secret keys (AGE-SECRET-KEY-1...) are not redacted
status: complete
priority: P2
tags: []
created: 2026-11-25
source: report/RPT-018
depends-on: []
started: 2026-11-28
completed: 2026-11-28
---

# Fix: age encryption secret keys (AGE-SECRET-KEY-1...) are not redacted

## Description

Source: RPT-018. Add an age secret key rule to `src/core/sanitizer.ts` (in `redactProviderTokens` or next to `redactPEMKeys`, before `redactOpaqueIds`). The uppercase-only body slips past the opaque-id fallback, so a dedicated rule is needed. Leaks a full private key into reports and engine excerpts.

## Acceptance Criteria

- [x] sanitize replaces an AGE-SECRET-KEY-1 followed by 58 Bech32 characters with a typed placeholder, upper or lower case
- [x] Public age recipients (age1...) are left unchanged
- [x] Sanitizer tests cover a bare key and a key in a commented key-file line, with samples split to avoid secret scanners
- [x] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

- LRN-010: age secret keys are single-case Bech32 and slip past the opaque-id rule; dev deps need NODE_ENV=development
## Progress Log

- [2026-11-25] Created
- [2026-11-28] Started
- [2026-11-28] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts -t 'age encryption' → bare upper-case and lower-case keys become [REDACTED_AGE_KEY]; 4 tests failed before the fix, pass after (2026-11-28)
- [2026-11-28] criterion 2 — evidence: 'leaves a public age recipient unchanged' and key-file test keep '# public key: age1...' verbatim → pass (2026-11-28)
- [2026-11-28] criterion 3 — evidence: src/core/sanitizer.test.ts 'age encryption keys' covers bare key, '# <key>' commented line and full key file; samples built with ['AGE','SECRET','KEY','1'].join('-') → 5 tests pass (2026-11-28)
- [2026-11-28] criterion 4 — evidence: pnpm check → clean; pnpm test → 26 files, 500 tests passed; pnpm build → success (Node 22.22.3) (2026-11-28)
- [2026-11-28] Completed