---
id: TSK-001
title: Fix: Google API keys ending in '-' are not redacted
status: complete
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-001
depends-on: []
started: 2026-11-02
completed: 2026-11-02
---

# Fix: Google API keys ending in '-' are not redacted

## Description

The trailing `\b` in `/\bAIza[0-9A-Za-z_-]{35}\b/g` (`src/core/sanitizer.ts:92`) fails when a key ends in `-` and is followed by a non-word character, so the key leaks unredacted. See RPT-001 for the reproduction. Replace `\b` with a lookahead such as `(?![0-9A-Za-z_-])`.

## Acceptance Criteria

- [x] The Google key pattern in src/core/sanitizer.ts redacts 39-char AIza keys whose last character is - or _, at end of string and before space or quote
- [x] sanitizer.test.ts covers keys ending in - and _
- [x] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

- LRN-001: Trailing \b fails for tokens that can end in '-'
- LRN-002: hyntx install needs Node 22 and NODE_ENV=development on hustle
## Progress Log

- [2026-10-30] Created
- [2026-11-02] Started
- [2026-11-02] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts → 115 passed; key ending in '-' redacted at end of string, before space, double and single quote (was '[REDACTED_ID]-' before fix) (2026-11-02)
- [2026-11-02] criterion 2 — evidence: it.each(['-','_']) 'redacts Google keys whose last character is %s' in src/core/sanitizer.test.ts → '-' case failed before fix, both pass after (2026-11-02)
- [2026-11-02] criterion 3 — evidence: pnpm check → clean; pnpm test → 26 files, 447 tests passed; pnpm build → success (Node 22.22.3) (2026-11-02)
- [2026-11-02] Completed