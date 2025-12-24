# Add Configuration Health Check Command

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: cli-entry-basico.md, provider-factory.md
- **Estimation**: TBD
- **Source**: IDEA-006 - Add Configuration Validation and Health Check Command

## Description

Currently, users can only discover configuration issues (invalid API keys, unreachable providers, malformed URLs, etc.) when running an actual analysis. This leads to poor user experience where users wait for analysis to start only to discover their configuration is invalid.

A `--check-config` or `--validate` CLI flag that validates the current configuration and tests provider connectivity without running analysis would allow users to diagnose configuration issues proactively.

## Objective

Enable proactive configuration validation and provider health checks before running analysis.

## Scope

- Includes:
  - Add `--check-config` CLI flag
  - Create configuration validation utility
  - Test provider connectivity for each configured provider
  - Display clear, actionable error messages
  - Return appropriate exit codes (0 for success, non-zero for issues)
- Excludes:
  - Configuration migration/fixing
  - JSON output for health check (can be added later)
  - Automatic configuration repair

## Files to Create/Modify

- `src/index.ts` - Add `--check-config` CLI flag and handler
- `src/utils/config-validator.ts` - Create validation utility
- `tests/config-validator.test.ts` - Add tests

## Implementation

1. **Add CLI flag**: `--check-config` that runs validation mode

2. **Create validation utility** (`src/utils/config-validator.ts`):

   ```typescript
   interface ValidationResult {
     valid: boolean;
     provider: string;
     checks: Array<{
       name: string;
       status: 'pass' | 'fail' | 'warn';
       message?: string;
     }>;
   }

   async function validateProvider(
     config: ProviderConfig,
   ): Promise<ValidationResult>;
   async function validateAllProviders(
     config: EnvConfig,
   ): Promise<ValidationResult[]>;
   ```

3. **Validation checks per provider**:
   - Configuration present (model, host/API key)
   - URL format valid (Ollama host)
   - API key format valid (basic pattern check)
   - Connectivity test (use existing `isAvailable()` methods)
   - Model availability (for Ollama)

4. **Health check output**:

   ```text
   🔍 Configuration Health Check
   ═══════════════════════════════════════════

   Configuration:
     Services: ollama, anthropic
     Reminder: 7d

   Ollama Provider:
     ✅ Model: llama3.2
     ✅ Host: http://localhost:11434
     ✅ Connection: Reachable
     ✅ Model available: Yes

   Anthropic Provider:
     ✅ Model: claude-3-5-haiku-latest
     ❌ API Key: Missing or invalid
     ⚠️  Connection: Cannot test (invalid API key)

   Summary:
     ⚠️  1 provider configured but unavailable
     ✅ 1 provider ready to use
   ```

## Acceptance Criteria

- [ ] `--check-config` flag added to CLI
- [ ] Configuration validation utility validates all config values
- [ ] Provider connectivity is tested for each configured provider
- [ ] Clear, actionable error messages for each validation failure
- [ ] Colored output (green for valid, red for invalid, yellow for warnings)
- [ ] Exit code 0 if all providers valid, non-zero if issues found
- [ ] Works independently of analysis workflow (no log reading required)
- [ ] Handles cases where providers are partially configured
- [ ] Tests verify validation logic for all provider types

## Test Cases

- Test validation passes for correctly configured provider
- Test validation fails for missing API key
- Test validation fails for invalid URL format
- Test connectivity test for each provider type
- Test exit codes (0 for success, non-zero for failure)
- Test partial configuration handling

## References

- See ROADMAP.md for context
- See IDEA-006 for original proposal
- Reuse provider `isAvailable()` methods for connectivity testing
