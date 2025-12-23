# Complete Utilities

## Metadata

- **Priority**: P3
- **Phase**: 1
- **Dependencies**: tipos-base.md
- **Estimation**: 3-4 hours

## Description

Implement all system utilities: environment variable management, path constants, and terminal utilities (if needed).

## Objective

Provide reusable utility functions that simplify working with configuration, paths, and terminal throughout the system.

## Scope

- Includes: Environment variable parsing, first use detection, path constants, terminal utilities if needed
- Excludes: Shell config (already in setup-inicial.md), specific functions from other modules

## Files to Create/Modify

- `src/utils/env.ts` - Environment variable management
- `src/utils/paths.ts` - Path constants (complete)
- `src/utils/terminal.ts` - Terminal utilities (if needed)

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `EnvConfig`
- `ProviderType`

### Main Functions/Classes

**src/utils/env.ts:**

- `isFirstRun()` - Verifies if it's first use (no HYNTX_SERVICES)
- `parseServices()` - Parses HYNTX_SERVICES to array
- `getEnvConfig()` - Gets complete configuration from environment variables

**src/utils/paths.ts:**

- `CLAUDE_PROJECTS_DIR` - Path to `~/.claude/projects`
- `LAST_RUN_FILE` - Path to `~/.hyntx-last-run`

**src/utils/terminal.ts:**

- Terminal utility functions if needed (colors, formatting, etc.)

### Integrations

- Used by all modules that need configuration
- Used by setup, reminder, log-reader, etc.

## Acceptance Criteria

- [ ] isFirstRun correctly detects first use
- [ ] parseServices correctly parses provider list
- [ ] parseServices filters invalid providers
- [ ] getEnvConfig returns complete configuration with defaults
- [ ] getEnvConfig handles missing values with correct defaults
- [ ] Path constants are correct
- [ ] Paths use `homedir()` correctly
- [ ] Terminal utilities work if implemented

## Test Cases

- First use correctly detected
- Parsing valid services
- Parsing invalid services (should filter)
- Configuration with all variables
- Configuration with missing variables (should use defaults)
- Path constants are correct on different systems

## References

- Section 17 of `docs/SPECS.md` - Utils
- Section 2 of `docs/SPECS.md` - Environment Variables
