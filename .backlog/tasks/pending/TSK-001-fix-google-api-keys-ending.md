---
id: TSK-001
title: Fix: Google API keys ending in '-' are not redacted
status: pending
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-001
depends-on: []
---

# Fix: Google API keys ending in '-' are not redacted

## Description

The trailing `\b` in `/\bAIza[0-9A-Za-z_-]{35}\b/g` (`src/core/sanitizer.ts:92`) fails when a key ends in `-` and is followed by a non-word character, so the key leaks unredacted. See RPT-001 for the reproduction. Replace `\b` with a lookahead such as `(?![0-9A-Za-z_-])`.

## Acceptance Criteria

- [ ] The Google key pattern in src/core/sanitizer.ts redacts 39-char AIza keys whose last character is - or _, at end of string and before space or quote
- [ ] sanitizer.test.ts covers keys ending in - and _
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created