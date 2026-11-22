---
id: RPT-017
title: Docker Hub access tokens (dckr_pat_) and GitLab tokens other than glpat- are not redacted
type: security
severity: medium
status: triaged
created: 2026-11-22
triaged: 2026-11-22
task-id: TSK-017
---

## Problem

`redactProviderTokens` (`src/core/sanitizer.ts:87-118`) has a rule for GitLab personal access tokens (`glpat-`, line 93) but none for:

- Docker Hub personal access tokens: `dckr_pat_` + about 27 base64url characters
- Other GitLab token prefixes: runner authentication tokens `glrt-`, deploy tokens `gldt-` (GitLab also issues `glptt-`, `glcbt-`, `gloas-`)

`redactSecretAssignments` catches them only after `name=`, `name:` or a `--token` style flag. Bare (piped to `docker login --password-stdin`, in a here-string, or pasted), `redactOpaqueIds` (`src/core/sanitizer.ts:213-237`) does not catch them: they are shorter than 32 characters after the prefix, or the `-`/`_` breaks the run.

## Reproduction

Built with `pnpm build` (Node 22.22), then:

```js
import { sanitize } from './dist/index.js';
// Sample tokens are split so GitHub push protection does not flag this file.
const dockerPrefix = 'dckr' + '_pat_';
sanitize(`echo ${dockerPrefix}2b3cXyZq9mN7Lk5Jh4Gf3Ds1Aa | docker login -u me --password-stdin`).text
// => unchanged
sanitize(`docker login -u me --password-stdin <<< ${dockerPrefix}2b3c-Xy_Zq9mN7Lk5Jh4Gf3Ds1A`).text
// => unchanged
sanitize('token gldt-AbCdEfGhIjKlMnOpQrSt').text
// => unchanged
sanitize('glrt-t1_AbCdEfGhIjKlMnOpQrSt').text
// => unchanged
```

## Expected

Each token becomes a `[REDACTED_<TYPE>]` placeholder (`[REDACTED_DOCKER_TOKEN]`, `[REDACTED_GITLAB_TOKEN]`), like `glpat-` tokens are today.
