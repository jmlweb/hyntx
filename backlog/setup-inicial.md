# Initial Interactive Setup

## Metadata

- **Priority**: P0
- **Phase**: 1
- **Dependencies**: tipos-base.md, utils-completos.md (partial - shell-config only)
- **Estimation**: 4-5 hours

## Description

Implement the interactive setup system that runs on first use of Hyntx. Allows users to select providers, configure credentials, and save configuration to the user's shell file.

## Objective

Provide a frictionless initial configuration experience that allows users to configure Hyntx with a single command, following the "zero config" principle.

## Scope

- Includes: Interactive setup, shell detection, export generation, shell file updates, manual instructions
- Excludes: Credential validation (done in providers), state persistence (done in reminder)

## Files to Create/Modify

- `src/core/setup.ts` - Main interactive setup logic
- `src/utils/shell-config.ts` - Functions to detect and update shell files

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `ProviderType`
- `ShellConfigResult`

### Main Functions/Classes

**src/core/setup.ts:**

- `runSetup()` - Main function that orchestrates setup
- `showManualInstructions()` - Shows manual instructions if auto-save fails

**src/utils/shell-config.ts:**

- `detectShellConfigFile()` - Detects the shell configuration file
- `generateEnvExports()` - Generates export lines for environment variables
- `updateShellConfig()` - Updates or creates the configuration block in the shell file
- `saveConfigToShell()` - Main function to save configuration
- `getManualInstructions()` - Generates manual instructions for the user

### Integrations

**Terminal UI:**

- Uses `prompts` for clean visual interactive menus, lists, and user input
- Uses `chalk` for terminal colors and styling
- Uses `boxen` for boxed sections in setup instructions (optional)

**Core:**

- Integrates with `src/types/index.ts` for types
- Reads/writes system files (`~/.zshrc`, `~/.bashrc`, etc.)

## Acceptance Criteria

- [ ] Setup runs automatically on first use
- [ ] Allows multiple provider selection (ollama, anthropic, google)
- [ ] Requests specific configuration for each selected provider
- [ ] Allows configuring reminder frequency
- [ ] Correctly detects user's shell file (zsh/bash)
- [ ] Updates or creates the configuration block in the shell file
- [ ] Shows manual instructions if auto-save fails
- [ ] Sets environment variables for the current session
- [ ] Configuration block uses clear markers (`# >>> hyntx config >>>`)
- [ ] Handles file write errors gracefully

## Test Cases

- Setup with a single provider (Ollama)
- Setup with multiple providers
- Setup when shell file doesn't exist (should create it)
- Setup when block already exists (should replace it)
- Setup when write fails (should show manual instructions)
- Verify that environment variables are set correctly

## References

- Section 7 of `docs/SPECS.md` - Shell Config Auto-Update
- Section 8 of `docs/SPECS.md` - Interactive Setup
- Section 1.4 of `docs/SPECS.md` - User Experience (flow examples)
