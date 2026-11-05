---
id: RPT-007
title: SendGrid API keys (SG.) are not redacted when they appear bare
type: security
severity: high
status: triaged
created: 2026-11-05
triaged: 2026-11-05
task-id: TSK-007
---

## Summary

`sanitize` has no pattern for SendGrid API keys (`SG.<22 chars>.<43 chars>`, base64url alphabet). A bare key in a prompt, command or tool output passes through whole, so it reaches the `Report` and, with the default engine, Anthropic. A SendGrid key is a usable credential on its own.

The generic opaque-id fallback does not catch it either: the base64url `_` and `-` characters split the key into runs shorter than the 32-character threshold, and the mixed-case-plus-digit rule skips segments without a digit. When a key does get partly redacted, it is by chance.

## Location

- `src/core/sanitizer.ts:84-101`: `redactProviderTokens` covers GitHub, Hugging Face, npm, GitLab, Slack, Google, Stripe and JWT, but has no `SG.` pattern.
- `src/core/sanitizer.ts:189-210`: `redactOpaqueIds` only matches runs of `[A-Za-z0-9]` (or hex / padded base64), so `_`/`-` break the match.

## Reproduction

The sample keys are built with `join` so this file does not trip secret scanning. With `tsx` on current main (Node 24):

```ts
import { sanitize } from './src/core/sanitizer.ts';
const realistic = ['SG', 'nGeVfQFQQZKt5jhy7VzrYA', 'ac1Ch8sXzJ8Z8nk1PQ_eGqX9PXhqtg2HOsbI8hXBxb4'].join('.');
const lettersOnly = ['SG', 'abcdefghijklmnopqrstuv', 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ'].join('.');
const withDigits = ['SG', 'Ab3dEfGh1jKlMnOpQrStUv', 'Wx4yZaBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789ab'].join('.');

sanitize(`key ${realistic} here`).text; // unchanged: whole key leaks
sanitize(lettersOnly).text;             // unchanged: whole key leaks
sanitize(withDigits).text;              // "SG.Ab3dEfGh1jKlMnOpQrStUv.[REDACTED_ID]": key id still visible, caught only by the opaque-id digit rule
```

Scope: assigned and header forms are already caught by other rules (`SENDGRID_API_KEY=<key>` becomes `SENDGRID_API_KEY=[REDACTED_SECRET]`, `Authorization: Bearer <key>` becomes `Authorization: Bearer [REDACTED_TOKEN]`). The gap is bare occurrences: pasted into a prompt, printed in tool output, or inside a config file shown by `cat`.

## Expected

`SG.` keys are replaced whole, for example with `[REDACTED_SENDGRID_KEY]`, with tests next to the other provider-token cases in `src/core/sanitizer.test.ts` (build the sample keys at runtime so the test file does not trip GitHub secret scanning). `docs/SPECS.md:165` lists the covered providers and should include it.
