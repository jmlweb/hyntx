# Test Coverage for Setup and Shell Config

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: setup-inicial.md, utils-completos.md
- **Estimation**: 4-5 hours

## Description

Create comprehensive test suites for `setup.ts` and `shell-config.ts` modules, which currently have no test coverage. These modules contain important functionality for interactive setup and shell configuration that should be thoroughly tested.

## Objective

Achieve comprehensive test coverage for setup and shell configuration modules, reducing risk of regressions and documenting expected behavior through tests.

## Scope

- Includes: Unit tests for `setup.ts`, unit tests for `shell-config.ts`, mocking of file system operations and user input
- Excludes: E2E tests (covered in e2e-testing.md), integration tests with actual shell environments

## Files to Create/Modify

- `src/core/setup.test.ts` - New test file for setup functionality
- `src/utils/shell-config.test.ts` - New test file for shell configuration utilities

## Implementation

### 1. Setup Tests (src/core/setup.test.ts)

#### Test Categories

**Provider Selection**:

- Test successful provider selection with valid choices
- Test handling of no providers selected (should exit with code 1)
- Test multiple provider selection
- Test provider availability checking

**Environment Configuration**:

- Test environment variable generation for each provider
- Test combining multiple provider configurations
- Test API key validation prompts

**Shell Configuration**:

- Test calling shell config functions correctly
- Test handling shell config errors
- Test success feedback to user

**Edge Cases**:

- Test cancellation during setup
- Test invalid user input handling
- Test empty/null responses

#### Mocking Strategy

```typescript
// Mock inquirer for user input
vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
}));

// Mock shell-config module
vi.mock('../utils/shell-config.js', () => ({
  detectShell: vi.fn(),
  updateShellConfig: vi.fn(),
  getManualInstructions: vi.fn(),
}));

// Mock process.exit
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});
```

### 2. Shell Config Tests (src/utils/shell-config.test.ts)

#### Test Categories

**Shell Detection**:

- Test detecting bash shell
- Test detecting zsh shell
- Test detecting fish shell
- Test fallback when shell cannot be detected

**Config File Updates**:

- Test adding new configuration block
- Test updating existing configuration block
- Test handling malformed blocks (only start marker)
- Test handling malformed blocks (only end marker)
- Test preserving existing file content
- Test creating directory if it doesn't exist

**Manual Instructions**:

- Test generating correct instructions for each shell type
- Test including correct environment variables

**Edge Cases**:

- Test handling non-existent config files
- Test handling read-only files (permission errors)
- Test handling empty config files
- Test handling config files with special characters
- Test overlapping or nested markers
- Test markers in wrong order

#### Mocking Strategy

```typescript
// Mock fs module
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock os module for home directory
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Mock process.env for SHELL detection
const originalEnv = process.env;
beforeEach(() => {
  process.env = { ...originalEnv };
});
```

### 3. Test File Structure

```typescript
// src/core/setup.test.ts
describe('setup', () => {
  describe('runSetup', () => {
    it('should complete successfully with valid provider selection', ...);
    it('should exit with code 1 when no providers selected', ...);
    it('should configure environment variables correctly', ...);
  });

  describe('validateApiKey', () => {
    it('should accept valid API key format', ...);
    it('should reject empty API key', ...);
  });
});

// src/utils/shell-config.test.ts
describe('shell-config', () => {
  describe('detectShell', () => {
    it('should detect bash from SHELL env', ...);
    it('should detect zsh from SHELL env', ...);
    it('should return unknown for unsupported shells', ...);
  });

  describe('updateShellConfig', () => {
    it('should add config block to empty file', ...);
    it('should replace existing config block', ...);
    it('should handle malformed start marker only', ...);
    it('should handle malformed end marker only', ...);
  });

  describe('getManualInstructions', () => {
    it('should return bash instructions', ...);
    it('should return zsh instructions', ...);
  });
});
```

## Acceptance Criteria

- [ ] `src/core/setup.test.ts` exists with comprehensive tests
- [ ] `src/utils/shell-config.test.ts` exists with comprehensive tests
- [ ] All tests pass consistently
- [ ] Tests cover happy paths for all main functions
- [ ] Tests cover error cases and edge cases
- [ ] Tests mock external dependencies (fs, inquirer, process)
- [ ] Test coverage for these modules reaches >80%
- [ ] **TECHNICAL_DEBT.md updated**: Remove item 5 after completion

## Test Cases

### setup.ts

- Provider selection with valid choices
- Provider selection with no choices (exit 1)
- API key input and validation
- Shell config update success
- Shell config update failure handling
- User cancellation handling

### shell-config.ts

- Shell detection for bash, zsh, fish
- Adding config to empty file
- Updating existing config block
- Malformed block with only start marker
- Malformed block with only end marker
- Markers in wrong order
- Directory creation when parent doesn't exist
- File permission errors
- Special characters in existing config

## Technical Debt Reference

This task addresses the following item from `TECHNICAL_DEBT.md`:

- **Item 5**: Missing Test Coverage

**Post-completion action**: Remove item 5 from `TECHNICAL_DEBT.md`.

## References

- `TECHNICAL_DEBT.md` - Item 5
- `src/core/setup.ts` - Module to test
- `src/utils/shell-config.ts` - Module to test
- Existing test files for patterns (e.g., `src/core/log-reader.test.ts`)
