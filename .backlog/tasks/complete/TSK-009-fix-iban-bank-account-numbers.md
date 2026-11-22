---
id: TSK-009
title: Fix: IBAN bank account numbers are not redacted
status: complete
priority: P3
tags: []
created: 2026-11-07
source: report/RPT-009
depends-on: []
started: 2026-11-22
completed: 2026-11-22
---

# Fix: IBAN bank account numbers are not redacted

## Description

Add an IBAN redactor to the `sanitize` pipeline in `src/core/sanitizer.ts` (see RPT-009). The pipeline (lines 738-790) covers cards and national IDs but has no bank-account rule, although `docs/SPECS.md:165` promises personal-identifier redaction. Run it before the broad numeric matchers so grouped digits are not partially taken by phone/SSN rules. Mention IBANs in `docs/SPECS.md:165`.

## Acceptance Criteria

- [x] sanitize redacts compact IBANs (ES9121000418450200051332, GB82WEST12345698765432) as [REDACTED_IBAN]
- [x] sanitize redacts IBANs grouped in fours with spaces (ES91 2100 0418 4502 0005 1332, DE89 3704 0044 0532 0130 00)
- [x] Candidates failing the mod-97 checksum are left untouched
- [x] Tests for these cases added to src/core/sanitizer.test.ts; pnpm check && pnpm test pass

## Notes

## Learnings

- LRN-008: Local pnpm install skips devDependencies here because NODE_ENV=production; use Node 22 and NODE_ENV=development
## Progress Log

- [2026-11-07] Created
- [2026-11-22] Started
- [2026-11-22] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts -t IBAN → compact ES9121000418450200051332 and GB82WEST12345698765432 become [REDACTED_IBAN], tests pass (2026-11-22)
- [2026-11-22] criterion 2 — evidence: pnpm vitest run src/core/sanitizer.test.ts -t IBAN → 'ES91 2100 0418 4502 0005 1332' and 'DE89 3704 0044 0532 0130 00' become [REDACTED_IBAN], tests pass (2026-11-22)
- [2026-11-22] criterion 3 — evidence: pnpm vitest run src/core/sanitizer.test.ts -t IBAN → ES9221000418450200051332, GB83WEST12345698765432, 'DE89 3704 0044 0532 0130 01' not redacted as IBAN, tests pass (2026-11-22)
- [2026-11-22] criterion 4 — evidence: pnpm check → exit 0; pnpm test → 26 files, 489 tests passed; pnpm build → success (2026-11-22)
- [2026-11-22] Completed