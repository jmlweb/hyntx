# Basic CLI Entry Point

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: tipos-base.md, setup-inicial.md, log-reader-completo.md, sanitizer.md, analyzer-batching.md, provider-base-ollama.md, reporter-terminal.md, utils-completos.md
- **Estimation**: 6-7 hours

## Description

Implement the basic CLI entry point that integrates all components to provide minimum viable functionality: read logs, analyze with Ollama, and display results.

## Objective

Provide a functional CLI that allows basic prompt analysis, establishing the foundation for advanced features.

## Scope

- Includes: Basic argument parsing (--date, --help, --version), component integration, basic analysis flow
- Excludes: Advanced options (--from, --to, --project, --output, --verbose, --dry-run, --check-reminder), multiple providers, reminder system

## Files to Create/Modify

- `src/index.ts` - CLI entry point (basic version)

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts` and all system modules.

### Main Functions/Classes

**src/index.ts:**

- `main()` - Main function that orchestrates the complete flow
- Argument parsing with Node.js `parseArgs`

### Integrations

- Integrates all core modules:
  - `setup.ts` - For first use
  - `log-reader.ts` - To read logs
  - `sanitizer.ts` - To sanitize prompts
  - `analyzer.ts` - For analysis with batching
  - `reporter.ts` - To display results
  - `providers/ollama.ts` - For analysis
  - `utils/env.ts` - For configuration
  - `utils/paths.ts` - For paths

## Acceptance Criteria

- [ ] Parses basic arguments (--date, --help, --version)
- [ ] Shows help when --help is used
- [ ] Shows version when --version is used
- [ ] Executes setup on first use
- [ ] Reads Claude Code logs
- [ ] Shows error if no logs found
- [ ] Sanitizes prompts before analysis
- [ ] Connects to Ollama provider
- [ ] Analyzes prompts with batching
- [ ] Displays results in terminal
- [ ] Handles basic errors with clear messages
- [ ] Uses spinners for progress feedback
- [ ] Correct exit codes (0 success, 1 error, 2 no logs, 3 no providers)

## Test Cases

- First use (should execute setup)
- Normal use with valid logs
- Use without logs (should show error)
- Use without Ollama available (should show error)
- Successful analysis with results
- Analysis with many prompts (should use batching)
- --help and --version commands

## Technical Debt Reference

This task addresses the following item from `TECHNICAL_DEBT.md`:

- **Item 7**: CLI Entry Point is Placeholder

**Post-completion action**: Remove item 7 from `TECHNICAL_DEBT.md`.

## References

- Section 16 of `docs/SPECS.md` - Entry Point (basic version, without all options)
- `TECHNICAL_DEBT.md` - Item 7
