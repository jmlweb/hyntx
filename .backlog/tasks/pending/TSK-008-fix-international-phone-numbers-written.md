---
id: TSK-008
title: Fix: International phone numbers written with spaces are not redacted
status: pending
priority: P3
tags: []
created: 2026-11-05
source: report/RPT-008
depends-on: []
---

# Fix: International phone numbers written with spaces are not redacted

## Description

### Description

`redactPhoneNumbers` (`src/core/sanitizer.ts:344-358`) redacts `+` numbers only when their digits are unbroken, and labelled numbers only at exactly 10 digits. The usual grouped form of an international number leaks, although `docs/SPECS.md:165` promises phone-number redaction. See RPT-008.

## Acceptance Criteria

- [ ] sanitize redacts +34 612 345 678, +44 7700 900123 and phone +34 612 345 678
- [ ] Separators between digit groups may be spaces, dots or dashes
- [ ] Bare digit runs without a + prefix or a label are still left untouched
- [ ] The redactPhoneNumbers docstring matches what the function covers
- [ ] pnpm check && pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-05] Created