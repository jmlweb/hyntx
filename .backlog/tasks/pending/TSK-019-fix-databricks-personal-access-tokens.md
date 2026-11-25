---
id: TSK-019
title: Fix: Databricks personal access tokens (dapi...) and Square access tokens (sq0atp-) are not redacted
status: pending
priority: P3
tags: []
created: 2026-11-25
source: report/RPT-019
depends-on: []
---

# Fix: Databricks personal access tokens (dapi...) and Square access tokens (sq0atp-) are not redacted

## Description

Source: RPT-019. Add Databricks and Square rules to `redactProviderTokens` in `src/core/sanitizer.ts`. The opaque-id fallback misses both: the Databricks hex body is glued to the prefix and lowercase-only; the Square body is under 32 characters.

## Acceptance Criteria

- [ ] sanitize redacts bare dapi + 32 hex tokens, with or without a -<n> suffix
- [ ] sanitize redacts bare sq0atp- + 22 base64url tokens
- [ ] Ordinary words followed by hex that do not start with dapi are unchanged
- [ ] Sanitizer tests cover both, with samples split to avoid secret scanners
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-25] Created