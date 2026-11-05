---
id: TSK-001
title: Fix: Google API keys ending in '-' are not redacted
status: complete
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-001
depends-on: []
started: 2026-11-05
completed: 2026-11-05
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

- LRN-001: TSK-001 revert was caused by the Release workflow, not the sanitizer fix
- LRN-002: hyntx local install needs Node 22 and NODE_ENV=development
## Progress Log

- [2026-10-30] Created
- [2026-11-05] Started
- [2026-11-05] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts -t 'Google keys' → '-' case failed before fix, both pass after lookahead (?![0-9A-Za-z_-]) (2026-11-05)
- [2026-11-05] criterion 2 — evidence: it.each(['-','_']) test in src/core/sanitizer.test.ts covers end of string, space, double and single quote → 115/115 pass (2026-11-05)
- [2026-11-05] criterion 3 — evidence: pnpm check → exit 0, pnpm test → 447/447 pass, pnpm build → exit 0 on Node 22.22.3 (2026-11-05)
- [2026-11-05] Completed