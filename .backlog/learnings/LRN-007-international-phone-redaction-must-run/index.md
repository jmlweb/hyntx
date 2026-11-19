---
id: LRN-007
title: International phone redaction must run before the US 3-3-4 rule and count digits, not groups
status: active
tags: [sanitizer, security, testing]
task: TSK-008
created: 2026-11-19
---

In redactPhoneNumbers, the + international rule must run before the US 3-3-4 rule. Otherwise a grouped international number such as +49 30 123 456 7890 can have a US-looking fragment redacted out of its middle, leaving the country code and other digits in the text. The international rule uses a per-digit optional separator, (?:[-. ]?[0-9]){8,14}, which bounds total digits to 9-15 (E.164) regardless of grouping, and uses a literal space rather than \s so a match never spans a line break. Node 25 with NODE_ENV=production skips devDependencies on pnpm install in this environment; use NODE_ENV=development with Node 22 (.nvmrc).
