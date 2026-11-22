---
id: RPT-016
title: Bare Google OAuth access tokens (ya29.) are not redacted
type: security
severity: medium
status: triaged
created: 2026-11-22
triaged: 2026-11-22
task-id: TSK-016
---

## Problem

`redactProviderTokens` (`src/core/sanitizer.ts:87-118`) has no rule for Google OAuth 2.0 access tokens (`ya29.` followed by a long base64url string). RPT-012 / TSK-012 covers them only after `Bearer `, and `redactSecretAssignments` only after `name=` or `name:`.

A bare token is what `gcloud auth print-access-token` prints, so it shows up as-is in tool output and pasted text. `redactOpaqueIds` (`src/core/sanitizer.ts:213-237`) does not catch it either: the `.`, `-` and `_` in the token split it into runs shorter than the 32-character threshold (or runs that lack one of its required character classes).

## Reproduction

Built with `pnpm build` (Node 22.22), then:

```js
import { sanitize } from './dist/index.js';
sanitize('ya29.a0AfB_byC1x2Y3z4-QwErTyUiOp_AsDfGhJkL-ZxCvBnM1234567890abcdEFGH').text
// => 'ya29.a0AfB_byC1x2Y3z4-QwErTyUiOp_AsDfGhJkL-ZxCvBnM1234567890abcdEFGH' (unchanged)
```

## Expected

The whole token becomes a `[REDACTED_<TYPE>]` placeholder (for example `[REDACTED_GOOGLE_TOKEN]`), the same way bare SendGrid keys are handled (RPT-007). The `Bearer ya29...` case in TSK-012 should keep working.
