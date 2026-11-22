---
id: LRN-008
title: Local pnpm install skips devDependencies here because NODE_ENV=production; use Node 22 and NODE_ENV=development
status: active
tags: [tooling, testing, sanitizer]
task: TSK-009
created: 2026-11-22
---

On the hustle machine NODE_ENV is set to production, so `pnpm install` silently skips devDependencies (no vitest, tsc or husky; the prepare script then fails with "husky: not found"). The default Node (v25) also trips an engines check in a dependency. Working recipe: `export PATH=~/.nvm/versions/node/v22.22.3/bin:$PATH NODE_ENV=development HUSKY=0 && corepack pnpm install --frozen-lockfile`. For IBANs specifically: the redactor runs right after emails and before cards, because grouped IBAN digits would otherwise be partly consumed by card/phone/SSN rules; a mod-97 check (letters as base-36 values, folded digit by digit) keeps uppercase reference codes readable.
