# Hyntx - Technical Specifications

## 1. Overview

### 1.1 Description

Node.js CLI that retrospectively analyzes prompts sent to Claude Code, detects improvement patterns, and generates a digest with actionable suggestions including concrete "Before/After" rewrites.

### 1.2 Design Principles

- **Zero config**: Works with a single command, prompts for necessary info on first run
- **Auto-configuration**: Automatically updates shell config files when possible
- **Non-intrusive**: Read-only access to existing logs
- **Offline-first**: Local Ollama by default
- **Privacy**: Automatic secret sanitization
- **Resilient**: Handles large prompt volumes and schema changes gracefully
- **Actionable**: Provides concrete rewrites, not just generic advice
- **Multi-provider**: Supports multiple providers with automatic fallback

> **Implementation details**: See [ARCHITECTURE.md](ARCHITECTURE.md#design-principles)

### 1.3 Tech Stack

- Runtime: Node.js >= 22
- Language: TypeScript
- Build: tsup
- Distribution: npm/npx

### 1.4 User Experience

```bash
# First run - interactive setup
$ npx hyntx

👋 Welcome to Hyntx!

? Select providers (space to select, enter to confirm):
  ◉ ollama (local - requires Ollama installed)
  ◯ anthropic (Claude Haiku - requires API key)
  ◯ google (Gemini Flash - requires API key)

? Ollama model to use: (llama3.2)

✅ Setup complete!

? Save configuration to ~/.zshrc? (Y/n)

✅ Configuration saved to ~/.zshrc
   Run 'source ~/.zshrc' or open a new terminal to apply.

Analyzing today's prompts...
```

```bash
# If auto-save fails or user declines
✅ Setup complete!

Add this to your ~/.zshrc or ~/.bashrc:

  export HYNTX_SERVICES=ollama
  export HYNTX_OLLAMA_MODEL=llama3.2

  # Reminder on terminal open (optional)
  hyntx --check-reminder 2>/dev/null
```

```bash
# Multi-provider configuration (tries in order)
$ npx hyntx
📊 Analyzing 15 prompts from today...
⚠️  ollama unavailable, trying anthropic...
✅ anthropic connected
[report with Before/After examples]
```

---

## 2. Environment Variables

All configuration is managed via environment variables. The system supports:

- **Core configuration**: Provider selection (`HYNTX_SERVICES`), reminder frequency (`HYNTX_REMINDER`)
- **Provider-specific**: Model selection and API keys for Ollama, Anthropic, and Google
- **Persistent state**: Last run timestamp stored in `~/.hyntx-last-run`

> **Complete reference**: See [CLI.md](CLI.md#environment-variables) for all variables, defaults, and example configurations

---

## 3. Project Structure

The project follows a layered architecture with clear separation of concerns:

- **`src/core/`**: Core business logic (log reading, sanitization, analysis, reporting)
- **`src/providers/`**: AI provider implementations (Ollama, Anthropic, Google)
- **`src/utils/`**: Utility functions (environment config, paths, shell integration)
- **`src/types/`**: Shared TypeScript type definitions

> **Architecture details**: See [ARCHITECTURE.md](ARCHITECTURE.md) for module specifications, data flow, and design patterns

---

## 4. Dependencies (package.json)

Base configuration already exists in `package.json`. Runtime dependencies (chalk, ora, prompts, boxen, cli-table3, figlet, date-fns, glob) will be added as needed during implementation of their respective modules.

---

## 5. CLI Interface

The CLI supports date filtering, project filtering, output formats, and debugging options.

**Key capabilities:**

- Date selection: `today`, `yesterday`, or ISO date format
- Date ranges: `--from` and `--to` flags
- Project filtering: `--project` flag
- Output formats: Terminal (default), Markdown, or JSON
- Exit codes: 0 (success), 1 (error), 2 (no data), 3 (provider unavailable)

> **Complete CLI reference**: See [CLI.md](CLI.md) for all flags, usage examples, date formats, and output format specifications

---

## 6. TypeScript Types (src/types/index.ts)

✅ **Implemented** - All types are defined in `src/types/index.ts`.

---

## 7. Shell Config Auto-Update (src/utils/shell-config.ts)

✅ **Implemented** - Shell configuration utilities are implemented in `src/utils/shell-config.ts`.

**Functions**:

- `detectShellConfigFile()` - Detects user's shell type and config file path
- `generateEnvExports()` - Generates export statements for environment variables
- `updateShellConfig()` - Updates or creates configuration block in shell file
- `saveConfigToShell()` - Main function to save configuration
- `getManualInstructions()` - Generates manual instructions for user

**Features**:

- Supports zsh, bash, and fish shells
- Uses clear markers (`# >>> hyntx config >>>`) for configuration blocks
- Handles existing blocks (replaces) or creates new ones
- Graceful error handling with manual fallback

---

## 8. Interactive Setup (src/core/setup.ts)

✅ **Implemented** - Interactive setup system is implemented in `src/core/setup.ts`.

**Functions**:

- `runSetup()` - Main function that orchestrates interactive setup
- `showManualInstructions()` - Shows manual instructions if auto-save fails

**Features**:

- Multi-provider selection (ollama, anthropic, google)
- Provider-specific configuration (models, API keys, hosts)
- Reminder frequency configuration
- Auto-save to shell config files
- Manual instructions fallback
- Sets environment variables for current session
- Uses `prompts` for clean interactive UI
- Uses `chalk` and `boxen` for visual appeal

---

## 9. Reminder System (src/core/reminder.ts)

✅ **Implemented** - Reminder system is implemented in `src/core/reminder.ts`.

**Functions**:

- `getLastRun()` - Reads last execution timestamp from `~/.hyntx-last-run`
- `saveLastRun()` - Saves current timestamp in ISO format
- `getDaysElapsed()` - Calculates days since last run
- `shouldShowReminder()` - Checks if reminder should be shown based on config
- `showReminder()` - Shows interactive reminder prompt
- `checkReminder()` - Main function to check and handle reminders

**Features**:

- Supports configurable frequencies (7d, 14d, 30d, never)
- Interactive prompt with continue, postpone, or disable options
- Handles first-run case (never executed before)
- Graceful handling of corrupted or invalid state files

---

## 10. Schema Validator (src/core/schema-validator.ts)

✅ **Implemented** - Schema validation is implemented in `src/core/schema-validator.ts`.

---

## 11. Log Reading (src/core/log-reader.ts)

### 11.1 Location

```text
~/.claude/projects/<project-hash>/*.jsonl
```

Where `<project-hash>` is the encoded path:

- `/Users/jose/code/my-app` → `-Users-jose-code-my-app`

### 11.2 JSONL Structure

```json
{
  "type": "user",
  "message": {
    "role": "user",
    "content": "refactor the auth module"
  },
  "timestamp": "2025-01-23T14:30:00.000Z",
  "sessionId": "abc123-def456",
  "cwd": "/Users/jose/code/my-app"
}
```

### 11.3 Implementation

✅ **Implemented** - `src/core/log-reader.ts` provides:

- `claudeProjectsExist()` - Check if Claude projects directory exists
- `readLogs()` - Read all JSONL files and extract user prompts with date and project filtering
- `getProjects()` - List all project directories

---

## 12. Sanitizer (src/core/sanitizer.ts)

✅ **Implemented** - Sanitizer is implemented in `src/core/sanitizer.ts`.

**Functions**:

- `sanitize()` - Redacts sensitive information from a single text string
- `sanitizePrompts()` - Sanitizes multiple prompts and tracks total redactions

**Pattern Detection**:

- API keys (OpenAI, Anthropic, AWS)
- Bearer tokens
- HTTP credentials in URLs
- Email addresses
- Private keys (PEM format)

---

## 13. Analyzer with Batching (src/core/analyzer.ts)

✅ **Implemented** - Analyzer with batching is implemented in `src/core/analyzer.ts`.

**Functions**:

- `batchPrompts()` - Splits prompts into batches based on provider token limits
- `analyzePrompts()` - Orchestrates analysis with progress tracking
- `mergeResults()` - Combines results from multiple batches (Map-Reduce)

**Batching Strategy**:

- Respects provider-specific token limits
- Applies prioritization strategies (chronological or longest-first)
- Handles oversized prompts gracefully

---

## 14. Providers

✅ **Implemented** - All providers are implemented with multi-provider support and automatic fallback.

### 14.1 Base (src/providers/base.ts)

Defines the `AnalysisProvider` interface and shared utilities for all providers.

**Key Exports**:

- `AnalysisProvider` interface
- `PROVIDER_LIMITS` - Token limits and prioritization strategies per provider
- Analysis prompts and result parsing utilities

### 14.2 Ollama (src/providers/ollama.ts)

Local AI provider using Ollama for privacy-first analysis.

**Features**:

- Health check via `/api/tags` endpoint
- Streaming support for long responses
- Automatic model availability validation
- Configurable host and model selection

### 14.3 Anthropic (src/providers/anthropic.ts)

Cloud provider using Anthropic's Claude models.

**Features**:

- API key validation
- Support for Claude 3.5 Haiku and other models
- Streaming support for real-time results
- Proper error handling and rate limiting awareness

### 14.4 Google (src/providers/google.ts)

Cloud provider using Google's Gemini models.

**Features**:

- API key validation
- Support for Gemini 2.0 Flash and other models
- Large context window support (500k tokens)
- JSON response parsing

### 14.5 Factory with Multi-Provider Support (src/providers/index.ts)

Provider factory with automatic fallback chain.

**Functions**:

- `createProvider()` - Instantiates a specific provider
- `getAvailableProvider()` - Tries providers in order with fallback callbacks
- Provider availability checking and error handling

---

## 15. Reporter (src/core/reporter.ts)

The reporter module formats analysis results for different output formats. The terminal output prioritizes visual appeal and usability.

### 15.1 Terminal UI Requirements

The terminal reporter must provide an **attractive and visually engaging** user experience using the following tools:

| Library        | Purpose       | Visual Result                               | Usage                                                                  |
| -------------- | ------------- | ------------------------------------------- | ---------------------------------------------------------------------- |
| **chalk**      | Colors        | Vibrant colors and styles (bold, underline) | Semantic coloring: success=green, warning=yellow, error=red, info=cyan |
| **ora**        | Spinners      | Elegant animated loading icons              | Short operations (provider connection, single operations)              |
| **prompts**    | Interactivity | Clean visual menus, lists, and prompts      | Interactive setup, user input (menus, confirmations, text input)       |
| **boxen**      | Containers    | Draws boxes around text in terminal         | Visual separation of sections, callouts, Before/After examples         |
| **cli-table3** | Tables        | Formatted tables for structured data        | Statistics, patterns list, data grids                                  |
| **figlet**     | ASCII art     | Text-based logos and banners                | Optional header/logo (can be disabled via `--no-art` flag)             |

**Visual Features:**

- **ASCII Art Headers**: Optional ASCII art logo/banner for brand identity (can be disabled via `--no-art` flag)
- **Boxed Sections**: Use `boxen` to create visually distinct sections with borders
- **Tables**: Use `cli-table3` for structured data (statistics, patterns list)
- **Spinners**: Use `ora` for operations with indeterminate duration (provider connection, analysis)
- **Colors**: Use `chalk` consistently for semantic coloring (success=green, warning=yellow, error=red, info=cyan)
- **Interactivity**: Use `prompts` for clean, visual interactive menus and user input
- **Animations**: Smooth transitions and loading states throughout the workflow

**Visual Hierarchy**:

- Headers: Bold, colored, optionally boxed
- Statistics: Tabular format with clear labels
- Patterns: Boxed sections with severity indicators
- Before/After: Side-by-side or stacked with clear visual distinction
- Suggestions: Highlighted callout boxes

✅ **Implemented** - Reporter is implemented in `src/core/reporter.ts`.

**Functions**:

- `printReport()` - Formats and prints terminal output with colors and boxes
- `formatMarkdown()` - Generates markdown report from analysis results
- `formatJson()` - Generates JSON output for programmatic consumption

**Supported Output Formats**:

- Terminal (default) - Visual output with colors, tables, and boxed sections
- Markdown - Clean markdown format for documentation
- JSON - Structured data for integration with other tools

---

## 16. Entry Point (src/index.ts)

✅ **Implemented** - CLI entry point is implemented in `src/index.ts`.

**Features**:

- Argument parsing with all CLI flags
- Interactive setup on first run
- Reminder system integration
- Complete analysis workflow orchestration
- Error handling with appropriate exit codes
- Support for all output formats (terminal, markdown, JSON)

---

## 17. Utils

✅ **Implemented** - Utilities are implemented in `src/utils/`.

**Modules**:

- `env.ts` - Environment configuration parsing and validation
- `paths.ts` - System path constants and utilities
- `terminal.ts` - Terminal output helpers
- `shell-config.ts` - Shell configuration file management
- `logger.ts` - Centralized logging utilities
- `retry.ts` - Retry logic for transient failures
- `rate-limiter.ts` - Rate limiting for API calls
- `config-validator.ts` - Configuration health check utilities
- `project-config.ts` - Project-specific configuration file support

---

## 18. Error Handling

The system uses a three-tier error handling strategy:

- **Fatal errors**: Exit immediately with appropriate exit code (0-3)
- **Warnings**: Log and continue (e.g., schema validation warnings)
- **Recoverable errors**: Try fallback (e.g., provider unavailable)

Exit codes: 0 (success), 1 (general error), 2 (no data), 3 (all providers unavailable)

✅ **Implemented** - Error handling is implemented throughout the application following the three-tier strategy with appropriate exit codes and recovery mechanisms.

> **Implementation details**: See [ARCHITECTURE.md](ARCHITECTURE.md#error-handling-strategy) for error categories and handling patterns

---

## 19. Testing

Testing strategy uses Vitest for unit and integration tests with focus on core business logic, provider behavior validation, and edge case coverage.

**Test categories:**

- Unit tests: Individual functions in isolation
- Integration tests: Module interactions and external dependencies
- Coverage goals: 85%+ overall, 90%+ for core modules

> **Complete testing strategy**: See [TESTING.md](TESTING.md) for test structure, mocking strategies, fixtures, and edge cases

---

## 20. Future Enhancements

For post-v1.0 ideas and long-term plans, see [FUTURE_PLANS.md](FUTURE_PLANS.md).

**Note**: Some features originally planned for v1.1+ have been moved to the v1.0 backlog:

- **Project-Specific Configuration**: Now in backlog as [IDEA-007](../ideas/accepted/IDEA-007-project-specific-configuration-file.md)
- **JSON Output Format**: Now in backlog as [IDEA-001](../ideas/accepted/IDEA-001-add-json-output-format.md)

---

## 21. Documentation Standards

### 21.1 File Organization

Documentation is organized in single files by topic, stored in the `docs/` directory:

| File              | Purpose                                                         |
| ----------------- | --------------------------------------------------------------- |
| `SPECS.md`        | Technical specifications (this file)                            |
| `ARCHITECTURE.md` | System architecture, design patterns, and data flow             |
| `CLI.md`          | CLI interface, flags, environment variables, and output formats |
| `CODE-STYLE.md`   | TypeScript conventions, naming, and code style guidelines       |
| `DEVELOPMENT.md`  | Development setup, build configuration, and tooling             |
| `TESTING.md`      | Testing strategy, mocking, and coverage goals                   |

### 21.2 File Splitting Rules

When a documentation file becomes too large to maintain effectively, it should be split into smaller files following this convention:

1. **Create an index file** with the suffix `-INDEX`:
   - `DEPLOYMENT-INDEX.md` - Contains a table of contents with links to related files

2. **Create topic-specific files** with descriptive suffixes:
   - `DEPLOYMENT-REPOSITORY.md`
   - `DEPLOYMENT-NPM.md`

**Guidelines:**

- Split only when necessary (file becomes hard to navigate or maintain)
- Create exactly the number of files needed, no more, no less
- Index file must link to all related files in the group
- Use kebab-case for file suffixes
- Maintain consistent naming within each documentation group

**Example structure after splitting:**

```text
docs/
├── SPECS.md
├── ARCHITECTURE.md
├── DEPLOYMENT-INDEX.md
├── DEPLOYMENT-REPOSITORY.md
└── DEPLOYMENT-NPM.md
```
