---
id: RPT-006
title: AWS temporary access key IDs (ASIA...) are not redacted
type: security
severity: low
status: triaged
created: 2026-11-02
triaged: 2026-11-02
task-id: TSK-006
---

## Summary

`redactAWSCredentials` only matches long-term access key IDs (`AKIA` prefix). STS temporary credentials use the `ASIA` prefix and the same 20-character shape, so they pass through unredacted unless they happen to be assigned to a secret-looking variable name. The behaviour is inconsistent with the `[REDACTED_AWS_KEY]` treatment of `AKIA` keys.

## Location

- `src/core/sanitizer.ts:54`: `text.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]')`

## Reproduction

Calling `sanitize(input).text` (vitest, current main):

```
"AKIAABCDEFGHIJKLMNOP"                 => "[REDACTED_AWS_KEY]"
"ASIAABCDEFGHIJKLMNOP"                 => "ASIAABCDEFGHIJKLMNOP"
"aws sts ... ASIAIOSFODNN7EXAMPLE"     => "aws sts ... ASIAIOSFODNN7EXAMPLE"
```

## Expected

`ASIA` key IDs are redacted as `[REDACTED_AWS_KEY]`, with a test next to the `AKIA` cases in `src/core/sanitizer.test.ts:66`.
