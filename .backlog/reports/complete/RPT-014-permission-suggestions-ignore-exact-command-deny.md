---
id: RPT-014
title: Permission suggestions ignore exact-command deny and ask rules such as Bash(docker ps)
type: bug
severity: low
status: triaged
created: 2026-11-16
triaged: 2026-11-16
task-id: TSK-014
---

## Problem

`isRestricted` (src/core/permissions.ts:165) is meant to skip any suggested allow rule that a `deny` or `ask` rule touches (docs/SPECS.md:21 and :127: "A suggestion is skipped if an `allow` rule already covers it or a `deny`/`ask` rule touches it"). It misses deny/ask rules that name the bare command with no wildcard.

`overlaps` (src/core/permissions.ts:126-132) only returns true when:

- `ruleCovers` matches the probe `"<command> --probe"` (src/core/permissions.ts:117), which an exact rule like `Bash(docker ps)` never matches, or
- the rule pattern starts with `"<command> "` (with a trailing space, src/core/permissions.ts:131), which `docker ps` does not.

The suggested rule is `Bash(<command> *)` (src/core/permissions.ts:135). Per Claude Code's syntax, a trailing ` *` also matches the bare command (comment at src/core/permissions.ts:6-7). So the suggestion covers exactly the command the user denied or put under `ask`, and Hyntx still offers it.

A deny rule with an inner wildcard that matches the bare command (`Bash(gh * view)` against `gh pr view`) is missed the same way.

## Reproduction

```ts
// run with: npx tsx repro.mts /path/to/src/core/permissions.ts
const { isRestricted } = await import(process.argv[2]);
const mk = (rules) => ({ user: [], byProject: {}, restricted: { user: rules, byProject: {} } });
isRestricted('docker ps', [], mk(['Bash(docker ps)']));    // false, expected true
isRestricted('gh pr list', [], mk(['Bash(gh pr list)']));  // false, expected true
isRestricted('gh pr view', [], mk(['Bash(gh * view)']));   // false, expected true
isRestricted('docker ps', [], mk(['Bash(docker ps *)']));  // true
isRestricted('docker ps', [], mk(['Bash(docker ps -a)'])); // true
```

Observed output on main (4.1.4, commit 440da79):

```
Bash(docker ps) -> false
Bash(gh pr list) -> false
Bash(gh * view) -> false
Bash(docker ps *) -> true
Bash(docker ps -a) -> true
```

## Impact

With `"ask": ["Bash(gh pr list)"]` in settings, a run with repeated `gh pr list` permission prompts produces an insight whose action is `Bash(gh pr list *)` (src/core/insights.ts:898-907). That breaks the documented contract. The plugin skill may then add an allow rule the user deliberately kept under `ask`. Claude Code still evaluates deny and ask first, so the suggested rule changes nothing for the bare command and only adds noise.

## Suggested fix

In `overlaps`, also return true when the rule pattern, as a glob, matches the bare `command` (test `^pattern$` against `command` itself, not only against `"<command> --probe"`). Add the three cases above to src/core/permissions.test.ts.
