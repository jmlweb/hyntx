---
id: RPT-005
title: Passwords given as short flags (docker login -p, sshpass -p, redis-cli -a) are not redacted
type: security
severity: high
status: triaged
created: 2026-11-02
triaged: 2026-11-02
task-id: TSK-005
---

## Summary

`redactCommandLineSecrets` handles long flags (`--password x`), `mysql -pSECRET` and `curl -u user:pass`, but not the common short password flags of other tools. A plain-text password in such a command is kept verbatim in the sanitized session model, in report episodes and in what is sent to the interpretation engine.

## Location

- `src/core/sanitizer.ts:153` `redactCommandLineSecrets`: the long-flag rule needs `--?password|pass|...`, and the only short-flag rule is scoped to `mysql`/`mysqldump`/`mysqladmin` (`src/core/sanitizer.ts:160`).

## Reproduction

Calling `sanitize(input).text` (vitest, current main):

```
"docker login -u me -p S3cretPass registry.example.com" => unchanged
"echo \"$PW\" | docker login -u me -p S3cretPass registry.example.com" => unchanged
"sshpass -p S3cretPass ssh deploy@host" => unchanged
"redis-cli -a S3cretPass ping" => unchanged
```

For comparison, `"mysql -u root -phunter2"` becomes `"mysql -u root -p[REDACTED_SECRET]"`.

## Expected

The value after `docker login -p`/`--password`, `sshpass -p` and `redis-cli -a` is redacted the same way the `mysql -p` value is, scoped to those commands so `mkdir -p` and similar are untouched, with tests in `src/core/sanitizer.test.ts`.
