---
id: TSK-014
title: Fix: Permission suggestions ignore exact-command deny and ask rules such as Bash(docker ps)
status: pending
priority: P4
tags: []
created: 2026-11-16
source: report/RPT-014
depends-on: []
---

# Fix: Permission suggestions ignore exact-command deny and ask rules such as Bash(docker ps)

## Description

`overlaps` in src/core/permissions.ts:126-132 only tests a deny/ask rule against `"<command> --probe"` and against a `"<command> "` prefix. An exact rule such as `Bash(docker ps)`, or an inner-wildcard rule such as `Bash(gh * view)`, matches the bare command that the suggested `Bash(<command> *)` also covers, but is not detected. Hyntx then suggests an allow rule that a deny/ask rule touches, against docs/SPECS.md:127. Fix: also test the rule's glob against the bare command. See RPT-014.

## Acceptance Criteria

- [ ] isRestricted returns true for a deny or ask rule that names the bare command without a wildcard (Bash(docker ps) against docker ps)
- [ ] isRestricted returns true for a deny or ask rule whose inner wildcard matches the bare command (Bash(gh * view) against gh pr view)
- [ ] Existing cases still hold: Bash(docker ps *) and Bash(docker ps -a) are restricted, unrelated rules are not
- [ ] src/core/permissions.test.ts covers the new cases and pnpm check && pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-16] Created