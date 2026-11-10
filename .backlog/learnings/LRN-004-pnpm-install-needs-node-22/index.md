---
id: LRN-004
title: pnpm install needs Node 22 and NODE_ENV unset on hustle
status: active
tags: [tooling, node, pnpm]
task: TSK-004
created: 2026-11-10
---

On the hustle machine, NODE_ENV=production makes pnpm skip devDependencies (vitest, husky missing), and the default Node 25.8.0 fails ERR_PNPM_UNSUPPORTED_ENGINE because tsup 9 requires ^22.18 || ^24.11 || >=26. Run with PATH=$HOME/.nvm/versions/node/v22.22.3/bin:$PATH NODE_ENV=development and `npx -y pnpm@9.15.4` (the packageManager version) before check/test/build.
