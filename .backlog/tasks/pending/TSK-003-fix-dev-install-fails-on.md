---
id: TSK-003
title: Fix: Dev install fails on Node 22.0-22.17 despite documented Node 22 support
status: pending
priority: P4
tags: []
created: 2026-10-30
source: report/RPT-003
depends-on: []
---

# Fix: Dev install fails on Node 22.0-22.17 despite documented Node 22 support

## Description

With `engine-strict=true` in `.npmrc`, dev dependencies such as tsup (`^22.18.0 || ^24.11.0 || >=26.0.0`) and `@semantic-release/git` (`^22.22.2 || >=24.15`) refuse to install below their minimums. `docs/DEVELOPMENT.md:5` still says "Node.js 22 or later". See RPT-003.

## Acceptance Criteria

- [ ] docs/DEVELOPMENT.md and .nvmrc state a contributor Node minimum that satisfies every dev dependency engines range
- [ ] pnpm install --frozen-lockfile succeeds on the documented minimum Node version
- [ ] Published package engines.node still reflects the runtime minimum

## Notes

## Learnings

## Progress Log

- [2026-10-30] Created