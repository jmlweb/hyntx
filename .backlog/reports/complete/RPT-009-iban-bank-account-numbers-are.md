---
id: RPT-009
title: IBAN bank account numbers are not redacted
type: security
severity: medium
status: triaged
created: 2026-11-07
triaged: 2026-11-07
task-id: TSK-009
---

## Summary

`docs/SPECS.md:165` and `README.md:112` promise that `sanitize` redacts "personal identifiers" (phone numbers, card numbers, national IDs). The sanitizer covers card numbers, SSNs, DNI/NIE, CPF, CURP, NINO and more, but has no rule for IBAN bank account numbers. An IBAN typed in a prompt or printed by a tool (payment integrations, invoices, test fixtures with real data) passes through unredacted into the `Report` and, with the default engine, is sent to Anthropic.

## Location

- `src/core/sanitizer.ts:738-790`: the `sanitize` pipeline has no IBAN or bank-account redactor (`rg -i iban src docs README.md` returns nothing).
- `docs/SPECS.md:165`, `README.md:112`: documented promise of personal-identifier redaction.

## Reproduction

Built `dist/index.js` from main (4.1.2, Node 22.22.3), `sanitize(input)`:

```
"IBAN ES9121000418450200051332"        => {"text":"IBAN ES9121000418450200051332","redacted":0}
"IBAN ES91 2100 0418 4502 0005 1332"   => {"text":"IBAN ES91 2100 0418 4502 0005 1332","redacted":0}
"GB82WEST12345698765432"               => {"text":"GB82WEST12345698765432","redacted":0}
"DE89 3704 0044 0532 0130 00"          => {"text":"DE89 3704 0044 0532 0130 00","redacted":0}
```

For comparison, `"card 4111 1111 1111 1111"` => `"card [REDACTED_CREDIT_CARD]"`.

## Expected

IBANs (two-letter country code, two check digits, 11-30 alphanumerics, compact or in groups of four separated by spaces) are replaced with `[REDACTED_IBAN]`. Validating the mod-97 checksum keeps false positives on random uppercase identifiers low. Tests in `src/core/sanitizer.test.ts` cover the compact and grouped forms above.
