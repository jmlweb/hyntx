---
id: RPT-011
title: Azure storage account keys after 'AccountKey=' are only partly redacted
type: security
severity: medium
status: triaged
created: 2026-11-10
triaged: 2026-11-10
task-id: TSK-011
---

## Summary

An Azure Storage connection string keeps part of its `AccountKey` after sanitizing. The tail of the base64 key leaks into the `Report`. Azure Shared Access Signature (`sig=`) values with URL-encoded characters also leak a prefix.

## Location

- `src/core/sanitizer.ts:203`: the base64 rule `(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{24,}={1,2}` cannot start right after `=`, so `AccountKey=<base64>==` never matches it.
- `src/core/sanitizer.ts:207`: the 32+ alphanumeric rule then redacts only the run before the first `/` or `+`; the rest stays.
- `src/core/sanitizer.ts:117`: the secret-assignment names do not include `AccountKey` (`access[_-]?key` does not match it), so the assignment rule does not catch it either.

## Reproduction

Run `sanitize()` from `src/core/sanitizer.ts` (vitest, Node 25.8.0, commit abc014f) on the public Azurite development connection string:

Input:

```
DefaultEndpointsProtocol=https;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;
```

Observed output:

```
DefaultEndpointsProtocol=https;AccountName=devstoreaccount1;AccountKey=[REDACTED_ID]/K1SZFPTOtr/KBHBeksoGMGw==;
```

26 characters of the 88-character key remain. Where the first `/` or `+` sits earlier, more of the key leaks.

SAS token input:

```
https://acct.blob.core.windows.net/c/f?sv=2022-11-02&sp=r&se=2026-12-01&sig=AbCdEf%2BGhIjKlMnOpQrStUvWxYz0123456789abcd%3D
```

Observed output: `...&sig=AbCdEf%[REDACTED_ID]%3D` (the signature prefix `AbCdEf` leaks).

For comparison, `az storage blob list --account-key <same key>` is fully redacted through the `--...key` command-line rule, and `SharedAccessKey=...` is fully redacted through the assignment rule.

## Expected

The whole `AccountKey` value and the whole `sig` value are replaced, for example `AccountKey=[REDACTED_SECRET]` and `sig=[REDACTED_SECRET]`.

## Impact

Connection strings appear in prompts, `.env` reads and tool output. AGENTS.md states every string in a `Report` is redacted before it is rendered, sent to an engine or stored. A partial key is not usable alone, but the contract is broken and the leaked share grows with key layout.
