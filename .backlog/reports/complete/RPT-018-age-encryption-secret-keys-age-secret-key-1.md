---
id: RPT-018
title: age encryption secret keys (AGE-SECRET-KEY-1...) are not redacted
type: security
severity: high
status: triaged
created: 2026-11-25
triaged: 2026-11-25
task-id: TSK-018
---

## Problem

`sanitize` (`src/core/sanitizer.ts:802`) redacts PEM private keys (`redactPEMKeys`, `src/core/sanitizer.ts:291`) but has no rule for age (https://age-encryption.org) X25519 secret keys: `AGE-SECRET-KEY-1` followed by 58 uppercase Bech32 characters. `age-keygen` prints them to stdout and key files hold them as a plain line, so a `cat key.txt` or `age-keygen` tool result carries one.

The generic fallback `redactOpaqueIds` (`src/core/sanitizer.ts:217-237`) does not catch them either: its 32+ alphanumeric rule only redacts runs that contain a lowercase letter, an uppercase letter and a digit, and an age key body is uppercase only; the `-` separators break the run before that. The whole private key therefore reaches the `Report`, the HTML/markdown output and the engine excerpts sent to Anthropic or Ollama.

## Reproduction

Probe test run with vitest on Node 22.22 against the current `main` (4.1.7):

```ts
import { sanitize } from './core/sanitizer.js';
// Sample split so secret scanners do not flag this file.
const prefix = 'AGE-SECRET' + '-KEY-1';
sanitize(`${prefix}GFPYYSJZGFPYYSJZGFPYYSJZGFPYYSJZGFPYYSJZGFPYYSJZGFPQ4EGAEX`).text;
// => unchanged
sanitize(`# ${prefix}QYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGPQYQSZQGP9X4ZPR`).text;
// => unchanged
```

## Expected

The key is replaced, e.g. `[REDACTED_AGE_KEY]` (or `[REDACTED_PEM_KEY]`-style private-key label), case-insensitively since Bech32 may be lowercase. Public recipients (`age1...`) stay readable.
