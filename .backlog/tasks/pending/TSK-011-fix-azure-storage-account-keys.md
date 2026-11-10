---
id: TSK-011
title: Fix: Azure storage account keys after 'AccountKey=' are only partly redacted
status: pending
priority: P3
tags: []
created: 2026-11-10
source: report/RPT-011
depends-on: []
---

# Fix: Azure storage account keys after 'AccountKey=' are only partly redacted

## Description

Source: RPT-011.

`src/core/sanitizer.ts:203` base64 rule cannot start after `=`, and `src/core/sanitizer.ts:207` only redacts the alphanumeric run before the first `/` or `+`. `AccountKey` is not in the secret-assignment names at `src/core/sanitizer.ts:117`. Result: `AccountKey=[REDACTED_ID]/K1SZFPTOtr/KBHBeksoGMGw==` and `sig=AbCdEf%[REDACTED_ID]%3D`.

Likely fix: add `account[_-]?key` (and SAS `sig`) to the secret-assignment rule, or let the base64 rule start after `=` when the value follows a key name. Keep existing tests green.

## Acceptance Criteria

- [ ] sanitize() replaces the whole AccountKey value in an Azure Storage connection string, including base64 keys containing / or + and trailing ==
- [ ] sanitize() replaces the whole sig value of an Azure SAS URL, including URL-encoded characters such as %2B and %3D
- [ ] Regression tests in src/core/sanitizer.test.ts cover the Azurite connection string and a SAS URL
- [ ] pnpm check && pnpm test && pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-10] Created