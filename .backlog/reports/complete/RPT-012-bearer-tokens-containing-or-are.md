---
id: RPT-012
title: Bearer tokens containing + / = or ~ are only partly redacted
type: security
severity: medium
status: triaged
created: 2026-11-13
triaged: 2026-11-13
task-id: TSK-012
---

## Problem

`redactBearerTokens` (`src/core/sanitizer.ts:71-74`) matches the token with `[a-zA-Z0-9._-]{20,}`. Many bearer tokens are base64 (standard alphabet, with `+`, `/` and `=` padding) or contain `~` (RFC 6750 `b64token` allows `-._~+/` and trailing `=`). The match stops at the first such character, so the rest of the token stays in the text. When the tail is shorter than 24 characters, `redactOpaqueIds` does not catch it either.

## Reproduction

Built with `pnpm build` (Node 24), then:

```js
import { sanitize } from './dist/index.js';
sanitize('Authorization: Bearer abcdefghijklmnopqrstuvwx+yz/0123456789==').text
// => 'Authorization: Bearer [REDACTED_TOKEN]+yz/0123456789=='
sanitize('Bearer ya29.a0AfH6SMBx-abc_defghijklmn+op').text
// => 'Bearer [REDACTED_TOKEN]+op'
```

Part of the credential leaks into the `Report`, into engine requests and into shared reports.

## Expected

The whole RFC 6750 token (`[A-Za-z0-9._~+/-]+=*`) after `Bearer ` is replaced, so the output is `Authorization: Bearer [REDACTED_TOKEN]` with nothing after it.

## Notes

`src/core/sanitizer.test.ts:83-120` only tests JWT-shaped and alphanumeric tokens.
