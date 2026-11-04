---
id: RPT-004
title: Slack and Discord webhook URLs are not redacted
type: security
severity: high
status: triaged
created: 2026-11-02
triaged: 2026-11-02
task-id: TSK-004
---

## Summary

`sanitize()` in `src/core/sanitizer.ts` has no pattern for incoming-webhook URLs. A Slack webhook URL passes through unchanged, and a Discord webhook URL is only partly redacted (the generic 32+ alnum rule at `src/core/sanitizer.ts:204` stops at `_`/`-`, so the token tail survives). Anyone holding either URL can post to the channel, and shell commands that call them end up in report episodes and in what is sent to the interpretation engine.

## Location

- `src/core/sanitizer.ts:84` `redactProviderTokens` lists GitHub, Slack `xox*`, Google, Stripe and JWT tokens, but no `hooks.slack.com/services/...` or `discord.com/api/webhooks/...` URLs.

## Reproduction

Calling `sanitize(input).text` (vitest, current main):

The Slack input is built from parts so this file does not trip GitHub secret scanning:

```ts
const slackUrl =
  'https://hooks.slack.com/' + 'services/T024BE7LD/B01ABCDEF2G/' + 'abcdefGHIJKLmnopQRSTuvwx';
sanitize(`curl -X POST ${slackUrl} -d hi`).text === `curl -X POST ${slackUrl} -d hi`; // true: unchanged
```

```

"curl https://discord.com/api/webhooks/123456789012345678/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcdefghijklmnopqrstuv"
=> "curl https://discord.com/api/webhooks/123456789012345678/[REDACTED_ID]_-abcdefghijklmnopqrstuv"
```

## Expected

The secret path segment of both webhook URLs is replaced by a `[REDACTED_<TYPE>]` marker, with tests in `src/core/sanitizer.test.ts`.
