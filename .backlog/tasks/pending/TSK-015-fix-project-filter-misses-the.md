---
id: TSK-015
title: Fix: Project filter misses the project name the report shows when it contains a dot
status: pending
priority: P4
tags: []
created: 2026-11-19
source: report/RPT-015
depends-on: []
---

# Fix: Project filter misses the project name the report shows when it contains a dot

## Description

### Description

`readSessions` (`src/core/session-reader.ts:1228-1235`) matches `--project` only against the encoded directory name and `deriveProjectName(dirName)` without a cwd. For projects outside home the report shows `basename(cwd)` (e.g. `my.app`), but Claude Code encodes `.` as `-` in the directory name, so `--project my.app` finds nothing and exits 2, contrary to `docs/CLI.md:23`. See RPT-015.

## Acceptance Criteria

- [ ] hyntx --project my.app returns the sessions of a project outside home whose cwd basename is my.app
- [ ] Existing directory-name and derived-name matches keep working, case-insensitively
- [ ] A test in src/core/session-reader.test.ts covers a cwd outside home whose basename contains a dot
- [ ] docs/CLI.md describes the --project matching rule accurately

## Notes

## Learnings

## Progress Log

- [2026-11-19] Created