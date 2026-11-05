---
id: LRN-001
title: TSK-001 revert was caused by the Release workflow, not the sanitizer fix
status: active
tags: [sanitizer, ci, release]
task: TSK-001
created: 2026-11-05
---

PR #91 landed this same fix and was reverted by #92 because the default-branch run failed. The failing run was the Release workflow (conventionalcommits preset for release notes, fixed in #93), not CI; CI passed on that merge. Check which workflow failed before treating a revert as evidence the change is wrong.
