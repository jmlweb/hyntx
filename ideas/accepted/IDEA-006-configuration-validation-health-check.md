---
id: IDEA-006
title: Add Configuration Validation and Health Check Command
status: accepted
category: improvement
created_date: 2025-01-27
validated_date: 2025-12-24
effort: low
impact: medium
rejection_reason: null
---

# Add Configuration Validation and Health Check Command

## Description

Currently, users can only discover configuration issues (invalid API keys, unreachable providers, malformed URLs, etc.) when running an actual analysis. This leads to poor user experience where users wait for analysis to start only to discover their configuration is invalid. There's no way to validate configuration or test provider connectivity before running analysis.

This idea proposes adding a `--check-config` or `--validate` CLI flag that validates the current configuration and tests provider connectivity without running analysis. This would allow users to diagnose configuration issues proactively and get actionable feedback.

## Motivation

- **Proactive Error Detection**: Catch configuration issues before starting analysis, saving time and providing better UX
- **Provider Connectivity Testing**: Verify that configured providers are reachable and API keys are valid
- **Configuration Validation**: Validate that all configuration values are correct (model names, URLs, reminder values, etc.)
- **User Confidence**: Users can verify their setup is correct before running analysis
- **Troubleshooting**: Provides a dedicated diagnostic tool separate from the main analysis workflow
- **CI/CD Integration**: Enable automated health checks in pipelines before running analysis

## Proposed Solution

1. **Add CLI flag**: `--check-config` or `--validate` that runs validation mode
2. **Create validation utility** (`src/utils/config-validator.ts`):
   - Validate environment variable format and values
   - Check required API keys are present for selected providers
   - Validate URL formats (Ollama host)
   - Validate reminder frequency format
   - Validate model names against known patterns (optional, could be warnings)
   - Test provider connectivity by making minimal API calls
   - Return structured validation results with actionable error messages

3. **Health check output**:
   - Display configuration summary (which providers configured, models, etc.)
   - Show validation results for each provider (✅ valid, ❌ invalid with reason)
   - Test connectivity for each configured provider
   - Provide actionable suggestions for fixing issues
   - Use colored output (chalk) for clear visual feedback

4. **Integration with existing code**:
   - Reuse provider `isAvailable()` methods for connectivity testing
   - Leverage existing provider creation logic
   - Use existing error handling patterns

Example output:

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

- [ ] `--check-config` or `--validate` flag added to CLI
- [ ] Configuration validation utility validates all config values
- [ ] Provider connectivity is tested for each configured provider
- [ ] Clear, actionable error messages for each validation failure
- [ ] Colored output (green for valid, red for invalid, yellow for warnings)
- [ ] Exit code 0 if all providers valid, non-zero if issues found
- [ ] Works independently of analysis workflow (no log reading required)
- [ ] Handles cases where providers are partially configured
- [ ] Tests verify validation logic for all provider types

## Technical Considerations

- **Performance**: Health checks should be fast (timeout after 5-10 seconds per provider)
- **API Costs**: Use minimal API calls (e.g., `isAvailable()` which already exists)
- **Error Handling**: Gracefully handle network timeouts, invalid credentials, etc.
- **Output Format**: Consider JSON output option for automation (`--check-config --format json`)
- **Caching**: Don't cache validation results (always test current state)
- **Integration**: Can reuse existing provider factory and `isAvailable()` methods
- **Testing**: Mock provider responses to test various validation scenarios

## Validation Notes

Accepted during revalidation on 2025-12-24. Focused, actionable improvement that provides 80% of value compared to IDEA-005 (config validation & migration) with 20% of the effort. Low effort, medium impact. Good complement to existing error handling improvements. Provides immediate value for users.

## Related Tasks

- [add-config-health-check.md](../../backlog/add-config-health-check.md) - P2, Phase 3
