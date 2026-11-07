---
id: RPT-010
title: Huge --days values report 'No sessions found' (exit 2) instead of a usage error
type: bug
severity: low
status: triaged
created: 2026-11-07
triaged: 2026-11-07
task-id: TSK-010
---

## Summary

`resolvePeriod` accepts any positive integer for `--days` (`docs/CLI.md:13`: "Positive integer"). A value large enough to push the start date outside the JavaScript Date range makes `from` an Invalid Date. Every comparison with NaN is false, so the reader filters out all sessions and the CLI reports "No sessions found" with exit code 2, even though sessions exist in the period. The user gets a wrong answer instead of a validation error.

## Location

- `src/cli-args.ts:66-70`: only checks `Number.isInteger(days) && days >= 1`; no upper bound and no check that the resulting date is valid.
- `src/utils/dates.ts:31-33`: `addDays` returns `Invalid Date` when the offset overflows.

The plugin runner already caps `--days` at 4 digits (`skills/hyntx/scripts/analyzer-lib.mjs:17`), so only direct CLI use is affected.

## Reproduction

Fake projects dir with one session dated today (`HYNTX_CLAUDE_PROJECTS_DIR`, `HYNTX_HOME` set to temp dirs), built `dist/cli.js` from main (4.1.2, Node 22.22.3):

```
$ node dist/cli.js --no-llm --days 7 --format json   # exit 0, sessionsInPeriod: 1
$ node dist/cli.js --no-llm --days 999999999
ERROR: No sessions found for this period and filters.
# exit 2
```

`new Date(2026, 10, 8 - 999999998)` evaluates to `Invalid Date`.

## Expected

An out-of-range `--days` (for example, one whose start date is not a valid Date, or above a documented maximum) throws `UsageError` and exits 1 with a message, matching how `--days 0` is handled. A unit test in `src/cli-args.test.ts` covers it.
