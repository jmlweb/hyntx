---
id: TSK-005
title: Fix: Passwords given as short flags (docker login -p, sshpass -p, redis-cli -a) are not redacted
status: pending
priority: P2
tags: []
created: 2026-11-02
source: report/RPT-005
depends-on: []
---

# Fix: Passwords given as short flags (docker login -p, sshpass -p, redis-cli -a) are not redacted

## Description

### Description

`redactCommandLineSecrets` (`src/core/sanitizer.ts:153`) only redacts a short password flag for mysql (`src/core/sanitizer.ts:160`). `docker login -p`, `sshpass -p` and `redis-cli -a` values are kept verbatim. See RPT-005 for the reproduction. Add command-scoped rules modelled on the mysql one.

## Acceptance Criteria

- [ ] sanitize() redacts the value after docker login -p, sshpass -p and redis-cli -a
- [ ] Unrelated short flags such as mkdir -p and git commit -a are left unchanged
- [ ] src/core/sanitizer.test.ts covers each command and the negative cases
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created