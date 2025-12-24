# Hyntx - Development Roadmap

This roadmap organizes the implementation tasks for the Hyntx project following a Vertical Slicing approach, where each task represents a complete end-to-end functionality.

## Phase 0: Pre-Foundation (P0 - Critical)

These tasks should be completed before starting development to secure project infrastructure.

### ~~0. [Dummy npm Deployment - Package Name Reservation](backlog/npm-dummy-deployment.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: none

Perform a dummy deployment to npm to reserve the `hyntx` package name and prevent name squatting. This is a minimal deployment with placeholder functionality.

### ~~0.1. [Remove Unused Dependencies](backlog/remove-unused-dependencies.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: none

Remove `cli-progress` and `@types/cli-progress` which are not used in the codebase. The analyzer uses callback-based progress instead.

### ~~0.2. [Fix Node Version Inconsistency](backlog/fix-node-version-inconsistency.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: none

Fix documentation inconsistency: `docs/SPECS.md` says Node 18+ but `package.json` requires Node 22+. Align all references.

---

## Phase 1: Foundation (P0 - Critical)

These tasks are essential and must be completed first, as they form the foundation of the system.

### ~~1. [TypeScript Type System](backlog/tipos-base.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: none

Define all TypeScript interfaces and types necessary for the system. Fundamental base for all development.

### ~~2. [Log Schema Validator](backlog/schema-validator.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: tipos-base.md

Implement schema validation to handle log format changes gracefully.

### ~~3. [Complete Utilities](backlog/utils-completos.md)~~ ✅ COMPLETED

**Priority**: P3 | **Dependencies**: tipos-base.md

Implement all system utilities: environment variable management and path constants. Required early for setup and log reading.

### ~~4. [Basic JSONL Log Reading](backlog/log-reader-basico.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: tipos-base.md, schema-validator.md, utils-completos.md (partial - paths.ts)

Implement the basic capability to read and parse Claude Code JSONL files.

### ~~5. [Initial Interactive Setup](backlog/setup-inicial.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: tipos-base.md, utils-completos.md (partial - shell-config)

Implement the initial configuration system that allows users to configure Hyntx on first use.

---

## Phase 2: Core Functional (P1 - High)

These tasks implement the main functionality of the system.

### ~~6. [Complete Log Reading with Filters](backlog/log-reader-completo.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: log-reader-basico.md, schema-validator.md

Extend log reading with date and project filters, and day grouping.

### ~~7. [Secret Sanitizer](backlog/sanitizer.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: tipos-base.md

Implement automatic redaction of secrets and sensitive information before analysis.

### ~~8. [Provider Base and Ollama](backlog/provider-base-ollama.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: tipos-base.md

Implement base provider interface and Ollama provider (local, offline-first).

### ~~9. [Analyzer with Map-Reduce Batching](backlog/analyzer-batching.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: tipos-base.md, provider-base-ollama.md

Implement analysis system with intelligent batching to handle large volumes of prompts.

### ~~10. [Terminal Reporter](backlog/reporter-terminal.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: tipos-base.md

Implement report formatter for terminal output with Before/After visualization.

---

## Phase 2.5: Code Quality (P1 - High)

These tasks improve code quality, security, and enforce documented conventions.

### ~~2.5.1. [Add ESLint Enforcement Rules](backlog/add-eslint-enforcement-rules.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: none

Add missing ESLint rules to enforce documented conventions: no-default-export, no-enums (prefer const maps), no-param-reassign.

### ~~2.5.2. [Add Shell Config Permissions](backlog/add-shell-config-permissions.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: none

Set restrictive file permissions (600) on shell config files after writing API keys to prevent access by other users.

### ~~2.5.3. [Move Type Definitions to Dev Dependencies](backlog/move-types-to-devdeps.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: none

Move `@types/*` packages from dependencies to devDependencies where they belong.

### ~~2.5.4. [Add Prettier Formatting and ESLint Fixing to Husky / lint-staged](backlog/add-prettier-eslint-to-husky.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: none

Configure lint-staged with husky to automatically format code with Prettier and fix ESLint issues on staged files before commits. Ensures consistent code style and prevents formatting-related commit failures.

---

## Phase 3: CLI and Providers (P2 - Medium)

These tasks complete the basic CLI and add support for multiple providers.

### ~~11. [Basic CLI Entry Point](backlog/cli-entry-basico.md)~~ ✅ COMPLETED

**Priority**: P2 | **Dependencies**: tipos-base.md, setup-inicial.md, log-reader-completo.md, sanitizer.md, analyzer-batching.md, provider-base-ollama.md, reporter-terminal.md, utils-completos.md

Implement the basic CLI entry point that integrates all components for minimum viable functionality.

### ~~12. [Anthropic Provider](backlog/provider-anthropic.md)~~ ✅ COMPLETED

**Priority**: P2 | **Dependencies**: tipos-base.md, provider-base-ollama.md

Implement Anthropic provider (Claude API) as an alternative to Ollama.

### ~~13. [Google Provider](backlog/provider-google.md)~~ ✅ COMPLETED

**Priority**: P2 | **Dependencies**: tipos-base.md, provider-base-ollama.md

Implement Google provider (Gemini API) as a third provider option.

### ~~14. [Multi-Provider Factory with Fallback](backlog/provider-factory.md)~~ ✅ COMPLETED

**Priority**: P2 | **Dependencies**: tipos-base.md, provider-base-ollama.md, provider-anthropic.md, provider-google.md, utils-completos.md

Implement provider factory with automatic selection and fallback between providers.

### 14.1. [Add Provider Retry Logic](backlog/add-provider-retry-logic.md)

**Priority**: P2 | **Dependencies**: provider-factory.md

Add retry logic with exponential backoff for transient network failures in cloud providers.

### 14.2. [Add Provider Rate Limiting](backlog/add-provider-rate-limiting.md)

**Priority**: P2 | **Dependencies**: provider-factory.md

Add rate limiting for Anthropic and Google API calls to prevent 429 errors during batch processing.

### 14.3. [Add JSON Output Format](backlog/add-json-output-format.md)

**Priority**: P1 | **Dependencies**: reporter-terminal.md, cli-entry-basico.md | **Source**: IDEA-001

Implement `--format json` flag for machine-readable output. Enables automation, CI/CD integration, and data processing workflows.

### ~~14.4. [Integrate Multi-Provider Factory in CLI](backlog/integrate-multi-provider-factory.md)~~ ✅ COMPLETED

**Priority**: P1 | **Dependencies**: provider-factory.md, cli-entry-basico.md | **Source**: IDEA-002

Replace hardcoded `OllamaProvider` in CLI with `getAvailableProvider()` factory to enable all configured providers with automatic fallback.

### 14.5. [Add Verbose/Debug Mode](backlog/add-verbose-debug-mode.md)

**Priority**: P2 | **Dependencies**: cli-entry-basico.md | **Source**: IDEA-003

Add `--verbose` flag for detailed operational logging to stderr for troubleshooting.

### 14.6. [Add Centralized Logging System](backlog/add-centralized-logging.md)

**Priority**: P1 | **Dependencies**: cli-entry-basico.md | **Source**: IDEA-004

Implement unified logging interface with warning collection, replacing silent error swallowing and scattered console calls.

### 14.7. [Add Configuration Health Check](backlog/add-config-health-check.md)

**Priority**: P2 | **Dependencies**: cli-entry-basico.md, provider-factory.md | **Source**: IDEA-006

Add `--check-config` flag to validate configuration and test provider connectivity before running analysis.

---

## Phase 4: Advanced Features (P3 - Low)

These tasks add advanced features and complete the system.

### ~~15. [Reminder System](backlog/reminder-system.md)~~ ✅ COMPLETED

**Priority**: P3 | **Dependencies**: tipos-base.md, utils-completos.md

Implement periodic reminder system to maintain the analysis habit.

### 16. [Markdown Format Reporter](backlog/reporter-markdown.md)

**Priority**: P3 | **Dependencies**: tipos-base.md, reporter-terminal.md

Implement report formatting in Markdown to save results to files.

### 17. [Test Coverage for Setup and Shell Config](backlog/test-coverage-setup-shell.md)

**Priority**: P3 | **Dependencies**: setup-inicial.md, utils-completos.md

Create comprehensive test suites for `setup.ts` and `shell-config.ts` modules, which currently have no test coverage. Achieve >80% coverage with mocked file system and user input.

### 18. [Refactor Log Reader Type Safety](backlog/refactor-log-reader-types.md)

**Priority**: P3 | **Dependencies**: log-reader-completo.md

Refactor `log-reader.ts` to remove unnecessary defensive code and improve type safety by adding proper runtime type guards.

### 19. [E2E Testing Infrastructure](backlog/e2e-testing.md)

**Priority**: P3 | **Dependencies**: cli-entry-basico.md, log-reader-completo.md, provider-base-ollama.md, utils-completos.md

Implement comprehensive end-to-end testing infrastructure for local development validation. Tests validate complete CLI workflow, environment variable configuration, and custom Claude Code paths. **Note**: These tests are local-only and NOT included in CI/CD pipelines.

### 20. [Complete CLI with All Options](backlog/cli-completo.md)

**Priority**: P3 | **Dependencies**: cli-entry-basico.md, reminder-system.md, reporter-markdown.md, provider-factory.md, log-reader-completo.md

Extend CLI with all advanced options: date ranges, filters, file output, verbose, dry-run.

### 21. [Complete Error Handling](backlog/error-handling.md)

**Priority**: P3 | **Dependencies**: All previous modules

Review and verify complete error handling throughout the system with clear messages and appropriate exit codes.

### 22. [Refactor Shell Config Edge Case Logic](backlog/refactor-shell-config-logic.md)

**Priority**: P4 | **Dependencies**: utils-completos.md, test-coverage-setup-shell.md

Simplify complex edge case handling logic in `updateShellConfig()` function with proper marker validation and clearer string manipulation.

### 23. [Add Project-Specific Configuration File Support](backlog/add-project-config-file.md)

**Priority**: P1 | **Dependencies**: cli-entry-basico.md, provider-factory.md | **Source**: IDEA-007

Add `.hyntxrc.json` support for per-project configuration overrides and project context for better analysis.

---

## Recommended Implementation Order

For efficient development, it is recommended to follow this order:

0. ~~**npm-dummy-deployment.md** - Reserve package name (do this first!)~~ ✅
1. ~~**tipos-base.md** - Fundamental base~~ ✅
2. ~~**schema-validator.md** - Simple, no complex dependencies~~ ✅
3. ~~**utils-completos.md** - Required early for paths and shell-config~~ ✅
4. ~~**log-reader-basico.md** - Basic core functionality~~ ✅
5. ~~**setup-inicial.md** - Initial configuration~~ ✅
6. ~~**log-reader-completo.md** - Extends the basic~~ ✅
7. ~~**sanitizer.md** - Independent, required before providers~~ ✅
8. ~~**provider-base-ollama.md** - First functional provider~~ ✅
9. ~~**analyzer-batching.md** - Orchestrates analysis~~ ✅
10. ~~**reporter-terminal.md** - Shows results~~ ✅
11. ~~**cli-entry-basico.md** - Basic functional CLI~~ ✅
12. ~~**provider-anthropic.md** - Second provider~~ ✅
13. ~~**provider-google.md** - Third provider~~ ✅
14. ~~**provider-factory.md** - Multi-provider support~~ ✅
15. ~~**reminder-system.md** - Reminder system~~ ✅
16. ~~**remove-unused-dependencies.md** - Quick cleanup (P0, no dependencies)~~ ✅
17. ~~**fix-node-version-inconsistency.md** - Documentation fix (P0, no dependencies)~~ ✅
18. ~~**move-types-to-devdeps.md** - Quick cleanup (P1, no dependencies)~~ ✅
19. ~~**add-eslint-enforcement-rules.md** - Code quality (P1, no dependencies)~~ ✅
20. ~~**add-shell-config-permissions.md** - Security improvement (P1, no dependencies)~~ ✅
21. ~~**add-prettier-eslint-to-husky.md** - Developer experience (P1, no dependencies)~~ ✅
22. **reporter-markdown.md** - File output (blocks cli-completo)
23. **add-provider-retry-logic.md** - Reliability improvement (P2)
24. **add-provider-rate-limiting.md** - Reliability improvement (P2)
25. **test-coverage-setup-shell.md** - Test coverage (blocks refactor-shell-config-logic)
26. **refactor-log-reader-types.md** - Type safety improvements (quick win)
27. **e2e-testing.md** - E2E testing infrastructure (local-only)
28. **cli-completo.md** - Complete CLI (requires reporter-markdown)
29. **error-handling.md** - Complete review (requires all previous)
30. **refactor-shell-config-logic.md** - Shell config edge case simplification (P4)

---

## Notes

- Each task is a complete "vertical slice" that can be implemented independently
- Dependencies are clearly marked in each task
- Phase 1 (P0) tasks are critical and must be completed first
- Phase 5 (P4) tasks are optional but recommended for quality
