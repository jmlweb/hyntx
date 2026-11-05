---
id: RPT-008
title: International phone numbers written with spaces are not redacted
type: security
severity: medium
status: triaged
created: 2026-11-05
triaged: 2026-11-05
task-id: TSK-008
---

## Summary

`docs/SPECS.md:165` says `sanitize` redacts "personal identifiers such as phone numbers". The implementation already tries to cover international numbers (`+` followed by 9-14 digits), but only when the digits are written without spaces. The usual written form of an international number (`+34 612 345 678`, `+44 7700 900123`) passes through unredacted, even next to a "phone" label. These strings end up in the `Report` and, with the default engine, are sent to Anthropic.

## Location

- `src/core/sanitizer.ts:349-352`: the separated-form rule only matches the US 3-3-4 layout.
- `src/core/sanitizer.ts:353`: `/(?<![\w.])\+[0-9]{9,14}\b/` only matches an unbroken digit run.
- `src/core/sanitizer.ts:354-357`: the labelled rule only accepts exactly 10 contiguous digits.
- `src/core/sanitizer.ts:331`: the docstring says "US phone numbers", which disagrees with both the `+` rule and SPECS.

## Reproduction

`sanitize(input).text` on current main (Node 24, tsx):

```
"+34612345678"            => "[REDACTED_PHONE]"
"+1 415 555 0132"         => "[REDACTED_PHONE]"
"415-555-0132"            => "[REDACTED_PHONE]"
"+34 612 345 678"         => "+34 612 345 678"         (leaks)
"+44 7700 900123"         => "+44 7700 900123"         (leaks)
"phone +34 612 345 678"   => "phone +34 612 345 678"   (leaks)
```

## Expected

A `+`-prefixed number with a country code is redacted whether its digit groups are separated by spaces, dots or dashes, as the unspaced form already is. Bare digit runs without `+` or a label stay untouched, so timestamps and counters are not affected. Tests cover the cases above in `src/core/sanitizer.test.ts`.
