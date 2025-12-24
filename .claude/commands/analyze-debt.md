---
description: Update TECHNICAL_DEBT.md based on current codebase state
---

# Technical Debt Analysis

Analyze the current codebase and update `TECHNICAL_DEBT.md` with actual technical debt issues found in the implemented code.

## Important Instructions

**Please, focus on the current code of the project, forget the roadmap or the documentation specs.**

Only document issues found in actual implemented code files. Ignore:
- Roadmap items
- Backlog tasks
- Documentation specifications
- Planned features

## Workflow

### 1. Analyze Current Codebase

Examine all implemented files in `src/` directory:

- **Core modules**: `src/core/*.ts`
- **Utilities**: `src/utils/*.ts`
- **Types**: `src/types/*.ts`
- **Entry point**: `src/index.ts`

Look for:
- Code quality issues
- Inconsistent patterns
- Error handling problems
- Missing tests
- Type safety issues
- Defensive code without justification
- Silent error swallowing
- Complex logic that could be simplified

### 2. Identify Technical Debt

Focus on significant issues that affect:
- Code maintainability
- Reliability
- Debugging
- Type safety
- Test coverage

**Avoid nitpicking** - Only document real problems, not style preferences.

### 3. Update TECHNICAL_DEBT.md

For each issue found:

1. **Problem**: Clear description of the issue
2. **Impact**: How it affects the codebase
3. **Location**: File and line numbers
4. **Example**: Concrete code snippet showing the problem
5. **Recommendation**: How to fix it

### 4. Structure

Update `TECHNICAL_DEBT.md` with:

- Clear section for each issue
- Numbered issues for easy reference
- Code examples with proper formatting
- Summary section with prioritization

### 5. Verification

After updating:

- Ensure all code examples are accurate
- Verify line numbers are correct
- Check that examples actually show the problem
- Confirm recommendations are actionable

## Analysis Checklist

When analyzing code, check for:

- [ ] Unnecessary defensive code (type guards that shouldn't be needed)
- [ ] Type assertions without validation
- [ ] Inconsistent error handling patterns
- [ ] Silent error swallowing (catch blocks that ignore errors)
- [ ] Missing test coverage for implemented modules
- [ ] Complex logic that could be simplified
- [ ] Placeholder implementations
- [ ] Code duplication
- [ ] Inconsistent patterns across modules

## Execute

Analyze the current codebase and update `TECHNICAL_DEBT.md` with all identified issues, following the structure and format of the existing document.

