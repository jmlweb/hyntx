---
id: IDEA-004
title: Implement Centralized Logging and Warning Collection System
status: completed
category: improvement
created_date: 2025-01-27
validated_date: 2025-12-24
completed_date: 2025-12-25
effort: medium
impact: high
rejection_reason: null
---

# Implement Centralized Logging and Warning Collection System

## Description

Currently, the codebase has inconsistent error handling with silent error swallowing in multiple locations (`log-reader.ts`, `shell-config.ts`) and direct `console.log`/`error`/`warn` calls scattered throughout. This makes debugging difficult and violates the error handling strategy defined in `docs/TECHNICAL_DEBT.md` items #3 and #4.

The system should provide a unified logging interface that:

- Collects warnings during execution (non-fatal issues)
- Logs errors with proper context (file, line, operation)
- Reports warnings at appropriate times (end of analysis, end of CLI run)
- Provides consistent formatting using chalk for colors
- Supports different log levels (error, warn, info, debug)

## Motivation

- **Debugging**: Silent error swallowing makes it impossible to diagnose issues when they occur
- **User Experience**: Users should see warnings about non-fatal issues (e.g., skipped log entries, schema validation warnings)
- **Technical Debt**: Directly addresses docs/TECHNICAL_DEBT.md items #3 (Inconsistent Error Handling) and #4 (Silent Error Swallowing)
- **Maintainability**: Centralized logging makes it easier to change logging behavior (e.g., add file logging, structured logging)
- **Consistency**: Provides a single interface for all logging needs across the codebase

## Proposed Solution

1. **Create logging utility** (`src/utils/logger.ts`):
   - `Logger` class with methods: `error()`, `warn()`, `info()`, `debug()`
   - Warning collection system that accumulates warnings during execution
   - Context-aware logging (automatically includes file/function context when available)
   - Integration with chalk for consistent coloring

2. **Warning collection API**:
   - `collectWarning(message: string)` - Add warning to collection
   - `getWarnings(): string[]` - Retrieve all collected warnings
   - `clearWarnings()` - Reset collection
   - `reportWarnings()` - Display all warnings at once (with chalk formatting)

3. **Integration points**:
   - Replace silent catch blocks in `log-reader.ts` with `logger.warn()` or `logger.collectWarning()`
   - Replace direct `console.error` calls with `logger.error()`
   - Replace direct `console.warn` calls with `logger.warn()` or `logger.collectWarning()`
   - Use warning collection in CLI to report all warnings at the end of execution

4. **CLI integration**:
   - Collect warnings during log reading, analysis, and other operations
   - Display warning summary at end of successful runs
   - Use `--verbose` flag to show debug-level logs

## Acceptance Criteria

- [ ] `Logger` utility class implemented with error, warn, info, debug methods
- [ ] Warning collection system accumulates warnings during execution
- [ ] Silent error swallowing in `log-reader.ts` replaced with proper logging
- [ ] Silent error swallowing in `shell-config.ts` replaced with proper logging
- [ ] Direct console calls replaced with logger calls throughout codebase
- [ ] Warnings are collected and displayed at end of CLI execution
- [ ] Error messages include context (operation, file when available)
- [ ] All logging uses chalk for consistent coloring
- [ ] Tests verify logging behavior and warning collection

## Technical Considerations

- **Performance**: Warning collection should be lightweight (array push operations)
- **Memory**: Clear warnings after reporting to prevent memory leaks in long-running processes
- **CLI Output**: Warnings should not pollute JSON output when `--format json` is used (use stderr)
- **Backward Compatibility**: Existing warning arrays (e.g., in `readJsonlFile`) can be integrated with the new system
- **Testing**: Mock logger in tests to verify logging calls without console output

## Validation Notes

Accepted during revalidation on 2025-12-24. Directly addresses docs/TECHNICAL_DEBT.md items #3 and #4. High impact for code quality and maintainability. Should be prioritized in Phase 2.5 or Phase 3. Coordinates well with IDEA-003 (verbose/debug mode).

## Related Tasks

- [add-centralized-logging.md](../../backlog/add-centralized-logging.md) - P1, Phase 3
