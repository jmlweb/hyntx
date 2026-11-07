---
id: TSK-009
title: Fix: IBAN bank account numbers are not redacted
status: pending
priority: P3
tags: []
created: 2026-11-07
source: report/RPT-009
depends-on: []
---

# Fix: IBAN bank account numbers are not redacted

## Description

Add an IBAN redactor to the `sanitize` pipeline in `src/core/sanitizer.ts` (see RPT-009). The pipeline (lines 738-790) covers cards and national IDs but has no bank-account rule, although `docs/SPECS.md:165` promises personal-identifier redaction. Run it before the broad numeric matchers so grouped digits are not partially taken by phone/SSN rules. Mention IBANs in `docs/SPECS.md:165`.

## Acceptance Criteria

- [ ] sanitize redacts compact IBANs (ES9121000418450200051332, GB82WEST12345698765432) as [REDACTED_IBAN]
- [ ] sanitize redacts IBANs grouped in fours with spaces (ES91 2100 0418 4502 0005 1332, DE89 3704 0044 0532 0130 00)
- [ ] Candidates failing the mod-97 checksum are left untouched
- [ ] Tests for these cases added to src/core/sanitizer.test.ts; pnpm check && pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-07] Created