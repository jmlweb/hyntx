---
id: RPT-003
title: Dev install fails on Node 22.0-22.17 despite documented Node 22 support
type: bug
severity: low
status: triaged
created: 2026-10-30
triaged: 2026-10-30
task-id: TSK-003
---

## Summary

`docs/DEVELOPMENT.md:5` says "Node.js 22 or later (`.nvmrc`)", and `package.json` declares `"engines": { "node": ">=22.0.0" }`. `.npmrc` sets `engine-strict=true`, so pnpm refuses to install any dependency whose `engines` range excludes the running Node. Several dev dependencies require more than the documented minimum:

- `tsup` 9.0.0: `^22.18.0 || ^24.11.0 || >=26.0.0`
- `vitest`: `^22.12.0 || ^24.0.0 || >=26.0.0`
- `@semantic-release/git`, `@semantic-release/changelog`: `^22.22.2 || >=24.15`
- `@jmlweb/*` configs, `@commitlint/*`: `>=22.12.0`

So `pnpm install` fails on Node 22.0-22.21, which the docs say is supported. It also fails on Node 25.

Runtime dependencies (`chalk` `>=22`, `ora` `>=20`) do match `>=22.0.0`, so end users who install the published package are not affected.

## Observed (Node v25.8.0)

```
$ pnpm install --frozen-lockfile
Your Node version is incompatible with "tsup@9.0.0(jiti@2.7.0)(postcss@8.5.31)(typescript@6.0.3)(yaml@2.9.1)".
Expected version: ^22.18.0 || ^24.11.0 || >=26.0.0
Got: v25.8.0
```

## Suggested fix

Raise the contributor minimum in `docs/DEVELOPMENT.md` and `.nvmrc` to the strictest dev dependency range (for example `22.22.2`), or add `devEngines`. Keep the published `engines` at the runtime minimum.
