---
id: TSK-004
title: Fix: Slack and Discord webhook URLs are not redacted
status: complete
priority: P2
tags: []
created: 2026-11-02
source: report/RPT-004
depends-on: []
started: 2026-11-10
completed: 2026-11-10
---

# Fix: Slack and Discord webhook URLs are not redacted

## Description

### Description

`redactProviderTokens` (`src/core/sanitizer.ts:84`) has no webhook URL patterns. Slack incoming-webhook URLs pass through unchanged and Discord webhook URLs keep their token tail after `_`/`-`. See RPT-004 for the reproduction. Add patterns for both URL shapes in the provider-token pass.

## Acceptance Criteria

- [x] sanitize() replaces the secret path of hooks.slack.com/services/... URLs with a [REDACTED_<TYPE>] marker
- [x] sanitize() redacts the full token segment of discord.com/api/webhooks/<id>/<token> URLs, including - and _ characters
- [x] src/core/sanitizer.test.ts covers both URL shapes
- [x] pnpm check, pnpm test and pnpm build pass

## Notes

## Learnings

- LRN-004: pnpm install needs Node 22 and NODE_ENV unset on hustle
## Progress Log

- [2026-11-02] Created
- [2026-11-10] Started
- [2026-11-10] criterion 1 — evidence: pnpm exec vitest run src/core/sanitizer.test.ts → Slack webhook test passes; output is https://hooks.slack.com/services/[REDACTED_SLACK_WEBHOOK] (failed before the fix) (2026-11-10)
- [2026-11-10] criterion 2 — evidence: pnpm exec vitest run src/core/sanitizer.test.ts → 3 Discord cases (discord.com, discordapp.com, /api/v10/) pass; token with _- tail fully replaced by [REDACTED_DISCORD_WEBHOOK] (failed before the fix) (2026-11-10)
- [2026-11-10] criterion 3 — evidence: src/core/sanitizer.test.ts adds 4 tests in 'provider tokens and secret assignments' → 119/119 pass (2026-11-10)
- [2026-11-10] criterion 4 — evidence: pnpm check → exit 0; pnpm test → 451/451 passed; pnpm build → exit 0 (Node 22.22.3) (2026-11-10)
- [2026-11-10] Completed