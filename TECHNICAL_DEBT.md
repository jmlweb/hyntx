# Technical Debt

This document tracks technical debt issues in the current codebase. These are problems that should be addressed to improve code quality, maintainability, and reliability.

---

## 1. Complex Shell Config Edge Case Logic

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

This technical debt item should be addressed to improve code quality and reduce potential edge case bugs, but it doesn't currently block functionality.
