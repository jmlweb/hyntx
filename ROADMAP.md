# Hyntx - Development Roadmap

This roadmap organizes the implementation tasks for the Hyntx project following a Vertical Slicing approach, where each task represents a complete end-to-end functionality.

## Phase 1: Foundation (P0 - Critical)

These tasks are essential and must be completed first, as they form the foundation of the system.

### ~~1. [TypeScript Type System](backlog/tipos-base.md)~~ ✅ COMPLETED

**Priority**: P0 | **Dependencies**: none

Define all TypeScript interfaces and types necessary for the system. Fundamental base for all development.

### 2. [Initial Interactive Setup](backlog/setup-inicial.md)

**Priority**: P0 | **Dependencies**: tipos-base.md, utils-completos.md (partial)

Implement the initial configuration system that allows users to configure Hyntx on first use.

### 3. [Basic JSONL Log Reading](backlog/log-reader-basico.md)

**Priority**: P0 | **Dependencies**: tipos-base.md, schema-validator.md

Implement the basic capability to read and parse Claude Code JSONL files.

### 4. [Log Schema Validator](backlog/schema-validator.md)

**Priority**: P0 | **Dependencies**: tipos-base.md

Implement schema validation to handle log format changes gracefully.

---

## Phase 2: Core Functional (P1 - High)

These tasks implement the main functionality of the system.

### 5. [Complete Log Reading with Filters](backlog/log-reader-completo.md)

**Priority**: P1 | **Dependencies**: log-reader-basico.md, schema-validator.md

Extend log reading with date and project filters, and day grouping.

### 6. [Secret Sanitizer](backlog/sanitizer.md)

**Priority**: P1 | **Dependencies**: tipos-base.md

Implement automatic redaction of secrets and sensitive information before analysis.

### 7. [Provider Base and Ollama](backlog/provider-base-ollama.md)

**Priority**: P1 | **Dependencies**: tipos-base.md

Implement base provider interface and Ollama provider (local, offline-first).

### 8. [Analyzer with Map-Reduce Batching](backlog/analyzer-batching.md)

**Priority**: P1 | **Dependencies**: tipos-base.md, provider-base-ollama.md

Implement analysis system with intelligent batching to handle large volumes of prompts.

### 9. [Terminal Reporter](backlog/reporter-terminal.md)

**Priority**: P1 | **Dependencies**: tipos-base.md

Implement report formatter for terminal output with Before/After visualization.

---

## Phase 3: CLI and Providers (P2 - Medium)

These tasks complete the basic CLI and add support for multiple providers.

### 10. [Basic CLI Entry Point](backlog/cli-entry-basico.md)

**Priority**: P2 | **Dependencies**: tipos-base.md, setup-inicial.md, log-reader-completo.md, sanitizer.md, analyzer-batching.md, provider-base-ollama.md, reporter-terminal.md, utils-completos.md

Implement the basic CLI entry point that integrates all components for minimum viable functionality.

### 11. [Anthropic Provider](backlog/provider-anthropic.md)

**Priority**: P2 | **Dependencies**: tipos-base.md, provider-base-ollama.md

Implement Anthropic provider (Claude API) as an alternative to Ollama.

### 12. [Google Provider](backlog/provider-google.md)

**Priority**: P2 | **Dependencies**: tipos-base.md, provider-base-ollama.md

Implement Google provider (Gemini API) as a third provider option.

### 13. [Multi-Provider Factory with Fallback](backlog/provider-factory.md)

**Priority**: P2 | **Dependencies**: tipos-base.md, provider-base-ollama.md, provider-anthropic.md, provider-google.md, utils-completos.md

Implement provider factory with automatic selection and fallback between providers.

---

## Phase 4: Advanced Features (P3 - Low)

These tasks add advanced features and complete the system.

### 14. [Reminder System](backlog/reminder-system.md)

**Priority**: P3 | **Dependencies**: tipos-base.md, utils-completos.md

Implement periodic reminder system to maintain the analysis habit.

### 15. [Markdown Format Reporter](backlog/reporter-markdown.md)

**Priority**: P3 | **Dependencies**: tipos-base.md, reporter-terminal.md

Implement report formatting in Markdown to save results to files.

### 16. [Complete CLI with All Options](backlog/cli-completo.md)

**Priority**: P3 | **Dependencies**: cli-entry-basico.md, reminder-system.md, reporter-markdown.md, provider-factory.md, log-reader-completo.md

Extend CLI with all advanced options: date ranges, filters, file output, verbose, dry-run.

### 17. [Complete Utilities](backlog/utils-completos.md)

**Priority**: P3 | **Dependencies**: tipos-base.md

Implement all system utilities: environment variable management and path constants.

### 18. [Complete Error Handling](backlog/error-handling.md)

**Priority**: P3 | **Dependencies**: All previous modules

Review and verify complete error handling throughout the system with clear messages and appropriate exit codes.

---

## Phase 5: Testing and Documentation (P4 - Optional)

These tasks are important for quality and long-term maintenance.

### 19. [Testing Strategy](backlog/testing-strategy.md)

**Priority**: P4 | **Dependencies**: All implemented modules

Define and document testing strategy with main test cases and edge cases.

### 20. [package.json Configuration](backlog/package-json.md)

**Priority**: P4 | **Dependencies**: none

Configure package.json with all necessary dependencies, scripts, and metadata.

---

## Recommended Implementation Order

For efficient development, it is recommended to follow this order:

1. ~~**tipos-base.md** - Fundamental base~~ ✅
2. **schema-validator.md** - Simple, no complex dependencies
3. **utils-completos.md** (partial - paths.ts) - Required for log-reader
4. **log-reader-basico.md** - Basic core functionality
5. **log-reader-completo.md** - Extends the basic
6. **sanitizer.md** - Independent, required before providers
7. **provider-base-ollama.md** - First functional provider
8. **analyzer-batching.md** - Orchestrates analysis
9. **reporter-terminal.md** - Shows results
10. **setup-inicial.md** - Initial configuration
11. **utils-completos.md** (complete) - Rest of utilities
12. **cli-entry-basico.md** - Basic functional CLI
13. **provider-anthropic.md** - Second provider
14. **provider-google.md** - Third provider
15. **provider-factory.md** - Multi-provider support
16. **reminder-system.md** - Reminder system
17. **reporter-markdown.md** - File output
18. **cli-completo.md** - Complete CLI
19. **error-handling.md** - Complete review
20. **package-json.md** - Project configuration
21. **testing-strategy.md** - Testing documentation

---

## Notes

- Each task is a complete "vertical slice" that can be implemented independently
- Dependencies are clearly marked in each task
- Phase 1 (P0) tasks are critical and must be completed first
- Phase 5 (P4) tasks are optional but recommended for quality
