# Project Rules - Hyntx

## Overview

**Hyntx** is a Node.js CLI that analyzes Claude Code prompts and generates improvement suggestions with "Before/After" rewrites.

**Core Principles**: Zero config, Privacy-first (Ollama default), Non-intrusive (read-only), Actionable output.

---

## Documentation

All detailed specifications are in `docs/`:

| Document                                | Purpose                                          |
| --------------------------------------- | ------------------------------------------------ |
| [SPECS.md](docs/SPECS.md)               | Technical specifications, types, module details  |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow, design patterns        |
| [CLI.md](docs/CLI.md)                   | CLI flags, environment variables, output formats |
| [CODE-STYLE.md](docs/CODE-STYLE.md)     | TypeScript conventions, naming, patterns         |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md)   | Setup, build, configs (tsconfig, eslint, vitest) |
| [TESTING.md](docs/TESTING.md)           | Test strategy, mocking, fixtures, coverage       |

**Read relevant docs before implementing features.**

---

## Code Rules

### Module Organization

```typescript
// ✅ Use provider factory, not concrete implementations
import { createProvider } from './providers/index.js'

// ✅ ESM requires .js extension
import { readLogs } from './core/log-reader.js'

// ✅ Named exports only (no default exports)
export function analyzePrompts(...): Promise<AnalysisResult>

// ✅ All types in src/types/index.ts
import { type AnalysisResult } from './types/index.js'
```

### TypeScript

- **Strict mode**: No `any`, use explicit types
- **`type` over `interface`** for consistency
- **Const maps over enums**
- **Explicit return types** on exported functions
- **Inline type imports**: `import { type Foo, bar } from './module.js'`

### Functional Style

- Pure functions, immutability, composition
- Classes only for stateful providers
- Early returns over nested conditionals

### Event-Based Modules

For real-time features, use EventEmitter pattern:

```typescript
// ✅ Factory function returning event-based interface
export function createLogWatcher(options?: WatcherOptions): LogWatcher {
  const emitter = new EventEmitter();
  return {
    start: () => {
      /* ... */
    },
    stop: () => {
      /* ... */
    },
    on: (event, callback) => emitter.on(event, callback),
  };
}

// ✅ Support AbortSignal for graceful shutdown
if (signal?.aborted) {
  await stop();
  return;
}
```

### File Persistence

For atomic file operations:

```typescript
// ✅ Use temp file + rename for atomic writes
const tmpFile = `${filePath}.tmp`;
await writeFile(tmpFile, content, 'utf-8');
await rename(tmpFile, filePath);

// ✅ Always sanitize before persisting
const sanitizedResult = {
  ...result,
  patterns: result.patterns.map((p) => ({
    ...p,
    examples: p.examples.map((e) => sanitize(e).text),
  })),
};
```

### CLI Output

```typescript
// ✅ Use chalk + ora for user-facing output
import chalk from 'chalk';
import ora from 'ora';

const spinner = ora('Analyzing...').start();
spinner.succeed(chalk.green('Done!'));

// ❌ Avoid plain console.log for UX messages
```

### Error Handling

| Exit Code | Scenario                     |
| --------- | ---------------------------- |
| 0         | Success                      |
| 1         | General error (API, network) |
| 2         | No logs/prompts found        |
| 3         | All providers unavailable    |

```typescript
// ✅ Custom errors with context
class ProviderError extends Error {
  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}
```

---

## Module Overview

### Core Modules (src/core/)

- `analyzer.ts` - Analysis orchestration with batching and Map-Reduce
- `history.ts` - Analysis history management (save, load, compare)
- `log-reader.ts` - Claude Code log parsing with date/project filtering
- `reminder.ts` - Periodic reminder system with configurable frequency
- `reporter.ts` - Output formatting (terminal, markdown, JSON)
- `sanitizer.ts` - Secret redaction for privacy
- `schema-validator.ts` - Log schema validation with graceful degradation
- `setup.ts` - Interactive first-run configuration
- `watcher.ts` - Real-time log file monitoring for watch mode

### Provider Modules (src/providers/)

- `base.ts` - Provider interface and shared utilities
- `ollama.ts` - Local Ollama provider (privacy-first)
- `anthropic.ts` - Anthropic Claude provider
- `google.ts` - Google Gemini provider
- `index.ts` - Provider factory with automatic fallback

### Utility Modules (src/utils/)

- `env.ts` - Environment configuration parsing and validation
- `paths.ts` - System path constants
- `terminal.ts` - Terminal output helpers
- `shell-config.ts` - Shell configuration file management
- `logger.ts` - Centralized logging utilities
- `retry.ts` - Retry logic for transient failures
- `rate-limiter.ts` - Rate limiting for API calls
- `config-validator.ts` - Configuration health check utilities
- `project-config.ts` - Project-specific configuration file support (`.hyntxrc`)

---

## Security Rules

**Privacy is critical** - Always sanitize sensitive data:

- Redact API keys (`sk-*`, `claude-*`, `AKIA*`)
- Redact Bearer tokens, HTTP credentials in URLs
- Redact email addresses, PEM private keys
- Pattern: `[REDACTED_<TYPE>]`

**When to sanitize**:

- Before sending to AI providers
- Before persisting to disk (history, logs)
- Before displaying in verbose/debug output

See `src/core/sanitizer.ts` for implementation.

---

## Provider Rules

All providers implement `AnalysisProvider` interface:

```typescript
type AnalysisProvider = {
  name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompts: string[], date: string): Promise<AnalysisResult>;
};
```

**Requirements**:

- Max 5 patterns per analysis
- Each pattern **must** include `beforeAfter` rewrite example
- Handle errors gracefully (use fallback chain)
- Use streaming where available

**Context limits** (for batching):

| Provider  | Tokens/Batch |
| --------- | ------------ |
| Ollama    | 30,000       |
| Anthropic | 100,000      |
| Google    | 500,000      |

---

## Workflow

```bash
pnpm install   # Install deps
pnpm dev       # Watch mode
pnpm build     # Production build
pnpm start     # Run CLI
pnpm check     # Types + lint + format
pnpm test      # Run tests
```

---

## Task and Idea Management

All tasks and ideas are managed via **GitHub Issues**. No local files are used for task tracking.

### Label Taxonomy

| Category       | Labels                                                                     | Purpose           |
| -------------- | -------------------------------------------------------------------------- | ----------------- |
| Idea Lifecycle | `idea`, `idea:pending`, `idea:accepted`, `idea:rejected`, `idea:completed` | Track idea status |
| Task Type      | `type:feature`, `type:bug`, `type:chore`                                   | Categorize work   |
| Priority       | `priority:critical`, `priority:high`, `priority:medium`, `priority:low`    | Task ordering     |
| Effort         | `effort:low`, `effort:medium`, `effort:high`                               | Estimation        |
| Impact         | `impact:low`, `impact:medium`, `impact:high`                               | Value assessment  |

### Commands

| Command           | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `/add-idea`       | Create idea pending validation                 |
| `/validate-idea`  | Accept or reject pending idea                  |
| `/validate-ideas` | Batch validate all pending ideas               |
| `/feed-backlog`   | Convert accepted ideas to tasks                |
| `/complete-idea`  | Mark idea as completed                         |
| `/list-ideas`     | Display ideas with filtering                   |
| `/add-task`       | Create new task                                |
| `/next-task`      | Pick and execute highest priority task         |
| `/reprioritize`   | Reorder task priorities                        |
| `/suggest-idea`   | AI-suggested improvement idea                  |
| `/groom-tasks`    | Clean up obsolete tasks                        |
| `/do-task`        | Orchestrate agents to complete a task (global) |
| `/analyze-debt`   | Update TECHNICAL_DEBT.md                       |

### Idea Lifecycle

```text
/add-idea       -> Creates idea (idea:pending)
/validate-idea  -> Accepts or rejects (idea:accepted | idea:rejected)
/feed-backlog   -> Creates tasks from accepted ideas
/next-task      -> Implements tasks
/complete-idea  -> Closes the cycle (idea:completed)
```

### Task Workflow

1. **Find task**: `/next-task` picks highest priority open task
2. **Implement**: Follow task description and acceptance criteria
3. **Verify**: Run `pnpm check && pnpm test && pnpm build`
4. **Close**: Task is closed via `gh issue close`
5. **Commit**: Use `/commit` with descriptive message

### Priority Guidelines

| Priority | Description                                          |
| -------- | ---------------------------------------------------- |
| critical | Blocks deployments, security issues, production bugs |
| high     | Important feature, significant bug, deadline-driven  |
| medium   | Standard work, normal feature requests               |
| low      | Nice-to-have, minor improvements, can wait           |

### Effort-Impact to Priority Mapping

| Effort | Impact | Priority   |
| ------ | ------ | ---------- |
| Low    | High   | critical   |
| Low    | Medium | high       |
| Medium | High   | high       |
| Medium | Medium | medium     |
| High   | High   | high       |
| Others | -      | medium/low |

---

## Notes

- **Read `docs/SPECS.md`** before implementing features
- **Offline-first**: Default to Ollama, fallback to cloud
- **Actionable**: Always include Before/After rewrites
- **This file overrides** global `~/.claude/CLAUDE.md` when conflicts arise
