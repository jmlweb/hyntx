---
id: TSK-002
title: Fix: CI Format Check fails on main because Prettier checks .backlog index files
status: pending
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-002
depends-on: []
---

# Fix: CI Format Check fails on main because Prettier checks .backlog index files

## Description

`prettier --check .` flags `.backlog/learnings/index.md` and `.backlog/tasks/index.md`, which the flowstate CLI generates. CI run 40923809751 on main failed for this reason, and Build and Smoke Test are skipped behind it. See RPT-002. Ignore `.backlog/` in `.prettierignore` rather than reformatting CLI output.

## Acceptance Criteria

- [ ] .prettierignore excludes .backlog/
- [ ] pnpm format:check passes on a clean checkout
- [ ] CI Format Check, Build and Smoke Test jobs pass on main

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created