---
id: TSK-005
title: Fix: Passwords given as short flags (docker login -p, sshpass -p, redis-cli -a) are not redacted
status: complete
priority: P2
tags: []
created: 2026-11-02
source: report/RPT-005
depends-on: []
started: 2026-11-13
completed: 2026-11-13
---

# Fix: Passwords given as short flags (docker login -p, sshpass -p, redis-cli -a) are not redacted

## Description

### Description

`redactCommandLineSecrets` (`src/core/sanitizer.ts:153`) only redacts a short password flag for mysql (`src/core/sanitizer.ts:160`). `docker login -p`, `sshpass -p` and `redis-cli -a` values are kept verbatim. See RPT-005 for the reproduction. Add command-scoped rules modelled on the mysql one.

## Acceptance Criteria

- [x] sanitize() redacts the value after docker login -p, sshpass -p and redis-cli -a
- [x] Unrelated short flags such as mkdir -p and git commit -a are left unchanged
- [x] src/core/sanitizer.test.ts covers each command and the negative cases
- [x] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

- LRN-005: redis-cli short-flag redaction must be scoped to -a because -p is the port
## Progress Log

- [2026-11-02] Created
- [2026-11-13] Started
- [2026-11-13] criterion 1 — evidence: pnpm vitest run src/core/sanitizer.test.ts → 7 new docker login/sshpass/redis-cli cases failed before fix, all 135 pass after (2026-11-13)
- [2026-11-13] criterion 2 — evidence: pnpm vitest run src/core/sanitizer.test.ts → 'leaves unrelated short flags' cases (mkdir -p, git commit -a, docker run -p, redis-cli -p 6379, cp -a) pass unchanged (2026-11-13)
- [2026-11-13] criterion 3 — evidence: src/core/sanitizer.test.ts adds positive cases per command plus 8 negative cases → 135/135 pass (2026-11-13)
- [2026-11-13] criterion 4 — evidence: pnpm check → exit 0; pnpm test → 467/467 pass; pnpm build → exit 0 (Node 24.22) (2026-11-13)
- [2026-11-13] Completed