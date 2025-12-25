---
id: IDEA-011
title: Improve CLI Entry Point Test Coverage
status: accepted
category: improvement
created_date: 2025-12-25
validated_date: 2025-12-25
effort: medium
impact: high
rejection_reason: null
---

# Improve CLI Entry Point Test Coverage

## Description

The `src/index.ts` file (main CLI entry point) has only 65% line coverage compared to 95%+ for other core modules. This file contains critical orchestration logic including argument parsing, validation, output file writing, multi-day analysis handling, and error flows. Many exported helper functions like `validateArguments`, `writeOutputFile`, `writeMultiDayJsonOutput`, and `getOutputFilePath` need additional test cases for edge cases and error paths. Improving coverage here will increase confidence in the CLI's reliability and catch regressions in the most user-facing part of the application.

## Motivation

- **Reliability Gap**: The CLI entry point is the most critical user-facing module, yet it has the lowest test coverage among core files
- **Regression Prevention**: Without comprehensive tests, changes to the orchestration logic could introduce subtle bugs
- **Edge Cases**: Many error handling paths and edge cases (invalid arguments, file write failures, multi-day scenarios) lack test coverage
- **Confidence**: Higher coverage provides confidence when refactoring or extending CLI functionality
- **Quality Standard**: Other core modules maintain 95%+ coverage; the entry point should meet the same standard

## Proposed Solution

1. **Expand `src/index.test.ts`** with additional test cases:
   - `parseArguments()`: Test all argument combinations, invalid arguments, edge cases
   - `validateArguments()`: Test conflict detection, date range validation, output file validation
   - `writeOutputFile()`: Test successful writes, directory creation, atomic write behavior, error handling
   - `writeMultiDayJsonOutput()`: Test multi-day JSON array output, compact mode, error scenarios
   - `getOutputFilePath()`: Test path generation with/without dates, different extensions
   - `displayDryRunSummary()`: Test output formatting with various prompt counts
   - `handleError()`: Test JSON mode vs terminal mode error handling

2. **Add integration tests** for the main flow:
   - End-to-end test with mocked providers
   - Test multi-day analysis flow
   - Test file output in both MD and JSON formats
   - Test error recovery and exit codes

3. **Mock external dependencies** appropriately:
   - File system operations (writeFile, mkdir, rename)
   - Provider connections
   - Process.exit calls
   - Console output

## Acceptance Criteria

- [ ] `src/index.ts` achieves at least 85% line coverage (target: 90%+)
- [ ] All exported helper functions have dedicated test cases
- [ ] Error handling paths are tested (file write failures, invalid arguments, etc.)
- [ ] Multi-day analysis scenarios are covered
- [ ] JSON and terminal output modes are both tested
- [ ] Exit codes are verified for different scenarios
- [ ] Tests run successfully in CI

## Technical Considerations

- **Mocking Strategy**: Use Vitest's mocking capabilities for fs operations and external dependencies
- **Process.exit Handling**: Mock `process.exit` to verify exit codes without actually exiting
- **Console Output**: Capture and verify console output for different scenarios
- **Existing Test Patterns**: Follow patterns established in other test files (e.g., `src/core/analyzer.test.ts`)
- **Test Isolation**: Ensure tests don't affect each other or leave side effects

## Validation Notes

**Validated**: 2025-12-25

**Decision**: ACCEPTED

**Reasoning**:

- Quality improvement that aligns perfectly with maintenance phase
- Addresses measurable gap: 65% coverage vs 90%+ target for core modules
- Critical user-facing code benefits from comprehensive test coverage
- Well-scoped with clear acceptance criteria and implementation plan
- High impact (regression prevention, refactoring confidence) with medium effort
- No conflicts with existing backlog or roadmap

**Priority**: P2 (quality improvement, not blocking)

## Related Tasks

{Links to backlog tasks created from this idea - filled by feed-backlog}
