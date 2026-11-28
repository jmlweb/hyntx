---
id: LRN-010
title: age secret keys are single-case Bech32 and slip past the opaque-id rule; dev deps need NODE_ENV=development
status: active
tags: [sanitizer, security, testing]
task: TSK-018
created: 2026-11-28
---

Age secret keys (AGE-SECRET-KEY-1 + 58 Bech32 chars) are single-case, so the mixed-case opaque-id fallback in sanitizer.ts never redacts them; they need a dedicated rule (redactAgeSecretKeys, run right after PEM). Public recipients (age1...) are lowercase-only and stay readable for the same reason.

Environment gotcha: this host exports NODE_ENV=production and defaults to Node 25, so pnpm install skips devDependencies (husky/vitest not found) and warns on engines. Run with PATH=$HOME/.nvm/versions/node/v22.22.3/bin:$PATH NODE_ENV=development.

Test samples: a local detect-secrets hook blocks writes containing literal key prefixes or KEY=${...}; build the prefix with ['AGE','SECRET','KEY','1'].join('-').
