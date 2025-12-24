# E2E Testing Infrastructure

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: cli-entry-basico.md, log-reader-completo.md, provider-base-ollama.md, utils-completos.md
- **Estimation**: 6-8 hours

## Description

Implement comprehensive end-to-end testing infrastructure that validates the complete Hyntx CLI workflow, including environment variable configuration, log reading with custom paths, and provider integration. Tests are designed for local development validation only and are NOT included in CI/CD pipelines.

## Objective

Enable developers to validate the complete CLI workflow locally, test environment variable configuration changes, and ensure the system works correctly with configurable Claude Code paths and Ollama settings.

## Scope

- Includes: Configurable Claude path via `HYNTX_CLAUDE_PROJECTS_DIR`, e2e test infrastructure, test fixtures, environment variable testing, complete workflow validation
- Excludes: CI/CD integration (tests are local-only), real Claude Code logs (uses fixtures), real Ollama instances (uses mocks)

## Files to Create/Modify

- `tests/e2e/cli.test.ts` - Main CLI workflow tests
- `tests/e2e/env-config.test.ts` - Environment variable configuration tests
- `tests/e2e/log-reading.test.ts` - Log reading with custom paths
- `tests/e2e/provider-integration.test.ts` - Provider selection and fallback
- `tests/helpers/test-utils.ts` - Test utilities and helpers
- `tests/fixtures/sample-logs/` - Sample JSONL log files
- `tests/fixtures/mock-responses/` - Mock AI provider responses
- `src/utils/paths.ts` - Add `HYNTX_CLAUDE_PROJECTS_DIR` support
- `src/utils/paths.test.ts` - Update tests for env variable support
- `vitest.config.ts` - Add e2e test configuration
- `docs/TESTING.md` - Add e2e testing documentation
- `package.json` - Add e2e test scripts

## Implementation

### 1. Make Claude Path Configurable

**File**: `src/utils/paths.ts`

Add support for `HYNTX_CLAUDE_PROJECTS_DIR` environment variable with fallback to default:

```typescript
export const CLAUDE_PROJECTS_DIR = 
  process.env['HYNTX_CLAUDE_PROJECTS_DIR'] ?? 
  join(HOME, '.claude', 'projects');
```

### 2. Test Utilities

**File**: `tests/helpers/test-utils.ts`

- `setupTestEnv()` - Setup isolated test environment
- `createTempClaudeDir()` - Create temporary Claude projects directory
- `createSampleLogs()` - Generate sample JSONL files
- `cleanupTestEnv()` - Cleanup after tests
- `mockOllamaResponse()` - Mock Ollama API responses
- `mockAnthropicResponse()` - Mock Anthropic API responses

### 3. Test Fixtures

**Directory**: `tests/fixtures/`

- `sample-logs/project-hash-1/logs.jsonl` - Sample log files mimicking Claude Code structure
- `sample-logs/project-hash-2/logs.jsonl`
- `mock-responses/ollama-analysis.json` - Mock Ollama analysis responses
- `mock-responses/anthropic-analysis.json` - Mock Anthropic analysis responses

### 4. E2E Test Cases

#### env-config.test.ts
- Test adding `HYNTX_CLAUDE_PROJECTS_DIR` changes log reading path
- Test removing `HYNTX_CLAUDE_PROJECTS_DIR` falls back to default
- Test `HYNTX_SERVICES` configuration affects provider selection
- Test `HYNTX_OLLAMA_HOST` and `HYNTX_OLLAMA_MODEL` configuration
- Test environment variable precedence (env > defaults)

#### log-reading.test.ts
- Test reading logs from custom path via `HYNTX_CLAUDE_PROJECTS_DIR`
- Test prompt extraction from JSONL files
- Test date filtering works correctly
- Test project filtering works correctly
- Test empty directory handling
- Test malformed JSONL handling

#### cli.test.ts
- Test full workflow: read → sanitize → analyze → report
- Test with mocked provider responses
- Test exit codes (0, 1, 2, 3)
- Test `--dry-run` flag
- Test `--verbose` flag
- Test date range filtering
- Test project filtering

#### provider-integration.test.ts
- Test provider selection based on `HYNTX_SERVICES`
- Test Ollama availability check (mocked)
- Test fallback chain when providers unavailable
- Test provider-specific configuration (host, model, API keys)

### 5. Vitest Configuration

**File**: `vitest.config.ts`

- Add separate e2e test configuration
- Configure longer timeout for e2e tests (30s)
- Setup test environment isolation
- Configure test fixtures path

### 6. Documentation

**File**: `docs/TESTING.md`

- Add E2E Testing section
- Document test structure and usage
- Document environment variable configuration for testing
- **IMPORTANT**: Clearly document that E2E tests are local-only and NOT included in CI/CD pipelines
- Explain reasons for CI exclusion (require local services, manual setup, slower execution)

## Acceptance Criteria

- [ ] `HYNTX_CLAUDE_PROJECTS_DIR` environment variable is supported
- [ ] E2E tests can configure Claude path via environment variable
- [ ] E2E tests can configure Ollama settings via environment variables
- [ ] Tests verify prompt extraction works correctly
- [ ] Tests verify environment variable changes take effect
- [ ] Tests are isolated (don't affect each other)
- [ ] Tests use fixtures instead of real Claude Code logs
- [ ] All e2e tests pass consistently
- [ ] Documentation updated with e2e testing guide
- [ ] **CI/CD exclusion clearly documented** (tests are local-only, not run in CI)
- [ ] Test scripts added to package.json (`test:e2e`, `test:e2e:coverage`)

## Test Cases

### Environment Configuration
- Adding `HYNTX_CLAUDE_PROJECTS_DIR` changes log reading path
- Removing `HYNTX_CLAUDE_PROJECTS_DIR` falls back to default
- `HYNTX_SERVICES` configuration affects provider selection
- Provider-specific environment variables are respected

### Log Reading
- Reading logs from custom path works correctly
- Prompt extraction from JSONL files works
- Date filtering works correctly
- Project filtering works correctly
- Empty directory handling
- Malformed JSONL handling

### Complete Workflow
- Full workflow: read → sanitize → analyze → report
- Exit codes are correct (0, 1, 2, 3)
- CLI flags work correctly (`--dry-run`, `--verbose`)
- Date range filtering works
- Project filtering works

### Provider Integration
- Provider selection based on configuration
- Provider availability checks (mocked)
- Fallback chain when providers unavailable
- Provider-specific configuration works

## CI/CD Exclusion

**IMPORTANT**: These E2E tests are **NOT** included in CI/CD pipelines.

### Reasons for Exclusion

1. **Require Local Services**: Tests may need Ollama running locally
2. **Environment Dependencies**: Require Claude Code logs or fixtures setup
3. **Manual Configuration**: Need environment variables configured for testing
4. **Slower Execution**: E2E tests are slower than unit/integration tests
5. **Local Development Focus**: Designed for developers to validate their local setup

### CI/CD Test Strategy

- **Unit tests** (`src/**/*.test.ts`) - Run in CI
- **Integration tests** (`tests/integration/*.test.ts`) - Run in CI with mocks
- **E2E tests** (`tests/e2e/*.test.ts`) - **Excluded from CI**, run locally only

## References

- `docs/TESTING.md` - Testing strategy documentation
- `docs/SPECS.md` - Technical specifications
- `docs/CLI.md` - CLI interface documentation

