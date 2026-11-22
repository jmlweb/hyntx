---
id: TSK-016
title: Fix: Bare Google OAuth access tokens (ya29.) are not redacted
status: pending
priority: P3
tags: []
created: 2026-11-22
source: report/RPT-016
depends-on: []
---

# Fix: Bare Google OAuth access tokens (ya29.) are not redacted

## Description

Add a provider rule for Google OAuth 2.0 access tokens (`ya29.` + base64url) to `redactProviderTokens` in `src/core/sanitizer.ts`, so bare tokens (for example `gcloud auth print-access-token` output) are redacted. Reproduction and details in RPT-016. Coordinate with TSK-012, which covers `Bearer ya29...`.

## Acceptance Criteria

- [ ] sanitize() replaces a bare ya29. access token (with ., - and _ in it) with a single [REDACTED_<TYPE>] placeholder
- [ ] Bearer ya29... tokens are still fully redacted
- [ ] Unit tests in src/core/sanitizer.test.ts cover the bare and Bearer forms
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-22] Created