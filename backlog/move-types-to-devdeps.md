# Move Type Definitions to Dev Dependencies

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: none
- **Estimation**: 10 minutes

## Description

The `@types/*` packages are currently in production dependencies but should be in devDependencies. Type definitions are only needed at build time, not runtime. Moving them reduces the production dependency footprint.

## Objective

Correctly categorize type definition packages as development dependencies.

## Scope

- Includes: Moving @types packages to devDependencies
- Excludes: Code changes

## Files to Create/Modify

- `package.json` - Move packages
- `pnpm-lock.yaml` - Will be auto-updated

## Current State

```json
"dependencies": {
  "@types/cli-progress": "^3.11.6",
  "@types/figlet": "^1.7.0",
  "@types/prompts": "^2.4.9",
  // ... other deps
}
```

## Implementation

### 1. Remove from Dependencies

```bash
pnpm remove @types/figlet @types/prompts
```

Note: `@types/cli-progress` will be removed by the "remove-unused-dependencies" task.

### 2. Add to Dev Dependencies

```bash
pnpm add -D @types/figlet @types/prompts
```

### 3. Verify

```bash
pnpm check && pnpm build && pnpm test:run
```

## Expected State

```json
"dependencies": {
  // No @types/* packages
},
"devDependencies": {
  "@types/figlet": "^1.7.0",
  "@types/node": "^22.10.2",
  "@types/prompts": "^2.4.9",
  // ... other dev deps
}
```

## Acceptance Criteria

- [ ] No `@types/*` packages in dependencies
- [ ] All `@types/*` packages in devDependencies
- [ ] TypeScript compilation succeeds
- [ ] Build succeeds
- [ ] Tests pass

## Impact

- Cleaner production dependency tree
- Correct semantic separation of build-time vs runtime deps
- No functional changes

## References

- Technical Validation Report (December 2024)
- npm documentation on devDependencies
