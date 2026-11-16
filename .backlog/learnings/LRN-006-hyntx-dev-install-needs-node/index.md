---
id: LRN-006
title: Hyntx dev install needs Node 24 and NODE_ENV not production
status: active
tags: [tooling, testing]
task: TSK-007
created: 2026-11-16
---

pnpm install silently skips devDependencies when the shell exports NODE_ENV=production (husky/vitest then 'not found'), and engine-strict rejects Node 25. Use Node 24 (~/.nvm/versions/node/v24.22.0/bin first in PATH) with NODE_ENV=development for install and NODE_ENV=test for vitest.
