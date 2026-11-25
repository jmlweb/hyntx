---
id: RPT-019
title: Databricks personal access tokens (dapi...) and Square access tokens (sq0atp-) are not redacted
type: security
severity: medium
status: triaged
created: 2026-11-25
triaged: 2026-11-25
task-id: TSK-019
---

## Problem

`redactProviderTokens` (`src/core/sanitizer.ts:87`) has no rule for:

- Databricks personal access tokens: `dapi` + 32 lowercase hex characters (optionally `-<n>` suffix)
- Square OAuth access tokens: `sq0atp-` + 22 base64url characters

`redactSecretAssignments` / `redactCommandLineSecrets` catch them only after `name=`, `name:` or a `--token` style flag. Bare (in a sentence, a header or a here-string), `redactOpaqueIds` (`src/core/sanitizer.ts:217-237`) misses them: the Databricks hex body is glued to the `dapi` letters, so the hex rule's `(?<![A-Za-z0-9])` lookbehind fails, and the 32+ alphanumeric rule requires an uppercase letter; the Square body is shorter than 32 characters.

## Reproduction

Probe test run with vitest on Node 22.22 against the current `main` (4.1.7):

```ts
import { sanitize } from './core/sanitizer.js';
// Samples split so secret scanners do not flag this file.
sanitize('use ' + 'dapi' + '1a2b3c4d5e6f708192a3b4c5d6e7f8091 for the workspace');
// => { text: 'use dapi1a2b3c4d5e6f708192a3b4c5d6e7f8091 for the workspace', redacted: 0 }
sanitize('Square token is ' + 'sq0' + 'atp-1a2B3c4D5e6F7g8H9i0J1k');
// => { text: <input unchanged, full token included>, redacted: 0 }
```

For comparison, `databricks configure --token dapi...` and `token=sq0atp-...` are redacted (`[REDACTED_SECRET]`), and `sq0csp-` secrets (longer, mixed case) are caught by the opaque-id rule.

## Expected

Both are replaced with a typed placeholder (e.g. `[REDACTED_DATABRICKS_TOKEN]`, `[REDACTED_SQUARE_TOKEN]`) wherever they appear. A 4-letter word followed by hex that is not `dapi` stays as is.
