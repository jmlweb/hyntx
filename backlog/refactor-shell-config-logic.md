# Refactor Shell Config Edge Case Logic

## Metadata

- **Priority**: P4
- **Phase**: 4
- **Dependencies**: utils-completos.md, test-coverage-setup-shell.md
- **Estimation**: 2-3 hours

## Description

Simplify the complex edge case handling logic in `updateShellConfig()` function. The current implementation handles malformed blocks (where only one marker is present) with complex index calculations that could have bugs with overlapping or incorrectly positioned markers.

## Objective

Improve reliability and maintainability of shell configuration updates by simplifying the marker handling logic and adding proper validation.

## Scope

- Includes: Refactoring `updateShellConfig()` function, adding marker validation, simplifying string manipulation
- Excludes: Changes to shell detection or manual instructions functionality

## Files to Create/Modify

- `src/utils/shell-config.ts` - Refactor updateShellConfig function
- `src/utils/shell-config.test.ts` - Add tests for edge cases (if not already done)

## Implementation

### Problem Analysis

**Current code** (`src/utils/shell-config.ts:147-162`):

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
  // ...
}
```

**Issues**:

1. If both markers exist but are in wrong order, logic may not handle it correctly
2. If markers overlap or are nested, slice operations may produce unexpected results
3. The logic assumes markers appear in a certain way without validation

### Proposed Solution

#### 1. Add Marker Validation Function

```typescript
interface MarkerPositions {
  startIndex: number;
  endIndex: number;
  isValid: boolean;
  issue?: 'missing_start' | 'missing_end' | 'wrong_order' | 'overlapping';
}

function findMarkerPositions(content: string): MarkerPositions {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  // Both missing - no existing block
  if (startIndex === -1 && endIndex === -1) {
    return { startIndex: -1, endIndex: -1, isValid: true };
  }

  // Only start marker
  if (startIndex !== -1 && endIndex === -1) {
    return { startIndex, endIndex: -1, isValid: false, issue: 'missing_end' };
  }

  // Only end marker
  if (startIndex === -1 && endIndex !== -1) {
    return { startIndex: -1, endIndex, isValid: false, issue: 'missing_start' };
  }

  // Both present - check order
  if (startIndex > endIndex) {
    return { startIndex, endIndex, isValid: false, issue: 'wrong_order' };
  }

  // Valid block
  return { startIndex, endIndex, isValid: true };
}
```

#### 2. Simplify updateShellConfig Logic

```typescript
export function updateShellConfig(
  configPath: string,
  envContent: string,
): boolean {
  const content = readConfigFile(configPath);
  const positions = findMarkerPositions(content);
  const newBlock = `${START_MARKER}\n${envContent}\n${END_MARKER}`;

  let updatedContent: string;

  if (positions.startIndex === -1 && positions.endIndex === -1) {
    // No existing block - append
    updatedContent = content.trimEnd() + '\n\n' + newBlock + '\n';
  } else if (positions.isValid) {
    // Valid block - replace
    const before = content.slice(0, positions.startIndex);
    const after = content.slice(positions.endIndex + END_MARKER.length);
    updatedContent = before + newBlock + after;
  } else {
    // Malformed block - remove completely and add new
    updatedContent =
      removeMalformedMarkers(content, positions) + '\n\n' + newBlock + '\n';
  }

  return writeConfigFile(configPath, updatedContent);
}

function removeMalformedMarkers(
  content: string,
  positions: MarkerPositions,
): string {
  let result = content;

  // Remove markers and any content between them if both exist
  if (positions.startIndex !== -1) {
    // Find the end of the line containing start marker
    const lineEnd = result.indexOf('\n', positions.startIndex);
    result =
      result.slice(0, positions.startIndex) +
      result.slice(lineEnd !== -1 ? lineEnd + 1 : result.length);
  }

  // Recalculate end position after removing start
  const newEndIndex = result.indexOf(END_MARKER);
  if (newEndIndex !== -1) {
    const lineEnd = result.indexOf('\n', newEndIndex);
    result =
      result.slice(0, newEndIndex) +
      result.slice(lineEnd !== -1 ? lineEnd + 1 : result.length);
  }

  return result.trimEnd();
}
```

#### 3. Add Logging for Malformed Blocks

```typescript
if (!positions.isValid) {
  console.warn(
    `Warning: Found malformed Hyntx block in ${configPath} (${positions.issue}). Rebuilding.`,
  );
}
```

## Acceptance Criteria

- [ ] `findMarkerPositions()` function validates marker positions
- [ ] All marker edge cases are handled correctly:
  - [ ] Only start marker present
  - [ ] Only end marker present
  - [ ] Markers in wrong order
  - [ ] Valid block (both markers, correct order)
  - [ ] No markers present
- [ ] Malformed blocks are logged with warnings
- [ ] All existing tests continue to pass
- [ ] New tests cover all edge cases
- [ ] Code is simpler and easier to understand
- [ ] **TECHNICAL_DEBT.md updated**: Remove item 6 after completion

## Test Cases

- No markers: appends new block
- Valid block: replaces correctly
- Only start marker: removes it, adds new block
- Only end marker: removes it, adds new block
- Markers in wrong order: removes both, adds new block
- Multiple start markers: handles first occurrence
- Nested markers: handles outer markers
- Empty file: adds new block
- File with only whitespace: adds new block

## Technical Debt Reference

This task addresses the following item from `TECHNICAL_DEBT.md`:

- **Item 6**: Complex Shell Config Edge Case Logic

**Post-completion action**: Remove item 6 from `TECHNICAL_DEBT.md`.

## References

- `TECHNICAL_DEBT.md` - Item 6
- `src/utils/shell-config.ts` - Current implementation
