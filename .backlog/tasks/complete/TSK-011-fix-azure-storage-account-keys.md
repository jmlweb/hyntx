---
id: TSK-011
title: Fix: Azure storage account keys after 'AccountKey=' are only partly redacted
status: complete
priority: P3
tags: []
created: 2026-11-10
source: report/RPT-011
depends-on: []
started: 2026-11-25
completed: 2026-11-25
---

# Fix: Azure storage account keys after 'AccountKey=' are only partly redacted

## Description

Source: RPT-011.

`src/core/sanitizer.ts:203` base64 rule cannot start after `=`, and `src/core/sanitizer.ts:207` only redacts the alphanumeric run before the first `/` or `+`. `AccountKey` is not in the secret-assignment names at `src/core/sanitizer.ts:117`. Result: `AccountKey=[REDACTED_ID]/K1SZFPTOtr/KBHBeksoGMGw==` and `sig=AbCdEf%[REDACTED_ID]%3D`.

Likely fix: add `account[_-]?key` (and SAS `sig`) to the secret-assignment rule, or let the base64 rule start after `=` when the value follows a key name. Keep existing tests green.

## Acceptance Criteria

- [x] sanitize() replaces the whole AccountKey value in an Azure Storage connection string, including base64 keys containing / or + and trailing ==
- [x] sanitize() replaces the whole sig value of an Azure SAS URL, including URL-encoded characters such as %2B and %3D
- [x] Regression tests in src/core/sanitizer.test.ts cover the Azurite connection string and a SAS URL
- [x] pnpm check && pnpm test && pnpm build pass

## Notes

## Learnings

- LRN-009: Azure AccountKey and SAS sig redaction: name rules run before opaque-id rules; anchor short names on [?&]
## Progress Log

- [2026-11-10] Created
- [2026-11-25] Started
- [2026-11-25] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts → Azurite and quoted '+' AccountKey tests pass, value becomes AccountKey=[REDACTED_SECRET] (were failing before the fix) (2026-11-25)
- [2026-11-25] criterion 2 — evidence: pnpm vitest run src/core/sanitizer.test.ts → SAS URL tests pass, sig=[REDACTED_SECRET] with no %2B/%3D left (were failing before the fix) (2026-11-25)
- [2026-11-25] criterion 3 — evidence: src/core/sanitizer.test.ts 'Azure Storage credentials' block covers Azurite connection string and SAS URL → 5 tests pass (2026-11-25)
- [2026-11-25] criterion 4 — evidence: pnpm check (exit 0), pnpm test → 494/494 passed, pnpm build → success, on Node 22 (2026-11-25)
- [2026-11-25] Completed
- [2026-11-25] criterion 4 re-run after sig value stops at , ; ) and SPECS.md sync — evidence: pnpm check exit 0, pnpm test → 495/495 passed, pnpm build exit 0 (2026-11-25)