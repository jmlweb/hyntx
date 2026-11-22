---
id: TSK-017
title: Fix: Docker Hub access tokens (dckr_pat_) and GitLab tokens other than glpat- are not redacted
status: pending
priority: P3
tags: []
created: 2026-11-22
source: report/RPT-017
depends-on: []
---

# Fix: Docker Hub access tokens (dckr_pat_) and GitLab tokens other than glpat- are not redacted

## Description

Add provider rules to `redactProviderTokens` in `src/core/sanitizer.ts`: Docker Hub personal access tokens (`dckr_pat_`) and the GitLab token prefixes beyond `glpat-` (`glrt-`, `gldt-`, `glptt-`, `glcbt-`, `gloas-`). Reproduction and details in RPT-017.

## Acceptance Criteria

- [ ] sanitize() replaces bare dckr_pat_ tokens, including ones with - and _, with a [REDACTED_<TYPE>] placeholder
- [ ] sanitize() replaces bare GitLab glrt-, gldt-, glptt-, glcbt- and gloas- tokens like glpat- tokens today
- [ ] Unit tests in src/core/sanitizer.test.ts cover each prefix in bare form
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-22] Created