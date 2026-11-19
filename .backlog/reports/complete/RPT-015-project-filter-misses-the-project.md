---
id: RPT-015
title: Project filter misses the project name the report shows when it contains a dot
type: bug
severity: low
status: triaged
created: 2026-11-19
triaged: 2026-11-19
task-id: TSK-015
---

## Problem

`docs/CLI.md:23` documents `--project <name>` as "Only projects whose name or directory contains `<name>` (case-insensitive)". For a project outside the home directory, the report names it after `basename(cwd)` (`src/core/session-reader.ts:173`, `deriveProjectName`), so a cwd of `/opt/work/my.app` is shown as `my.app`. The filter in `readSessions` (`src/core/session-reader.ts:1228-1235`) only compares `<name>` with the encoded directory name (`-opt-work-my-app`) and with `deriveProjectName(dirName)` called without a cwd, which returns that same encoded name. Claude Code encodes `.` (and `/`) as `-`, so a filter containing a dot never matches the directory, and the displayed name is never consulted. The run ends with "No sessions found" and exit code 2.

The plugin forwards `.` in project names on purpose (`skills/hyntx/scripts/analyzer-lib.mjs:10`, `PROJECT_VALUE`), so `/hyntx:hyntx 7 my.app` hits the same dead end.

## Reproduction

Built CLI (`pnpm build`), Node 24, a fake projects dir with one session whose cwd is `/opt/work/my.app`, stored under `-opt-work-my-app/s1.jsonl` (one typed user record plus one assistant record, timestamp now):

```text
$ HYNTX_CLAUDE_PROJECTS_DIR=$T/projects HYNTX_HOME=$T/home node dist/cli.js --no-llm --format json | jq -c '[.metrics.byProject[].project]'
["my.app"]          # exit 0

$ ... node dist/cli.js --no-llm --format json --project=my.app
ERROR: No sessions found for this period and filters.   # exit 2

$ ... node dist/cli.js --no-llm --format json --project=my-app
["my.app"]          # exit 0
```

The name the report prints cannot be used to filter it.

## Expected

`--project` matches a project when `<name>` is contained, case-insensitively, in the name the report shows for it or in its directory. Filtering by `my.app` returns the `my.app` sessions. One way: also compare the filter with `.` and `/` replaced by `-` (the encoding Claude Code applies to directory names) against the directory name. A test in `src/core/session-reader.test.ts` covers a cwd outside home whose basename contains a dot.
