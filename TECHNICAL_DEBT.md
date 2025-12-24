# Technical Debt

This document tracks technical debt issues in the current codebase. These are problems that should be addressed to improve code quality, maintainability, and reliability.

---

## 1. Unnecessary Defensive Code in extractContent

**Problem**: The `extractContent()` function in `log-reader.ts` includes defensive code to handle non-string content, but the schema validator guarantees that content is always a string. This creates unnecessary code that may hide real type issues if schema validation fails.

**Impact**: 
- Unnecessary runtime checks that add complexity
- May mask bugs if schema validation has issues
- Creates confusion about whether the type guarantee is reliable

**Location**: `src/core/log-reader.ts:166-177`

**Example**:
```typescript
function extractContent(message: ClaudeMessage): string {
  const content = message.message.content;

  if (typeof content === 'string') {
    return content;
  }

  // Content is always a string based on schema, but we handle edge cases
  // The schema validator ensures content is a string

  return '';
}
```

**Recommendation**: Remove the defensive check and trust the schema validator. If schema validation fails, it should be caught earlier in the pipeline, not silently handled here.

---

## 2. Type Assertion Without Runtime Validation

**Problem**: In `parseLine()`, after validation passes, the code uses a type assertion (`parsed as ClaudeMessage`) without additional runtime validation. If the validation logic has bugs or edge cases, this could lead to runtime errors.

**Impact**:
- Type safety is only as strong as the validation logic
- Potential runtime errors if validation misses edge cases
- No additional safety net beyond the validation function

**Location**: `src/core/log-reader.ts:143`

**Example**:
```typescript
function parseLine(line: string): ClaudeMessage | null {
  // ... validation ...
  const validation = validateLogEntry(parsed);

  if (!validation.isValid) {
    return null;
  }

  return parsed as ClaudeMessage;  // Type assertion without additional checks
}
```

**Recommendation**: Consider adding a runtime type guard function that validates the structure matches `ClaudeMessage` before the assertion, or ensure the validation function is comprehensive enough to guarantee type safety.

---

## 3. Inconsistent Error Handling Patterns

**Problem**: The codebase uses multiple different error handling strategies inconsistently: `process.exit(1)`, thrown errors, and silent error swallowing. There's no unified error handling strategy.

**Impact**:
- Makes error handling unpredictable
- Harder to debug issues
- Inconsistent user experience
- Difficult to test error paths

**Locations**: 
- `src/core/setup.ts:175` - Uses `process.exit(1)`
- `src/core/log-reader.ts` - Multiple catch blocks that silently return null/empty arrays
- Various other modules use different patterns

**Examples**:

```typescript
// setup.ts - Direct process exit
if (!providers || providers.length === 0) {
  console.log(chalk.red('No providers selected. Setup cancelled.'));
  process.exit(1);
}

// log-reader.ts - Silent error swallowing
try {
  const parsed = parseISO(dateStr);
  // ...
} catch {
  return 'unknown';  // Error silently ignored
}
```

**Recommendation**: Establish a consistent error handling strategy:
- Use custom error classes for different error types
- Define when to throw vs when to return error values
- Use exit codes consistently (as defined in `EXIT_CODES`)
- Log errors appropriately instead of silently swallowing them

---

## 4. Silent Error Swallowing

**Problem**: Multiple catch blocks throughout the codebase catch errors but don't log or report them, making debugging difficult when issues occur.

**Impact**:
- Errors are hidden, making it hard to diagnose problems
- No visibility into failures during development or production
- Silent failures can lead to incorrect behavior

**Locations**:
- `src/core/log-reader.ts` - Lines 101, 119, 144, 257, 279, 348, 364, 492
- `src/utils/shell-config.ts:172` - Directory creation errors ignored

**Examples**:

```typescript
// log-reader.ts - Multiple silent catch blocks
function extractDate(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    return dateStr ?? 'unknown';
  } catch {
    return 'unknown';  // Error silently ignored, no logging
  }
}

// shell-config.ts - Directory creation error ignored
try {
  mkdirSync(dirname(configFile), { recursive: true });
} catch {
  // Directory might already exist, ignore
  // No logging or verification that directory actually exists
}
```

**Recommendation**: 
- Log errors with appropriate context (file, line, operation)
- Use a logging utility for consistent error reporting
- Only silently ignore errors when it's truly safe to do so (e.g., checking if file exists)
- Consider adding error callbacks or warning arrays to collect non-fatal errors

---

## 5. Missing Test Coverage

**Problem**: Two implemented modules have no test files: `setup.ts` and `shell-config.ts`. These modules contain important functionality that should be tested.

**Impact**:
- Risk of regressions when modifying these modules
- Harder to refactor safely without tests
- No documentation of expected behavior through tests
- Potential bugs may go undetected

**Missing Test Files**:
- `src/core/setup.test.ts` - No tests for interactive setup functionality
- `src/utils/shell-config.test.ts` - No tests for shell configuration utilities

**Modules Without Tests**:
- `src/core/setup.ts` - Interactive setup, provider configuration, shell config saving
- `src/utils/shell-config.ts` - Shell detection, config file updates, manual instructions

**Recommendation**: Create comprehensive test files for both modules, covering:
- Happy paths
- Error cases
- Edge cases (malformed config files, missing directories, etc.)
- Mocking of file system operations and user input

---

## 6. Complex Shell Config Edge Case Logic

**Problem**: The malformed block handling logic in `updateShellConfig()` is complex and handles edge cases where only one marker (start or end) is present. The logic for determining start and end indices when markers are missing could have edge cases with overlapping or incorrectly positioned markers.

**Impact**:
- Potential bugs when shell config files have unusual formatting
- Hard to reason about the correctness of the logic
- Difficult to test all edge cases
- May corrupt config files in edge cases

**Location**: `src/utils/shell-config.ts:147-162`

**Example**:
```typescript
} else if (hasStartMarker || hasEndMarker) {
  // Malformed block - remove it and add new one
  const startIndex = hasStartMarker
    ? content.indexOf(startMarker)
    : content.indexOf(endMarker);
  const endIndex = hasEndMarker
    ? content.indexOf(endMarker) + endMarker.length
    : content.indexOf(startMarker) + startMarker.length;

  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex);
  // ... complex string manipulation ...
}
```

**Issues**:
- If both markers exist but are in wrong order, the logic may not handle it correctly
- If markers overlap or are nested, the slice operations may produce unexpected results
- The logic assumes markers appear in a certain way, but doesn't validate their relationship

**Recommendation**: 
- Simplify the logic by always searching for complete blocks first
- Add validation to ensure markers are properly paired
- Consider using regex or a more robust parsing approach
- Add comprehensive tests for edge cases (overlapping markers, wrong order, nested markers, etc.)

---

## 7. CLI Entry Point is Placeholder

**Problem**: The main entry point `src/index.ts` only exports types and contains no actual CLI implementation. The project cannot be executed as a CLI tool.

**Impact**:
- Project is not functional as a CLI application
- Cannot test the complete workflow
- Users cannot actually use the tool
- All implemented modules remain disconnected

**Location**: `src/index.ts:8`

**Example**:
```typescript
/**
 * Hyntx - CLI Entry Point
 *
 * This is a placeholder entry point. The actual CLI implementation
 * will be added in a future task (cli-entry-basico.md).
 */

export * from './types/index.js';
```

**Recommendation**: Implement the basic CLI entry point to:
- Parse command-line arguments
- Integrate all existing modules (setup, log-reader, sanitizer)
- Provide basic functionality even if providers are not yet implemented
- Handle errors with appropriate exit codes
- Provide help and version commands

---

## Summary

These technical debt items should be prioritized based on:
1. **High Priority**: CLI entry point (#7) - blocks all functionality
2. **Medium Priority**: Error handling (#3, #4) - affects reliability and debugging
3. **Medium Priority**: Test coverage (#5) - affects maintainability
4. **Low Priority**: Code quality improvements (#1, #2, #6) - improve code but don't block functionality

