---
id: LRN-002
title: hyntx local install needs Node 22 and NODE_ENV=development
status: active
tags: [tooling, node, pnpm]
task: TSK-001
created: 2026-11-05
---

The shell exports NODE_ENV=production and defaults to Node 25, so pnpm install skips devDependencies (husky not found) and engine-strict rejects Node 25 (engines: ^22.18.0 || ^24.11.0 || >=26). Use PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH NODE_ENV=development before pnpm install.
