# Technical Debt

This document tracks technical debt issues in the codebase. Use `/analyze-debt` to update based on current state.

---

## Summary

| Category     | Count | Priority |
| ------------ | ----- | -------- |
| Release      | 1     | P0       |
| Code Quality | 3     | P1-P2    |
| Architecture | 2     | P2       |
| Testing      | 5     | P1-P2    |
| Dependencies | 0     | -        |

**Last analyzed**: 2026-10-03, at the end of the v4 rewrite (branch `feat/v4-session-insights`). Items come from the independent review of that branch and from what could not be verified on the author's logs.

---

## Active Items

### Release

- **P0 - npm publish of 3.1.0 never landed.** The git tag `v3.1.0` exists and `package.json` says 3.1.0, but npm `latest` is 3.0.2. Whatever blocked that publish (token, provenance, 2FA) will block 4.0.0 as well. Check the last Release workflow run before merging the v4 branch. Until 4.0.0 is on npm, `npx hyntx` runs v3 and the plugin's `npx hyntx@4` fallback exits 3.

### Testing

- **P1 - Log formats assumed, not observed.** Interruption markers, user-rejection wording, permission-rule denial text and compaction records (`compact_boundary`, `isCompactSummary`) did not occur in the logs the rewrite was developed against. The reader and detectors for them are covered by synthetic fixtures only. Verify against real logs that contain them.
- **P1 - Not proven on heavy usage.** Development data was 12 sessions and about 40 typed prompts, mostly in auto mode with almost no friction. Detector precision and the usefulness of insights on friction-rich logs are unknown.
- **P2 - HTML report.** The light theme, print layout and the Copy buttons were not exercised in a real browser (only dark-theme headless screenshots and a 360px overflow check).
- **P2 - Plugin.** Not verified: the interactive confirm-then-write flow, `claude plugin marketplace add` / `install`, a global v4 install, the `npx hyntx@4` success path, and the Windows no-shell runner path.
- **P2 - Engines.** The `claude` not-logged-in path is mocked only. `cli.ts` has no end-to-end test.

### Code Quality

- **P1 - Unclassified tool-error insight is weak.** When no known cause matches, the insight quotes the first line of tool output as the "typical error", which can be ordinary output (for example `id: TSK-066`). Either find the real error line or drop the quote.
- **P2 - Correction detector trades recall for precision.** Real corrections that open with "don't", "instead", "actually", "wait" (and the Spanish equivalents) score below the threshold unless the previous turn was interrupted. Without an interpretation step they are not counted.
- **P2 - Benign-exit heuristic.** A Bash `Exit code 1` from grep-like commands is not counted as an error when the first 400 characters of output contain no error vocabulary; a real failure without such words is missed.

### Architecture

- **P2 - Partial verdict coverage.** Engines review at most 16 episodes (8 for Ollama), so on large logs most insights stay `unverified`. Coverage is disclosed, not solved. Ollama verdicts also vary between runs.
- **P2 - Actions lack a project path.** Project-scoped actions carry a project name and `file: "CLAUDE.md"` but not the project directory, so the plugin can apply them only when run from that project. Managed (enterprise) settings are not read when checking existing permission rules. `plugin.json` has no `version` on purpose, which makes `claude plugin validate --strict` fail.

---

## Resolved Items

_None since the v4 rewrite._

---

## Categories

- **Code Quality**: Style, complexity, maintainability
- **Architecture**: Design, module organization, patterns
- **Testing**: Coverage, quality, infrastructure
- **Dependencies**: Outdated packages, security, unused deps
- **Release**: Anything that blocks or endangers publishing

## Priority Levels

- **P0**: Security issues, breaking changes
- **P1**: Performance, significant maintainability issues
- **P2**: Quality improvements, minor refactoring
- **P3**: Nice-to-have, cosmetic changes
