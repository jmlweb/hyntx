---
id: TSK-010
title: Fix: Huge --days values report 'No sessions found' (exit 2) instead of a usage error
status: pending
priority: P4
tags: []
created: 2026-11-07
source: report/RPT-010
depends-on: []
---

# Fix: Huge --days values report 'No sessions found' (exit 2) instead of a usage error

## Description

Validate the upper bound of `--days` in `resolvePeriod` (`src/cli-args.ts:66-70`), see RPT-010. Today an overflowing value makes `addDays` return Invalid Date, every session is filtered out and the CLI misreports "No sessions found" with exit 2.

## Acceptance Criteria

- [ ] resolvePeriod throws UsageError when --days yields an invalid start date or exceeds a documented maximum
- [ ] hyntx --days 999999999 exits 1 with a usage message instead of exit 2
- [ ] Unit test added in src/cli-args.test.ts; docs/CLI.md states the limit if one is introduced
- [ ] pnpm check && pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-07] Created