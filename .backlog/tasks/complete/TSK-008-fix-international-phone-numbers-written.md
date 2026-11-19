---
id: TSK-008
title: Fix: International phone numbers written with spaces are not redacted
status: complete
priority: P3
tags: []
created: 2026-11-05
source: report/RPT-008
depends-on: []
started: 2026-11-19
completed: 2026-11-19
---

# Fix: International phone numbers written with spaces are not redacted

## Description

### Description

`redactPhoneNumbers` (`src/core/sanitizer.ts:344-358`) redacts `+` numbers only when their digits are unbroken, and labelled numbers only at exactly 10 digits. The usual grouped form of an international number leaks, although `docs/SPECS.md:165` promises phone-number redaction. See RPT-008.

## Acceptance Criteria

- [x] sanitize redacts +34 612 345 678, +44 7700 900123 and phone +34 612 345 678
- [x] Separators between digit groups may be spaces, dots or dashes
- [x] Bare digit runs without a + prefix or a label are still left untouched
- [x] The redactPhoneNumbers docstring matches what the function covers
- [x] pnpm check && pnpm test pass

## Notes

## Learnings

- LRN-007: International phone redaction must run before the US 3-3-4 rule and count digits, not groups
## Progress Log

- [2026-11-05] Created
- [2026-11-19] Started
- [2026-11-19] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts → 'redacts the grouped international number in' cases for +34 612 345 678, +44 7700 900123, phone +34 612 345 678 pass; failed before the fix (2026-11-19)
- [2026-11-19] criterion 2 — evidence: pnpm vitest run src/core/sanitizer.test.ts → +34.612.345.678 and +34-612-345-678 cases pass (2026-11-19)
- [2026-11-19] criterion 3 — evidence: pnpm vitest run src/core/sanitizer.test.ts → 'leaves ... untouched without a + prefix or a label' cases (1700000000123, 612 345 678, build 20261119 took 345 678 ms, version 1.2.3) pass with 0 redactions (2026-11-19)
- [2026-11-19] criterion 4 — evidence: redactPhoneNumbers docstring in src/core/sanitizer.ts now lists the + international rule (spaces, dots, dashes), the US 3-3-4 rule and the labelled 10-digit rule, and states bare digit runs are untouched (2026-11-19)
- [2026-11-19] criterion 5 — evidence: pnpm check → typecheck, lint, prettier clean; pnpm test → 26 files, 482 tests passed; pnpm build → success (2026-11-19)
- [2026-11-19] Completed