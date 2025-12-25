---
id: IDEA-014
title: Fix ESLint Errors in Source Files
status: completed
category: fix
created_date: 2025-12-25
validated_date: 2025-12-25
completed_date: 2025-12-25
effort: medium
impact: high
rejection_reason: null
---

# Fix ESLint Errors in Source Files

## Description

The main source files have accumulated ESLint errors that prevent `pnpm check` from passing. The affected files include:

- `src/core/history.ts` - Unnecessary conditionals, non-null assertions
- `src/core/reporter.ts` - Unused variables, template expression types
- `src/index.ts` - Nullish coalescing, unnecessary conditions
- `src/providers/index.ts` - Unsafe member access on `any` typed values

These errors were likely introduced during recent feature implementations (history comparison, reporter formatting) and need to be addressed to maintain code quality standards.

## Motivation

- **CI/CD Blocking**: The `pnpm check` command fails due to these ESLint errors, preventing proper validation
- **Code Quality**: ESLint rules exist to catch potential bugs and enforce best practices
- **Type Safety**: Many errors are related to unsafe `any` usage which could mask runtime errors
- **Maintainability**: Clean linting ensures consistent code style across the codebase

## Proposed Solution

Fix all 125 ESLint errors across the 4 affected source files:

1. **src/core/history.ts**:
   - Remove unnecessary conditionals
   - Replace non-null assertions with proper null checks

2. **src/core/reporter.ts**:
   - Remove unused `PatternChange` type import
   - Remove unused `patternStatusIcon` function
   - Convert numbers to strings in template literals

3. **src/index.ts**:
   - Replace `||` with `??` for nullish coalescing
   - Remove unnecessary conditions

4. **src/providers/index.ts**:
   - Add proper typing to provider factory return types
   - Replace `any` with appropriate interface types

## Acceptance Criteria

- [ ] `pnpm typecheck` passes without errors
- [ ] `pnpm lint` passes without errors
- [ ] `pnpm format:check` passes without errors
- [ ] `pnpm test` passes without failures
- [ ] `pnpm build` completes successfully
- [ ] No new TypeScript `any` types introduced
- [ ] All changes maintain existing functionality

## Technical Considerations

- Some errors in `src/providers/index.ts` are repeated due to pattern usage (provider factory)
- Template literal errors require explicit `String()` or `toString()` conversion
- Unused variables may indicate dead code that should be removed entirely
- Test files under `src/core/reporter.test.ts` have related mock typing issues

## Validation Notes

{To be filled during validation process}

## Related Tasks

- [fix-eslint-errors.md](../backlog/fix-eslint-errors.md) - P0, Maintenance Phase
