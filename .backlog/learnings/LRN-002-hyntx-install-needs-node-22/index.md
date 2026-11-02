---
id: LRN-002
title: hyntx install needs Node 22 and NODE_ENV=development on hustle
status: active
tags: [tooling, pnpm, node]
task: TSK-001
created: 2026-11-02
---

This environment exports NODE_ENV=production and the default node is v25.8.0, which pnpm rejects for tsup (engines ^22.18 || ^24.11 || >=26). Run with PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH NODE_ENV=development pnpm install, otherwise devDependencies are skipped and husky/vitest are 'not found'.
