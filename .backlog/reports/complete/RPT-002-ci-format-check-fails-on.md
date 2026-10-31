---
id: RPT-002
title: CI Format Check fails on main because Prettier checks .backlog index files
type: bug
severity: high
status: triaged
created: 2026-10-30
triaged: 2026-10-30
task-id: TSK-002
---

## Summary

Commit d8672c4 (`chore(backlog): initialize flowstate backlog`) added `.backlog/`. The flowstate CLI writes Markdown tables that Prettier does not accept. `.prettierignore` lists only `dist/` and `pnpm-lock.yaml`, with no `.backlog/` entry. So `pnpm format:check` (`prettier --check .`) fails.

In `.github/workflows/ci.yml`, the `build` job has `needs: [typecheck, lint, format, test]`. A failing `format` job therefore also skips Build and Smoke Test, on `main` and on every PR.

## Observed

```
$ pnpm format:check
Checking formatting...
[warn] .backlog/learnings/index.md
[warn] .backlog/tasks/index.md
[warn] Code style issues found in 2 files. Run Prettier with --write to fix.
 ELIFECYCLE  Command failed with exit code 1.
```

`gh run list --branch main --workflow CI`: run 40923809751 on d8672c4 is `failure`. The two runs before it (143921c, b067356) are `success`.

Prettier wants to realign the table rows in `.backlog/tasks/index.md:5-6` and `.backlog/learnings/index.md:5-6`.

## Suggested fix

Add `.backlog/` to `.prettierignore`. Running `prettier --write` does not fix it: the CLI rebuilds the index files on every mutation, and lint-staged's `*.md` rule would then rewrite CLI output.
