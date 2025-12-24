# Add Shell Config File Permissions

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: none
- **Estimation**: 20 minutes

## Description

Shell RC files (.bashrc, .zshrc) are typically world-readable (644 permissions). When Hyntx saves API keys to these files, other users on the same system could potentially read them. Add restrictive permissions after writing shell config.

## Objective

Improve security by setting restrictive file permissions (600) on shell config files after writing API keys.

## Scope

- Includes: Adding chmod call after shell config write
- Includes: Unit tests for permission setting
- Excludes: Changes to setup flow logic

## Files to Create/Modify

- `src/utils/shell-config.ts` - Add permission setting
- `src/utils/shell-config.test.ts` - Add tests for permissions

## Implementation

### 1. Import chmod

```typescript
import { chmod, writeFile } from 'node:fs/promises';
```

### 2. Add Permission Setting

After writing shell config in `updateShellConfig()`:

```typescript
// After writeFile succeeds
await chmod(shellFile, 0o600); // rw------- (user-only read/write)
```

### 3. Handle Permission Errors Gracefully

```typescript
try {
  await chmod(shellFile, 0o600);
} catch {
  // Permission change failed - not critical, continue
  // Some systems may not support chmod
}
```

### 4. Add Tests

```typescript
describe('shell config permissions', () => {
  it('should set restrictive permissions after write', async () => {
    // Mock chmod and verify it's called with 0o600
  });

  it('should continue if chmod fails', async () => {
    // Mock chmod to throw, verify function doesn't fail
  });
});
```

## Acceptance Criteria

- [ ] Shell config files get 600 permissions after write
- [ ] chmod failure doesn't break the setup flow
- [ ] Tests cover permission setting
- [ ] Build and existing tests pass

## Security Impact

- Prevents other users on multi-user systems from reading API keys
- Low risk change (graceful fallback if chmod fails)

## References

- Security Review from Technical Validation Report (December 2024)
- OWASP file permission guidelines
