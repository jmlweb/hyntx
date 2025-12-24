# Future Plans (Not Current Work)

This document captures **future-looking ideas** for Hyntx that are **beyond the v1.0 scope**. These are ideas that may be considered after the CLI is complete and stable.

> **Important**: This is **not** a task list. Items here should **not** be started until the CLI reaches v1.0 and explicit decision is made to proceed. For current work, see [ROADMAP.md](../ROADMAP.md).

---

## Table of Contents

- [Monorepo Migration](#monorepo-migration-cli--desktop--shared-internal-package)
- [Prompt Template Generation](#prompt-template-generation)
- [Claude Code Version Detection](#claude-code-version-detection)
- [Historical Trend Analysis](#historical-trend-analysis)
- [Web Dashboard](#web-dashboard)
- [Related Backlog Items](#related-backlog-items-not-future-plans)

---

## Monorepo Migration (CLI + Desktop + Shared Internal Package)

### Status

**Future plan only**: Do not start this migration until the CLI is finished and stable enough that package boundaries are clear.

### Idea

After the CLI package is complete, migrate the project into a monorepo that contains:

- **CLI package**: The existing Node.js CLI (terminal UX, shell integration, CLI wiring).
- **Desktop app**: A GUI app (e.g., Tauri or similar).
- **Shared internal package**: Reusable "core" logic and types used by both CLI and Desktop.

### Validation Summary

- **Recommendation**: The idea is **sound** and aligns with Hyntx's architecture (clear separation between CLI orchestration and core logic), but it should be done **later** to avoid increasing complexity during the CLI's active development phase.
- **Best-fit goal**: Reuse domain logic (log reading, sanitization, analysis orchestration, reporting formats) while keeping UX layers separate (CLI vs Desktop UI).

### Benefits

- **Shared core logic**: Reduces duplication between CLI and Desktop by centralizing the portable parts of the system.
- **Consistent privacy guarantees**: A shared sanitizer/log reader helps preserve Hyntx's privacy-first requirements across multiple clients.
- **Single source of truth for types**: Prevents drift in result schemas and provider contracts.
- **Unified tooling**: One workspace for TypeScript config, linting, and tests is often easier than keeping multiple repositories synchronized.

### Risks and Costs

- **Release and versioning complexity**: Multiple packages require decisions about version strategy and distribution (npm for CLI vs desktop installers).
- **Boundary erosion**: If the shared package becomes a dumping ground, coupling increases and iteration slows.
- **Additional toolchains**: A Desktop app (especially Tauri) adds Rust + platform packaging concerns and increases CI complexity.
- **Runtime compatibility constraints**: Shared logic used by Desktop should avoid Node-only assumptions unless the Desktop architecture intentionally relies on Node/CLI execution.

### Readiness Signals

Consider this migration only when most of the following are true:

- **CLI contract stability**: Flags/output formats and core result types are no longer changing frequently.
- **Clear shared scope**: You can explicitly list what is shared and what must remain CLI/Desktop-specific.
- **Test confidence**: Core logic has strong test coverage so extraction is low-risk.
- **Distribution plan exists**: You know how the CLI will be published and how Desktop will be shipped, and how shared code will be versioned.

### Suggested Future Target Shape (Conceptual)

This is a conceptual structure to guide future discussions (not an instruction to implement now):

- `packages/shared`: Portable domain logic + shared types + provider abstractions + sanitization + log reading (as appropriate).
- `packages/cli`: CLI entrypoint, terminal UX, shell config integration, CLI wiring.
- `apps/desktop`: Desktop UI and local settings; uses the shared analysis logic either directly or through an explicit boundary.

### Key Desktop Architecture Decision (To Decide Later)

One of these approaches will likely fit best:

- **Embed analysis in Desktop**: Desktop uses the shared library directly (best UX; requires careful runtime compatibility).
- **Desktop shells out to the CLI**: Desktop calls the CLI and parses structured output (clean separation; reuse is indirect).
- **Tauri backend owns analysis**: Rust-side orchestration; JS shared code used where it fits (more complex, sometimes worth it for OS integration).

### How to Reduce Future Migration Risk (Without Migrating Now)

These are design habits that help keep a future split easy:

- **Keep core pure and portable**: Isolate IO and UX to boundary layers.
- **Avoid CLI-only assumptions in core**: Keep terminal formatting and interactive UX out of core result types.
- **Treat providers as adapters**: Maintain a stable provider interface and keep it decoupled from UI concerns.

---

## Prompt Template Generation

### Status

**Future enhancement** (post-v1.0): Not scheduled for implementation.

### Idea

Generate `.claudeprompt` template files based on analysis results to help users improve future prompts. These templates would provide starting points for common prompt patterns with best practices built in.

### Potential Features

- Template generation from identified patterns
- Project-specific customization based on detected frameworks
- Integration with Claude Code's prompt file support (if available)
- Library of pre-built templates for common tasks

### Why Defer

- Requires stable analysis result format
- Need to understand real user patterns before designing templates
- Claude Code's support for prompt files may evolve
- v1.0 focus should be on analysis quality, not generation

---

## Claude Code Version Detection

### Status

**Future enhancement** (post-v1.0): Not scheduled for implementation.

### Idea

Detect Claude Code version from `~/.claude/settings.json` or other indicators for better compatibility messaging and schema handling.

### Potential Features

- Automatic detection of Claude Code version
- Version-specific schema validation adjustments
- Compatibility warnings for unsupported versions
- Feature detection based on version capabilities

### Why Defer

- Current schema validation handles format changes gracefully
- Low priority compared to core functionality
- Claude Code is evolving rapidly; version detection may need frequent updates
- Schema validator already provides warning mechanism for unknown formats

---

## Historical Trend Analysis

### Status

**Future enhancement** (post-v1.0): Exploratory idea.

### Idea

Track prompt quality metrics over time to show improvement trends. Help users visualize their progress as prompt engineers.

### Potential Features

- Store analysis scores in local database
- Weekly/monthly trend reports
- Pattern frequency changes over time
- "You've improved!" notifications
- Export historical data

### Why Defer

- Requires persistent data storage (adds complexity)
- Need to establish stable scoring metrics first
- Core analysis quality is higher priority
- Could be built on top of JSON output format once available

---

## Web Dashboard

### Status

**Future enhancement** (post-v1.0): Exploratory idea.

### Idea

Provide a local web UI as an alternative to terminal output for users who prefer graphical interfaces.

### Potential Features

- Local server with web interface
- Visual charts for patterns and trends
- Interactive Before/After comparison
- Session-based analysis browsing
- Integration with historical data

### Why Defer

- Adds significant complexity (web server, frontend build)
- Terminal output should be sufficient for v1.0
- Desktop app (if built) would serve similar purpose
- Focus resources on CLI quality first

---

## Related Items Status

The following items were originally planned for future releases but have been **implemented in v1.1.0**:

| Item                                | Status                | Implementation                  |
| ----------------------------------- | --------------------- | ------------------------------- |
| Project-Specific Configuration File | ✅ Completed (v1.1.0) | `src/utils/project-config.ts`   |
| JSON Output Format                  | ✅ Completed (v1.1.0) | `src/core/reporter.ts`          |
| Configuration Health Check          | ✅ Completed (v1.1.0) | `src/utils/config-validator.ts` |

These features are now part of the stable release.

---

## Notes

- This document should be reviewed after v1.0 release
- Future plans may change based on user feedback and usage patterns
- Ideas here may be moved to backlog when they become actionable
- Some ideas may be rejected after further analysis
