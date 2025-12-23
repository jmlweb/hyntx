# Project Rules - Hyntx

## Project Overview

**Hyntx** is a Node.js CLI tool that retrospectively analyzes prompts sent to Claude Code, detects improvement patterns, and generates actionable suggestions with concrete "Before/After" rewrites to help developers improve their prompt engineering skills.

**Key Principles**:

- **Zero Config**: Works with a single command; prompts for setup on first run
- **Privacy-First**: Offline-first with local Ollama, automatic secret redaction
- **Non-Intrusive**: Read-only analysis of Claude Code logs
- **Resilient**: Smart batching for large prompt volumes, graceful schema validation
- **Actionable**: Provides concrete rewrites, not just generic advice

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| **Language** | TypeScript | ^5.7.2 |
| **Runtime** | Node.js | >=18.0.0 |
| **Module Type** | ESM | Pure ESM only |
| **Build Tool** | tsup | ^8.3.5 |
| **Package Manager** | pnpm | Latest |

### Core Dependencies

- `chalk` ^5.3.0 - Terminal color formatting
- `ora` ^8.1.1 - Spinner/loading indicators
- `prompts` ^2.4.2 - Interactive CLI prompts
- `date-fns` ^4.1.0 - Date manipulation
- `glob` ^11.0.0 - File pattern matching

---

## Project Architecture

```text
hyntx/
├── src/
│   ├── index.ts              # CLI entry point & arg parsing
│   ├── core/                 # Core business logic
│   │   ├── setup.ts         # Interactive first-time setup (multi-provider)
│   │   ├── reminder.ts      # Reminder system (tracks last run)
│   │   ├── log-reader.ts    # Reads Claude Code JSONL logs
│   │   ├── schema-validator.ts # Validates log schema compatibility
│   │   ├── sanitizer.ts     # Redacts secrets from prompts
│   │   ├── analyzer.ts      # Analysis orchestration + batching
│   │   └── reporter.ts      # Formats output (terminal/markdown)
│   ├── providers/            # AI provider implementations
│   │   ├── base.ts          # Interface, prompts & provider limits
│   │   ├── ollama.ts        # Local Ollama integration
│   │   ├── anthropic.ts     # Claude API integration
│   │   ├── google.ts        # Gemini API integration
│   │   └── index.ts         # Provider factory with fallback
│   ├── utils/               # Utility functions
│   │   ├── env.ts           # Environment config management
│   │   ├── shell-config.ts  # Shell auto-configuration (~/.zshrc, ~/.bashrc)
│   │   ├── paths.ts         # System path constants
│   │   └── terminal.ts      # Terminal utilities
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── docs/
│   └── SPECS.md             # Complete technical specifications
├── package.json
└── tsconfig.json
```

---

## Code Style & Conventions

### General Rules

- **Follow global TypeScript conventions** from `~/.claude/CLAUDE.md`
- **Functional approach**: Pure functions, immutability, composition
- **Named exports only**: No default exports
- **Strict types**: Avoid `any`, use explicit interfaces

### Project-Specific Patterns

#### Module Organization

```typescript
// ✅ Good: Layered imports
import { readClaudeLogs } from './core/log-reader.js'
import { sanitizePrompts } from './core/sanitizer.js'
import { createProvider } from './providers/index.js'

// ❌ Bad: Circular dependencies or cross-layer imports
import { OllamaProvider } from './providers/ollama.js' // Use factory instead
```

#### Error Handling

```typescript
// ✅ Good: Exit codes for CLI errors
if (!logs.length) {
  console.error('No Claude Code logs found')
  process.exit(2)
}

// ✅ Good: Custom error classes
class ProviderError extends Error {
  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`)
    this.name = 'ProviderError'
  }
}
```

#### CLI Output

```typescript
// ✅ Good: Use chalk and ora for consistent UX
import chalk from 'chalk'
import ora from 'ora'

const spinner = ora('Analyzing prompts...').start()
spinner.succeed(chalk.green('Analysis complete!'))

// ❌ Bad: Plain console.log for user-facing messages
console.log('Analysis complete!')
```

### Type Definitions

All types must be defined in `src/types/index.ts`:

```typescript
// Core types
export type ClaudeMessage = { /* ... */ }
export type ExtractedPrompt = { /* ... */ }
export type AnalysisResult = { /* ... */ }
export type AnalysisProvider = { /* ... */ }

// Configuration types
export type ProviderType = 'ollama' | 'anthropic' | 'google'
export type ReminderFrequency = '7d' | '14d' | '30d' | 'never'
```

---

## Implementation Rules

### Provider Implementation

All AI providers must implement the `AnalysisProvider` interface:

```typescript
interface AnalysisProvider {
  name: string
  isAvailable(): Promise<boolean>
  analyze(prompts: string[], date: string): Promise<AnalysisResult>
}
```

**Key Requirements**:

- Maximum 5 patterns per analysis
- Each pattern includes: frequency, severity, examples (max 3), suggestion, beforeAfter
- **Before/After rewrites**: Each pattern MUST include a concrete rewrite example
- Handle API errors gracefully (exit code 3 for unavailable providers)
- Use streaming responses where available (Ollama, Anthropic)

**Multi-Provider Fallback**:

- Provider factory tries each provider in `HYNTX_SERVICES` order
- If a provider fails `isAvailable()`, automatically tries the next
- Logs fallback events: `⚠️ ollama unavailable, trying anthropic...`

### Context Window Management

The analyzer handles large prompt volumes with smart batching:

- **Ollama**: 30k tokens/batch (conservative for llama3.2)
- **Anthropic**: 100k tokens/batch (Haiku has 200k context)
- **Google**: 500k tokens/batch (Gemini Flash has 1M context)
- Results are merged using Map-Reduce pattern when multiple batches needed

### Schema Validation

The log-reader validates Claude Code JSONL schema:

- Detects schema version from message structure
- Shows warnings for unknown schemas (doesn't crash)
- Allows analysis to continue with best-effort extraction

### Security - Secret Redaction

The `sanitizer.ts` module **must** redact:

- OpenAI/Anthropic API keys (`sk-*`, `claude-*`)
- AWS credentials (`AKIA*`, `aws_secret_access_key`)
- Bearer tokens (`Authorization: Bearer`)
- HTTP credentials in URLs (`https://user:pass@example.com`)
- Email addresses
- Private keys (PEM format)

**Pattern**: Replace with `[REDACTED_<TYPE>]`

### Shell Auto-Configuration

The `shell-config.ts` module auto-updates user's shell config:

- Detects shell config file (`~/.zshrc`, `~/.bashrc`)
- Uses marked config blocks: `# >>> hyntx config >>>`
- Updates existing config or appends new block
- Falls back to showing manual commands if auto-update fails
- Never breaks existing shell config

### CLI Arguments

```bash
hyntx                          # Analyze today's prompts
hyntx --date yesterday         # Analyze yesterday
hyntx --date 2025-01-20        # Analyze specific date
hyntx --from X --to Y          # Analyze date range
hyntx --project my-project     # Filter by project
hyntx --output report.md       # Save report to file
hyntx --dry-run               # Preview without sending to AI
hyntx --check-reminder        # Check reminder status
```

### Environment Variables

**Multi-Provider Configuration** (comma-separated list with automatic fallback):

| Variable | Default | Purpose |
|----------|---------|---------|
| `HYNTX_SERVICES` | - | Provider priority list: `ollama,anthropic,google` |
| `HYNTX_REMINDER` | `7d` | Reminder frequency (`7d`, `14d`, `30d`, `never`) |

**Provider-Specific Variables**:

| Variable | Default | Purpose |
|----------|---------|---------|
| `HYNTX_OLLAMA_MODEL` | `llama3.2` | Ollama model |
| `HYNTX_OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |
| `HYNTX_ANTHROPIC_MODEL` | `claude-3-5-haiku-latest` | Anthropic model |
| `HYNTX_ANTHROPIC_KEY` | - | Anthropic API key |
| `HYNTX_GOOGLE_MODEL` | `gemini-2.0-flash-exp` | Google model |
| `HYNTX_GOOGLE_KEY` | - | Google API key |

**Example**: `HYNTX_SERVICES=ollama,anthropic` tries Ollama first, falls back to Anthropic if unavailable.

---

## Testing & Quality

### Exit Codes

| Code | Scenario |
|------|----------|
| 0 | Success |
| 1 | General error (API, network) |
| 2 | No logs found or no prompts in range |
| 3 | Provider unavailable |

### Testing Strategy

- **Manual testing**: Use `--dry-run` to test log reading and sanitization
- **Provider testing**: Test each provider with small prompt samples
- **Edge cases**: Empty logs, invalid dates, missing API keys

---

## Workflow

### Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Watch mode (rebuilds on changes)
pnpm start        # Run built CLI (dist/index.js)
```

### Build

```bash
pnpm build        # Compile TypeScript with tsup
                  # Outputs: dist/index.js + dist/index.d.ts
```

### Release

```bash
npm version patch/minor/major   # Bump version
npm publish                      # Publish to npm registry
```

---

## Key Files

### Specifications

- **docs/SPECS.md**: Complete technical specifications
  - Read this file before implementing any feature
  - Contains detailed module specs, type definitions, and examples
  - Includes batching strategy, schema validation, and Before/After patterns

### Configuration

- **tsconfig.json**: TypeScript configuration (strict mode, ESM)
- **package.json**: CLI entry point, dependencies, scripts

---

## Common Patterns

### Reading Claude Code Logs

```typescript
// Location: ~/.claude/projects/<project-hash>/logs.jsonl
import { join } from 'path'
import { homedir } from 'os'

const CLAUDE_LOGS_DIR = join(homedir(), '.claude', 'projects')
```

### Date Filtering

```typescript
import { isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns'

const isInRange = isWithinInterval(promptDate, {
  start: startOfDay(fromDate),
  end: endOfDay(toDate)
})
```

### Spinner Pattern

```typescript
const spinner = ora('Loading...').start()
try {
  const result = await longOperation()
  spinner.succeed('Done!')
  return result
} catch (error) {
  spinner.fail('Failed!')
  throw error
}
```

---

## Documentation

### JSDoc Requirements

All exported functions must have JSDoc:

```typescript
/**
 * Analyzes prompts and detects improvement patterns
 * @param prompts - Array of extracted prompts to analyze
 * @param provider - AI provider to use for analysis
 * @returns Analysis result with patterns and statistics
 */
export async function analyzePrompts(
  prompts: ExtractedPrompt[],
  provider: AnalysisProvider
): Promise<AnalysisResult>
```

### README Updates

Keep README.md synchronized with:

- CLI usage examples
- Environment variables
- Installation instructions
- Provider setup guides

---

## Notes

- **Refer to `docs/SPECS.md`** for detailed implementation specifications
- **Privacy is critical**: Always redact secrets before sending to AI
- **User experience matters**: Use colors, spinners, and clear error messages
- **Offline-first**: Default to Ollama, fall back to cloud providers gracefully
- **Actionable output**: Always include Before/After rewrites, not just generic advice
- **Resilience**: Handle large prompt volumes with batching, unknown schemas gracefully
- **This file overrides** global `~/.claude/CLAUDE.md` rules when conflicts arise
