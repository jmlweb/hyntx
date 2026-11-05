---
id: TSK-007
title: Fix: SendGrid API keys (SG.) are not redacted when they appear bare
status: pending
priority: P2
tags: []
created: 2026-11-05
source: report/RPT-007
depends-on: []
---

# Fix: SendGrid API keys (SG.) are not redacted when they appear bare

## Description

### Description

`redactProviderTokens` (`src/core/sanitizer.ts:84-101`) has no SendGrid pattern, and the opaque-id fallback (`src/core/sanitizer.ts:189-210`) misses base64url keys containing `_` or `-`. Bare `SG.` keys therefore leak whole into the Report. Add an `SG.` provider pattern next to the others. GitHub push protection rejects literal SendGrid-shaped keys, so build test keys at runtime. See RPT-007.

## Acceptance Criteria

- [ ] sanitize replaces a bare SG.<22>.<43> SendGrid key whole, including keys whose segments contain _ or -
- [ ] Tests in src/core/sanitizer.test.ts cover a realistic key, an all-letter key and a key inside surrounding text, built at runtime so secret scanning does not block the push
- [ ] docs/SPECS.md lists SendGrid among the covered providers
- [ ] pnpm check && pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-05] Created