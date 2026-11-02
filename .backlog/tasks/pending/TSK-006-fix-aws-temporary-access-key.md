---
id: TSK-006
title: Fix: AWS temporary access key IDs (ASIA...) are not redacted
status: pending
priority: P4
tags: []
created: 2026-11-02
source: report/RPT-006
depends-on: []
---

# Fix: AWS temporary access key IDs (ASIA...) are not redacted

## Description

### Description

`src/core/sanitizer.ts:54` matches only `AKIA[0-9A-Z]{16}`. STS temporary key IDs use the `ASIA` prefix and leak unredacted. See RPT-006. Extend the pattern to `(?:AKIA|ASIA)`.

## Acceptance Criteria

- [ ] redactAWSCredentials redacts ASIA-prefixed 20-character key IDs as [REDACTED_AWS_KEY]
- [ ] src/core/sanitizer.test.ts covers an ASIA key next to the AKIA cases
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created