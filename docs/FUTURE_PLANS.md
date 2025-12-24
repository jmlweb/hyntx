# Future Plans (Not Current Work)

This document captures **future-looking ideas** for Hyntx. It is **not** a task list and it does **not** indicate work that should be started now.

## Monorepo Migration (CLI + Desktop + Shared Internal Package)

### Status

**Future plan only**: do not start this migration until the CLI is finished and stable enough that package boundaries are clear.

### Idea

After the CLI package is complete, migrate the project into a monorepo that contains:

- **CLI package**: the existing Node.js CLI (terminal UX, shell integration, CLI wiring).
- **Desktop app**: a GUI app (e.g., Tauri or similar).
- **Shared internal package**: reusable “core” logic and types used by both CLI and Desktop.

### Validation Summary

- **Recommendation**: The idea is **sound** and aligns with Hyntx’s architecture (clear separation between CLI orchestration and core logic), but it should be done **later** to avoid increasing complexity during the CLI’s active development phase.
- **Best-fit goal**: reuse domain logic (log reading, sanitization, analysis orchestration, reporting formats) while keeping UX layers separate (CLI vs Desktop UI).

### Benefits

- **Shared core logic**: reduces duplication between CLI and Desktop by centralizing the portable parts of the system.
- **Consistent privacy guarantees**: a shared sanitizer/log reader helps preserve Hyntx’s privacy-first requirements across multiple clients.
- **Single source of truth for types**: prevents drift in result schemas and provider contracts.
- **Unified tooling**: one workspace for TypeScript config, linting, and tests is often easier than keeping multiple repositories synchronized.

### Risks and Costs

- **Release and versioning complexity**: multiple packages require decisions about version strategy and distribution (npm for CLI vs desktop installers).
- **Boundary erosion**: if the shared package becomes a dumping ground, coupling increases and iteration slows.
- **Additional toolchains**: a Desktop app (especially Tauri) adds Rust + platform packaging concerns and increases CI complexity.
- **Runtime compatibility constraints**: shared logic used by Desktop should avoid Node-only assumptions unless the Desktop architecture intentionally relies on Node/CLI execution.

### When It Becomes a Good Time (Readiness Signals)

Consider this migration only when most of the following are true:

- **CLI contract stability**: flags/output formats and core result types are no longer changing frequently.
- **Clear shared scope**: you can explicitly list what is shared and what must remain CLI/Desktop-specific.
- **Test confidence**: core logic has strong test coverage so extraction is low-risk.
- **Distribution plan exists**: you know how the CLI will be published and how Desktop will be shipped, and how shared code will be versioned.

### Suggested Future Target Shape (Conceptual)

This is a conceptual structure to guide future discussions (not an instruction to implement now):

- `packages/shared`: portable domain logic + shared types + provider abstractions + sanitization + log reading (as appropriate).
- `packages/cli`: CLI entrypoint, terminal UX, shell config integration, CLI wiring.
- `apps/desktop`: Desktop UI and local settings; uses the shared analysis logic either directly or through an explicit boundary (see below).

### Key Desktop Architecture Decision (To Decide Later)

One of these approaches will likely fit best:

- **Embed analysis in Desktop**: Desktop uses the shared library directly (best UX; requires careful runtime compatibility).
- **Desktop shells out to the CLI**: Desktop calls the CLI and parses structured output (clean separation; reuse is indirect).
- **Tauri backend owns analysis**: Rust-side orchestration; JS shared code used where it fits (more complex, sometimes worth it for OS integration).

### How to Reduce Future Migration Risk (Without Migrating Now)

These are design habits that help keep a future split easy:

- **Keep core pure and portable**: isolate IO and UX to boundary layers.
- **Avoid CLI-only assumptions in core**: keep terminal formatting and interactive UX out of core result types.
- **Treat providers as adapters**: maintain a stable provider interface and keep it decoupled from UI concerns.

