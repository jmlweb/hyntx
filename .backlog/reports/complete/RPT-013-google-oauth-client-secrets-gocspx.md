---
id: RPT-013
title: Google OAuth client secrets (GOCSPX-), Stripe webhook secrets (whsec_) and Slack app tokens (xapp-) are not redacted
type: security
severity: medium
status: triaged
created: 2026-11-13
triaged: 2026-11-13
task-id: TSK-013
---

## Problem

`redactProviderTokens` (`src/core/sanitizer.ts:86-113`) has no rule for three common credential prefixes:

- Google OAuth client secrets: `GOCSPX-` + 28 chars
- Stripe webhook signing secrets: `whsec_` + 32+ chars
- Slack app-level tokens: `xapp-1-...` (the Slack rule at line 93 covers only `xox[abprs]-`)

`redactSecretAssignments` catches them only after `name=` or `name:`. In the other forms (bare in pasted text or tool output, or after a space as in `client_secret GOCSPX-...`), `redactOpaqueIds` does not catch them either: the dash, underscore or prefix breaks its runs of 32 alphanumeric characters.

## Reproduction

Built with `pnpm build` (Node 24), then:

```js
import { sanitize } from './dist/index.js';
sanitize('client_secret GOCSPX-abcdefghijklmnopqrstuvwxyz12').text
// => unchanged
sanitize('whsec_abcdefghijklmnopqrstuvwxyz012345').text
// => unchanged
sanitize('xapp-1-A0123456789-0123456789012-abcdef0123456789').text
// => unchanged
```

## Expected

Each one is replaced by a `[REDACTED_<TYPE>]` placeholder, the same way bare SendGrid keys are handled (RPT-007).
