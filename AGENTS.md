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

## Backlog Management

### Structure

| File              | Purpose                                          |
| ----------------- | ------------------------------------------------ |
| `docs/ROADMAP.md` | Prioritized roadmap with phases and dependencies |
| `backlog/*.md`    | Individual task specifications                   |

### Workflow

1. **Task Selection**: Pick tasks from `docs/ROADMAP.md` following priority order (P0 → P1 → P2 → P3)
2. **Implementation**: Follow the task specification in `backlog/<task-name>.md`
3. **Verification**: Run linting and tests to ensure the task works
4. **Completion**:
   - Delete the task file from `backlog/`
   - Update `docs/ROADMAP.md` (mark as completed or remove)
   - Create a descriptive commit following Conventional Commits

### Commands

| Command         | Purpose                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/next-task`    | Pick next task, execute, verify, cleanup, commit (full workflow)                                                    |
| `/add-task`     | Add a new task to backlog and update roadmap                                                                        |
| `/do-task`      | Orchestrate agents to complete a task (global)                                                                      |
| `/groom-tasks`  | Evaluate task specifications, update outdated tasks, remove obsolete tasks from backlog and roadmap                 |
| `/reprioritize` | Evaluate and reorder tasks in roadmap to ensure optimal implementation order respecting dependencies and priorities |

### Task Completion Workflow

**Recommended**: Use `/next-task` to automate the full workflow.

**Manual workflow**:

1. **Implement**: Use `/do-task <task-name>` to implement
2. **Verify**: Run `pnpm check && pnpm test && pnpm build`
3. **Cleanup**: Delete `backlog/<task>.md`, update `docs/ROADMAP.md`
4. **Commit**: Use `/commit` with descriptive message

**Required Steps After Completing Any Task**:

Every completed task must go through these validation and maintenance steps:

1. **Validation**: Run linting, testing, and build verification
   - Execute `pnpm check` (types + lint + format)
   - Run `pnpm test` to ensure all tests pass
   - Verify `pnpm build` completes successfully

2. **Documentation Update**: Keep documentation current
   - Update relevant docs in `docs/` if the task affects architecture, specs, or CLI
   - Update `README.md` if user-facing features changed
   - Add/update code comments if implementation details require clarification

3. **Rules Review**: Evaluate if rules need updates
   - Review `AGENTS.md` to determine if new patterns or conventions emerged
   - Consider if existing rules should be updated or new rules added
   - Document any new conventions or patterns discovered during implementation

### Task File Template

```markdown
# Task Title

## Metadata

- **Priority**: P0/P1/P2/P3
- **Phase**: 1-5
- **Dependencies**: list of dependencies
- **Estimation**: time estimate

## Description

What the task accomplishes.

## Objective

Why this task is needed.

## Scope

- Includes: what is in scope
- Excludes: what is out of scope

## Files to Create/Modify

- List of files

## Implementation

Detailed implementation steps.

## Acceptance Criteria

- [ ] Criteria 1
- [ ] Criteria 2

## Test Cases

- Test case descriptions

## References

- Links to relevant docs
```

---

## Notes

- **Read `docs/SPECS.md`** before implementing features
- **Offline-first**: Default to Ollama, fallback to cloud
- **Actionable**: Always include Before/After rewrites
- **This file overrides** global `~/.claude/CLAUDE.md` when conflicts arise
