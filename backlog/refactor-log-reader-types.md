# Refactor Log Reader Type Safety

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: log-reader-completo.md
- **Estimation**: 1-2 hours

## Description

Refactor `log-reader.ts` to remove unnecessary defensive code and improve type safety. This addresses technical debt items related to redundant type checks and type assertions without proper runtime validation.

## Objective

Improve code quality by removing unnecessary defensive code that masks potential type issues, and strengthen type safety by adding proper runtime type guards.

## Scope

- Includes: Refactoring `extractContent()` function, improving type assertion in `parseLine()`, adding type guard functions
- Excludes: Functional changes to log reading behavior

## Files to Create/Modify

- `src/core/log-reader.ts` - Refactor type handling
- `src/core/log-reader.test.ts` - Update/add tests for type safety

## Implementation

### 1. Remove Unnecessary Defensive Code in extractContent

**Current code** (`src/core/log-reader.ts:166-177`):

```typescript
function extractContent(message: ClaudeMessage): string {
  const content = message.message.content;

  if (typeof content === 'string') {
    return content;
  }

  // Content is always a string based on schema, but we handle edge cases
  return '';
}
```

**Refactored code**:

```typescript
function extractContent(message: ClaudeMessage): string {
  // Schema validator guarantees content is always a string
  return message.message.content;
}
```

### 2. Add Runtime Type Guard for ClaudeMessage

Create a type guard function to validate the structure matches `ClaudeMessage` before type assertion:

```typescript
function isClaudeMessage(value: unknown): value is ClaudeMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj['timestamp'] === 'string' &&
    typeof obj['type'] === 'string' &&
    typeof obj['message'] === 'object' &&
    obj['message'] !== null &&
    typeof (obj['message'] as Record<string, unknown>)['content'] === 'string'
  );
}
```

### 3. Improve parseLine Type Safety

**Current code** (`src/core/log-reader.ts:130-146`):

```typescript
function parseLine(line: string): ClaudeMessage | null {
  // ... validation ...
  return parsed as ClaudeMessage; // Type assertion without additional checks
}
```

**Refactored code**:

```typescript
function parseLine(line: string): ClaudeMessage | null {
  // ... validation ...

  if (!isClaudeMessage(parsed)) {
    return null;
  }

  return parsed; // No type assertion needed, type guard provides safety
}
```

## Acceptance Criteria

- [ ] `extractContent()` no longer has unnecessary defensive type checks
- [ ] `isClaudeMessage()` type guard function is implemented
- [ ] `parseLine()` uses type guard instead of type assertion
- [ ] All existing tests continue to pass
- [ ] New tests cover type guard edge cases
- [ ] Code is simpler and more maintainable
- [ ] **TECHNICAL_DEBT.md updated**: Remove items 1 and 2 after completion

## Test Cases

- Type guard correctly identifies valid ClaudeMessage objects
- Type guard rejects objects with missing timestamp
- Type guard rejects objects with missing message.content
- Type guard rejects non-object values
- extractContent works correctly with valid messages
- parseLine returns null for invalid structures

## Technical Debt Reference

This task addresses the following items from `TECHNICAL_DEBT.md`:

- **Item 1**: Unnecessary Defensive Code in extractContent
- **Item 2**: Type Assertion Without Runtime Validation

**Post-completion action**: Remove items 1 and 2 from `TECHNICAL_DEBT.md`.

## References

- `TECHNICAL_DEBT.md` - Items 1 and 2
- `src/core/log-reader.ts` - Current implementation
