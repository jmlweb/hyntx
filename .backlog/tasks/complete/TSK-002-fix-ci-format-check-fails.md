---
id: TSK-002
title: Fix: CI Format Check fails on main because Prettier checks .backlog index files
status: complete
priority: P2
tags: []
created: 2026-10-30
source: report/RPT-002
depends-on: []
started: 2026-11-07
completed: 2026-11-07
---

# Fix: CI Format Check fails on main because Prettier checks .backlog index files

## Description

`prettier --check .` flags `.backlog/learnings/index.md` and `.backlog/tasks/index.md`, which the flowstate CLI generates. CI run 40923809751 on main failed for this reason, and Build and Smoke Test are skipped behind it. See RPT-002. Ignore `.backlog/` in `.prettierignore` rather than reformatting CLI output.

## Acceptance Criteria

- [x] .prettierignore excludes .backlog/
- [x] pnpm format:check passes on a clean checkout
- [x] CI Format Check, Build and Smoke Test jobs pass on main

## Notes

## Learnings

- LRN-003: Local install needs Node 22.18+/24.11+ and NODE_ENV not production
## Progress Log

- [2026-10-30] Created
- [2026-11-07] Started
- [2026-11-07] criterion 1 — evidence: rg '^\.backlog/$' .prettierignore → match (added in e53cffe); removing the line makes pnpm format:check warn on .backlog/*.md (2026-11-07)
- [2026-11-07] criterion 2 — evidence: pnpm install --frozen-lockfile && pnpm format:check on fresh clone (Node 24) → All matched files use Prettier code style! (2026-11-07)
- [2026-11-07] criterion 3 — evidence: gh run view 41998835677 (CI on main, d018907) → Format Check, Build, Smoke Test all success (2026-11-07)
- [2026-11-07] Completed