# Technical Debt

This document tracks technical debt issues in the current codebase. These are problems that should be addressed to improve code quality, maintainability, and reliability.

---

## 1. Inconsistent Error Handling Patterns

**Problem**: The codebase uses multiple different error handling strategies inconsistently: `process.exit(1)`, thrown errors, and silent error swallowing. There's no unified error handling strategy.

**Impact**:

- Makes error handling unpredictable
- Harder to debug issues
- Inconsistent user experience
- Difficult to test error paths

**Locations**:

- `src/core/setup.ts:173-176` - Uses `process.exit(1)` when no providers selected
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
  return 'unknown'; // Error silently ignored
}
```

**Recommendation**: Establish a consistent error handling strategy:

- Use custom error classes for different error types
- Define when to throw vs when to return error values
- Use exit codes consistently (as defined in `EXIT_CODES`)
- Log errors appropriately instead of silently swallowing them

---

## 2. Silent Error Swallowing

**Problem**: Multiple catch blocks throughout the codebase catch errors but don't log or report them, making debugging difficult when issues occur.

**Impact**:

- Errors are hidden, making it hard to diagnose problems
- No visibility into failures during development or production
- Silent failures can lead to incorrect behavior

**Locations**:

- `src/core/log-reader.ts` - Lines 119-121 (extractDate), 144 (parseLine), 257-260 (filterByDateRange), 279-281 (filterByDate), 348-350 (groupByDay sort), 364-366 (groupByDay sort), 492-495 (readLogs sort)
- `src/utils/shell-config.ts:170-174` - Directory creation errors ignored

**Examples**:

```typescript
// log-reader.ts - Multiple silent catch blocks
function extractDate(timestamp: string): string {
  try {
    const date = parseISO(timestamp);
    const dateStr = date.toISOString().split('T')[0];
    return dateStr ?? 'unknown';
  } catch {
    return 'unknown'; // Error silently ignored, no logging
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

## 3. Complex Shell Config Edge Case Logic

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

## Summary

These technical debt items should be prioritized based on:

1. **High Priority**: Error handling (#1, #2) - affects reliability and debugging
2. **Low Priority**: Code quality improvements (#3) - improves code but doesn't block functionality
