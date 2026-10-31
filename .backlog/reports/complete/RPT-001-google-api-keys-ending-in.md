---
id: RPT-001
title: Google API keys ending in '-' are not redacted
type: security
severity: high
status: triaged
created: 2026-10-30
triaged: 2026-10-30
task-id: TSK-001
---

## Summary

`redactProviderTokens` in `src/core/sanitizer.ts:92` uses `/\bAIza[0-9A-Za-z_-]{35}\b/g`. The character class allows `-`, but the trailing `\b` needs a word/non-word boundary. When the 39th character is `-` and the key is followed by a space, quote, end of string or other non-word character, `\b` fails. The fixed `{35}` quantifier cannot backtrack to another length, so the whole key stays in clear text.

`docs/SPECS.md:165` promises Google key redaction. About 1 in 64 real keys end in `-`. With the default `claude` engine, sanitized excerpts are sent to Anthropic, so a missed key leaves the machine. It can also appear in Markdown, HTML and JSON reports.

## Reproduction

```ts
import { sanitize } from './src/core/sanitizer.ts';
const k = 'AIza' + 'SyD' + 'x'.repeat(31) + '-'; // 39 chars, valid shape
sanitize('key ' + k + ' end');
// { text: 'key AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx- end', redacted: 0 }
sanitize('GOOGLE_KEY=' + k);
// { text: 'GOOGLE_KEY=AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-', redacted: 0 }
```

The same key with a trailing alphanumeric character is redacted to `[REDACTED_GOOGLE_KEY]`. The secret-assignment rule does not catch the `GOOGLE_KEY=` form either, so nothing else backs this up.

## Test gap

`src/core/sanitizer.test.ts:742` tests only a key ending in `w`. No test covers a key that ends in `-` or `_`.

## Suggested fix

Replace the trailing `\b` with a lookahead that does not depend on the last character, for example `(?![0-9A-Za-z_-])`. Add tests for keys ending in `-` and `_` at the end of a string, before a space and before a quote.
