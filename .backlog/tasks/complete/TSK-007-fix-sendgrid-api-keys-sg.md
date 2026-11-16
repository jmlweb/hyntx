---
id: TSK-007
title: Fix: SendGrid API keys (SG.) are not redacted when they appear bare
status: complete
priority: P2
tags: []
created: 2026-11-05
source: report/RPT-007
depends-on: []
started: 2026-11-16
completed: 2026-11-16
---

# Fix: SendGrid API keys (SG.) are not redacted when they appear bare

## Description

### Description

`redactProviderTokens` (`src/core/sanitizer.ts:84-101`) has no SendGrid pattern, and the opaque-id fallback (`src/core/sanitizer.ts:189-210`) misses base64url keys containing `_` or `-`. Bare `SG.` keys therefore leak whole into the Report. Add an `SG.` provider pattern next to the others. GitHub push protection rejects literal SendGrid-shaped keys, so build test keys at runtime. See RPT-007.

## Acceptance Criteria

- [x] sanitize replaces a bare SG.<22>.<43> SendGrid key whole, including keys whose segments contain _ or -
- [x] Tests in src/core/sanitizer.test.ts cover a realistic key, an all-letter key and a key inside surrounding text, built at runtime so secret scanning does not block the push
- [x] docs/SPECS.md lists SendGrid among the covered providers
- [x] pnpm check && pnpm test pass

## Notes

## Learnings

- LRN-006: Hyntx dev install needs Node 24 and NODE_ENV not production
## Progress Log

- [2026-11-05] Created
- [2026-11-16] Started
- [2026-11-16] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts -t SendGrid → 4 passed (failed 3/4 before the SG. pattern); keys with _ and - become [REDACTED_SENDGRID_KEY] whole (2026-11-16)
- [2026-11-16] criterion 2 — evidence: src/core/sanitizer.test.ts 'SendGrid API keys' covers realistic, all-letter and in-text keys built via ['SG', id, secret].join('.') → 4 passed (2026-11-16)
- [2026-11-16] criterion 3 — evidence: rg SendGrid docs/SPECS.md → line 165 lists SendGrid among providers (2026-11-16)
- [2026-11-16] criterion 4 — evidence: pnpm check → exit 0; pnpm test → 26 files, 471 tests passed; pnpm build → success (Node 24.22.0) (2026-11-16)
- [2026-11-16] Completed