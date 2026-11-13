---
id: TSK-013
title: Fix: Google OAuth client secrets (GOCSPX-), Stripe webhook secrets (whsec_) and Slack app tokens (xapp-) are not redacted
status: pending
priority: P3
tags: []
created: 2026-11-13
source: report/RPT-013
depends-on: []
---

# Fix: Google OAuth client secrets (GOCSPX-), Stripe webhook secrets (whsec_) and Slack app tokens (xapp-) are not redacted

## Description

### Description

`redactProviderTokens` (`src/core/sanitizer.ts:86-113`) has no rule for `GOCSPX-`, `whsec_` or `xapp-` credentials, and the opaque-id fallback misses them, so bare occurrences reach the Report unchanged. Add a provider rule for each prefix. See RPT-013.

## Acceptance Criteria

- [ ] redactProviderTokens redacts bare GOCSPX- client secrets
- [ ] redactProviderTokens redacts bare whsec_ Stripe webhook secrets
- [ ] redactProviderTokens redacts bare xapp- Slack app-level tokens
- [ ] Tests in src/core/sanitizer.test.ts cover each prefix bare and after a space-separated label
- [ ] pnpm check && pnpm test && pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-13] Created