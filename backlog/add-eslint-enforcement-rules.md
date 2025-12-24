# Add Missing ESLint Enforcement Rules

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: none
- **Estimation**: 30 minutes

## Description

Add ESLint rules to enforce conventions that the codebase already follows but aren't currently validated by linters. This prevents future violations of documented code style.

## Objective

Make style violations impossible rather than relying on code review to catch them.

## Scope

- Includes: Adding 3 new ESLint rules
- Includes: Fixing any violations found
- Excludes: Changing Prettier configuration

## Files to Create/Modify

- `eslint.config.js` - Add new rules

## Implementation

### 1. Enforce Named Exports Only

The codebase uses named exports exclusively (per AGENTS.md), but ESLint doesn't prevent default exports.

```javascript
'@typescript-eslint/no-default-export': 'error',
```

### 2. Prevent Enum Usage

AGENTS.md and CODE-STYLE.md explicitly prefer const maps over enums.

```javascript
'no-restricted-syntax': [
  'error',
  {
    selector: 'TSEnumDeclaration',
    message: 'Use const maps instead of enums (see CODE-STYLE.md)',
  },
],
```

### 3. Encourage Immutability

Functional programming approach discourages parameter mutation.

```javascript
'no-param-reassign': ['error', { props: true }],
```

### 4. Complete eslint.config.js Update

Add to the rules section:

```javascript
rules: {
  // ... existing rules ...

  // Enforce named exports only (AGENTS.md requirement)
  '@typescript-eslint/no-default-export': 'error',

  // Prevent enum usage (prefer const maps per CODE-STYLE.md)
  'no-restricted-syntax': [
    'error',
    {
      selector: 'TSEnumDeclaration',
      message: 'Use const maps instead of enums (see CODE-STYLE.md)',
    },
  ],

  // Encourage immutability (functional programming)
  'no-param-reassign': ['error', { props: true }],
}
```

### 5. Verify and Fix

```bash
pnpm lint
# Fix any violations found
pnpm lint:fix
```

## Acceptance Criteria

- [ ] `no-default-export` rule added and enforced
- [ ] `no-restricted-syntax` rule prevents enums
- [ ] `no-param-reassign` rule encourages immutability
- [ ] All existing code passes lint checks
- [ ] Any violations are fixed

## Test Cases

- Creating a default export should trigger error
- Creating an enum should trigger error with message
- Mutating function parameters should trigger error

## References

- AGENTS.md - Code style rules
- docs/CODE-STYLE.md - Detailed conventions
- Technical Validation Report (December 2024)
