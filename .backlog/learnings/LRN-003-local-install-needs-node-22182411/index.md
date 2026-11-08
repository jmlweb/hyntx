---
id: LRN-003
title: Local install needs Node 22.18+/24.11+ and NODE_ENV not production
status: active
tags: [tooling, node, pnpm]
task: TSK-002
created: 2026-11-07
---

pnpm install in this repo needs Node 22.18+ or 24.11+ (tsup 9 engines: ^22.18.0 || ^24.11.0 || >=26.0.0); Node 25 fails with ERR_PNPM_UNSUPPORTED_ENGINE. A shell with NODE_ENV=production also skips devDependencies, so husky/prettier are missing. Use Node 24 and NODE_ENV=development locally.
