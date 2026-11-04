---
id: TSK-004
title: Fix: Slack and Discord webhook URLs are not redacted
status: pending
priority: P2
tags: []
created: 2026-11-02
source: report/RPT-004
depends-on: []
---

# Fix: Slack and Discord webhook URLs are not redacted

## Description

### Description

`redactProviderTokens` (`src/core/sanitizer.ts:84`) has no webhook URL patterns. Slack incoming-webhook URLs pass through unchanged and Discord webhook URLs keep their token tail after `_`/`-`. See RPT-004 for the reproduction. Add patterns for both URL shapes in the provider-token pass.

## Acceptance Criteria

- [ ] sanitize() replaces the secret path of hooks.slack.com/services/... URLs with a [REDACTED_<TYPE>] marker
- [ ] sanitize() redacts the full token segment of discord.com/api/webhooks/<id>/<token> URLs, including - and _ characters
- [ ] src/core/sanitizer.test.ts covers both URL shapes
- [ ] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

## Progress Log

- [2026-11-02] Created