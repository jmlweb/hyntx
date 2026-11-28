---
id: TSK-020
title: Fix: Engine failure notes bypass sanitizeReport and leak OLLAMA_HOST credentials into the Report
status: pending
priority: P3
tags: []
created: 2026-11-28
source: report/RPT-020
depends-on: []
---

# Fix: Engine failure notes bypass sanitizeReport and leak OLLAMA_HOST credentials into the Report

## Description

### Description

The catch branch of `interpretReport` (src/engines/index.ts:63-72) appends engine error messages to `dataQuality.notes` without the `sanitizeReport` pass that the success branch gets (src/engines/index.ts:54). An `OLLAMA_HOST` such as `http://admin:secret@host:11434` therefore ends up verbatim in the rendered report, the JSON output and the HTML file (src/engines/ollama.ts:83). The Ollama HTTP body slice (src/engines/ollama.ts:95) and the claude stderr/stdout slice (src/engines/claude.ts:110) take the same path. The stderr notice in src/engines/disclosure.ts also prints the host with its credentials. Fix: sanitize the failure-path report and strip userinfo from the displayed host. See RPT-020.

## Acceptance Criteria

- [ ] interpretReport sanitizes the note it adds when an engine is unavailable or fails (src/engines/index.ts catch branch)
- [ ] OLLAMA_HOST userinfo never appears unredacted in dataQuality.notes or in the stderr data-destination notice
- [ ] src/engines/index.test.ts covers a credentialed OLLAMA_HOST and asserts the password is absent from the returned Report
- [ ] pnpm check && pnpm test pass

## Notes

## Learnings

## Progress Log

- [2026-11-28] Created