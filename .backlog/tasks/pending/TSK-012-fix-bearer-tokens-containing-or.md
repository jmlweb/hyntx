---
id: TSK-012
title: Fix: Bearer tokens containing + / = or ~ are only partly redacted
status: pending
priority: P3
tags: []
created: 2026-11-13
source: report/RPT-012
depends-on: []
---

# Fix: Bearer tokens containing + / = or ~ are only partly redacted

## Description

### Description

`redactBearerTokens` (`src/core/sanitizer.ts:71-74`) stops at the first `+`, `/`, `=` or `~`, so the tail of base64 or b64token bearer tokens leaks into the Report. Widen the character class to the RFC 6750 alphabet. See RPT-012.

## Acceptance Criteria

- [ ] redactBearerTokens matches the full RFC 6750 token alphabet ([A-Za-z0-9._~+/-]+=*) after Bearer
- [ ] sanitize("Authorization: Bearer abcdefghijklmnopqrstuvwx+yz/0123456789==") returns "Authorization: Bearer [REDACTED_TOKEN]"
- [ ] Tests in src/core/sanitizer.test.ts cover base64 tokens with + / = padding and tokens with ~
- [ ] pnpm check && pnpm test && pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-13] Created