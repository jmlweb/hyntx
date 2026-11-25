---
id: TSK-018
title: Fix: age encryption secret keys (AGE-SECRET-KEY-1...) are not redacted
status: pending
priority: P2
tags: []
created: 2026-11-25
source: report/RPT-018
depends-on: []
---

# Fix: age encryption secret keys (AGE-SECRET-KEY-1...) are not redacted

## Description

Source: RPT-018. Add an age secret key rule to `src/core/sanitizer.ts` (in `redactProviderTokens` or next to `redactPEMKeys`, before `redactOpaqueIds`). The uppercase-only body slips past the opaque-id fallback, so a dedicated rule is needed. Leaks a full private key into reports and engine excerpts.

## Acceptance Criteria

- [ ] sanitize replaces an AGE-SECRET-KEY-1 followed by 58 Bech32 characters with a typed placeholder, upper or lower case
- [ ] Public age recipients (age1...) are left unchanged
- [ ] Sanitizer tests cover a bare key and a key in a commented key-file line, with samples split to avoid secret scanners
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-25] Created