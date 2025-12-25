# Improve CLI Entry Point Test Coverage

## Metadata

- **Priority**: P2
- **Phase**: 4
- **Dependencies**: None
- **Estimation**: 4-6 hours
- **Source**: IDEA-011 - Improve CLI Entry Point Test Coverage

## Description

Expand test coverage for `src/index.ts` (CLI entry point) from current 65% to at least 85% (target: 90%+). This file contains critical orchestration logic including argument parsing, validation, output file writing, multi-day analysis handling, and error flows. Many exported helper functions need additional test cases for edge cases and error paths.

## Objective

Increase confidence in the CLI's reliability and catch regressions in the most user-facing part of the application. The CLI entry point should meet the same quality standard as other core modules (95%+ coverage).

## Scope

- Includes:
  - Expand `src/index.test.ts` with additional test cases
  - Add integration tests for main flow
  - Test all exported helper functions
  - Test error handling paths
  - Test multi-day analysis scenarios
  - Test JSON and terminal output modes
  - Verify exit codes for different scenarios
- Excludes:
  - Refactoring of existing code (only adding tests)
  - Changes to implementation logic
  - Coverage improvements for other modules

## Files to Create/Modify

- `src/index.test.ts` (modify - expand existing tests)
- `tests/integration/cli.test.ts` (modify - add main flow tests if needed)

## Implementation

1. **Expand unit tests** for exported helper functions:
   - `parseArguments()`: Test all argument combinations, invalid arguments, edge cases
   - `validateArguments()`: Test conflict detection, date range validation, output file validation, date order validation
   - `writeOutputFile()`: Test successful writes, directory creation, atomic write behavior, error handling (ENOSPC, permission denied)
   - `writeMultiDayJsonOutput()`: Test multi-day JSON array output, compact mode, error scenarios
   - `getOutputFilePath()`: Test path generation with/without dates, different extensions
   - `displayDryRunSummary()`: Test output formatting with various prompt counts, date ranges, project filters
   - `handleError()`: Test JSON mode vs terminal mode error handling

2. **Add integration tests** for main flow:
   - End-to-end test with mocked providers
   - Test multi-day analysis flow
   - Test file output in both MD and JSON formats
   - Test error recovery and exit codes
   - Test dry-run mode

3. **Mock external dependencies** appropriately:
   - File system operations (writeFile, mkdir, rename)
   - Provider connections
   - Process.exit calls
   - Console output

4. **Coverage verification**:
   - Run coverage report to verify 85%+ line coverage achieved
   - Identify any remaining uncovered lines
   - Add tests for any critical uncovered paths

## Acceptance Criteria

- [ ] `src/index.ts` achieves at least 85% line coverage (target: 90%+)
- [ ] All exported helper functions have dedicated test cases
- [ ] Error handling paths are tested (file write failures, invalid arguments, etc.)
- [ ] Multi-day analysis scenarios are covered
- [ ] JSON and terminal output modes are both tested
- [ ] Exit codes are verified for different scenarios
- [ ] Tests run successfully in CI
- [ ] Coverage report shows improvement from 65% to 85%+

## Test Cases

### parseArguments()

- All argument combinations
- Invalid arguments (unknown flags, positional args)
- Short flags (-h, -v, -o)
- Default values when no arguments provided

### validateArguments()

- Conflict detection (--date with --from/--to)
- Date range validation (--from without --to, invalid date order)
- Output file validation (invalid extensions, conflicts with --dry-run)
- Date format validation

### writeOutputFile()

- Successful writes (MD and JSON formats)
- Directory creation (recursive mkdir)
- Atomic write behavior (temp file then rename)
- Error handling (ENOSPC, permission denied, invalid path)
- Compact vs formatted JSON

### writeMultiDayJsonOutput()

- Multi-day JSON array output
- Compact mode
- Directory creation
- Atomic write behavior
- Error handling

### getOutputFilePath()

- Path generation with date suffix
- Path generation without date
- Different file extensions (.md, .json)
- Path preservation with subdirectories

### displayDryRunSummary()

- Single date summary
- Date range summary
- Project filter display
- Various prompt counts

### handleError()

- JSON mode error handling (returns JSON error object)
- Terminal mode error handling (prints to console)
- Exit code verification

### Integration Tests

- Full analysis flow with mocked providers
- Multi-day analysis flow
- File output in MD format
- File output in JSON format
- Error recovery scenarios
- Exit code verification

## References

- IDEA-011 - Full idea specification
- `src/index.test.ts` - Existing test file (1419 lines)
- `src/core/analyzer.test.ts` - Reference for test patterns
- `docs/TESTING.md` - Testing strategy and coverage goals
