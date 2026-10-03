# Project Rules - Hyntx

## Overview

**Hyntx** is a Node.js CLI and Claude Code plugin that turns Claude Code session logs into evidence-backed insights. It parses full sessions (`~/.claude/projects/**/*.jsonl`), computes deterministic metrics and friction episodes, and produces ranked insights, each with evidence and an apply-ready action (CLAUDE.md rule, settings.json permission, slash command, prompt habit or workflow change). An optional LLM step confirms heuristic episodes and adds a summary.

**Core Principles**:

- **Deterministic core**: parsing, metrics, friction detection and ranking are plain code and work with no model
- **Evidence or silence**: an insight needs counts and examples that clear a minimum bar; too little data produces no findings
- **Apply-ready**: every insight ends in one concrete action
- **Local and read-only**: the CLI never modifies Claude Code files or the user's projects
- **Sanitized by contract**: every string in a `Report` is redacted before it is rendered, sent or stored
- **Zero config**: no setup step, no config file

---

## Documentation

| Document                                | Purpose                                           |
| --------------------------------------- | ------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline, module boundaries, design decisions     |
| [SPECS.md](docs/SPECS.md)               | The `Report` contract, detectors, thresholds      |
| [CLI.md](docs/CLI.md)                   | Flags, output formats, exit codes, environment    |
| [CODE-STYLE.md](docs/CODE-STYLE.md)     | TypeScript conventions, naming, patterns          |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md)   | Setup, build, tooling, testing the plugin locally |
| [TESTING.md](docs/TESTING.md)           | Test layout, helpers, what to test                |
| [RELEASE.md](docs/RELEASE.md)           | Versioning and release automation                 |

**Read the relevant doc before implementing a feature. `src/types/index.ts` is the source of truth for data shapes.**

---

## Code Rules

### Module Organization

```typescript
// ✅ Go through the engine entry point, not a concrete engine
import { interpretReport } from './engines/index.js';

// ✅ ESM requires .js extension
import { readSessions } from './core/session-reader.js';

// ✅ Named exports only (no default exports)
export function buildReport(options: BuildReportOptions): Report;

// ✅ All shared types in src/types/index.ts
import { type Report } from './types/index.js';
```

### TypeScript

- **Strict mode**: No `any`, use explicit types
- **`type` over `interface`** for consistency
- **Const maps over enums**
- **Explicit return types** on exported functions
- **Inline type imports**: `import { type Foo, bar } from './module.js'`

### Functional Style

- Pure functions, immutability, composition
- IO at the edges: `cli.ts`, `session-reader.ts`, `history.ts`, `permissions.ts` and the engines do IO; metrics, friction, insights, report building and renderers are pure
- No classes for stateless logic (custom errors are the exception; the logger is a plain factory function)
- Early returns over nested conditionals
- Local mutation is acceptable only where copying would be quadratic (the streaming session reader), and must be commented

### Tolerant Parsing

The Claude Code log format changes between versions and is not a public contract:

```typescript
// ✅ Read every field defensively; count and skip what is unknown
if (typeof record['type'] !== 'string') {
  stats.recordsSkipped += 1;
  return;
}

// ❌ Never throw on an unknown record type or a malformed line
```

Unknown record types and skipped lines are surfaced in `Report.dataQuality`, not hidden.

### File Persistence

```typescript
// ✅ Use temp file + rename for atomic writes
const tmpFile = `${filePath}.tmp`;
await writeFile(tmpFile, content, 'utf-8');
await rename(tmpFile, filePath);
```

Only aggregate numbers are persisted under `~/.hyntx/` (`daily.json`). Never persist prompt text, commands or file names there.

### CLI Output

```typescript
// ✅ Data on stdout, progress and logs on stderr
process.stdout.write(output);
const spinner = ora({ text: 'Analyzing...', stream: process.stderr }).start();

// ✅ chalk + ora for user-facing output; logger for warnings and errors
// ❌ No console.log; `--format json` must print nothing but the Report
```

### Error Handling

| Exit Code | Scenario                               |
| --------- | -------------------------------------- |
| 0         | Success                                |
| 1         | General error (bad arguments, IO)      |
| 2         | No logs, or no sessions for the period |

```typescript
// ✅ Custom errors with context
export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
```

A failing or unavailable interpretation engine is never an error: the deterministic report is still returned, with a note in `dataQuality.notes`.

---

## Module Overview

### Entry points (src/)

- `cli.ts` - Argument parsing, orchestration, exit codes
- `cli-args.ts` - Argument helpers (period resolution, enum parsing), unit tested
- `index.ts` - Public library API
- `types/index.ts` - Raw session model and the serializable `Report` contract

### Core Modules (src/core/)

- `session-reader.ts` - Streams JSONL logs (including subagent sidechains) into `Session` objects; tolerant of format changes
- `metrics.ts` - Deterministic metrics: overall, per project, per day, per session
- `friction.ts` - Friction detectors producing `Episode`s, plus exploratory prompt-trait correlations (never insights); `SAFE_RULE_KEYS` is the short list of commands a permission rule may be suggested for
- `tool-errors.ts` - Tool error classification used by the detectors
- `insights.ts` - Episodes and metrics to ranked `Insight`s with evidence and actions
- `permissions.ts` - Reads existing Claude Code `allow`, `deny` and `ask` rules (read-only) so a suggested rule is never a duplicate and never meets a deny or ask rule
- `insight-review.ts` - Applies interpretation verdicts to insights (`confirmed`, `dismissed`, `unverified`, with coverage); the one source renderers and the JSON use
- `report.ts` - Builds the `Report`; `sanitizeReport` is the final pass (redaction plus removal of terminal escape sequences)
- `sanitizer.ts` - Secret and personal-data redaction
- `history.ts` - Daily aggregate history under `~/.hyntx/daily.json`

### Engine Modules (src/engines/)

- `index.ts` - `interpretReport`: runs the chosen engine, degrades to a note on failure
- `claude.ts` - Default engine, shells out to `claude -p` with the user's login
- `disclosure.ts` - The stderr notice, printed before the call, about where data goes
- `ollama.ts` - Local engine (opt-in)

### Report Modules (src/report/)

- `terminal.ts`, `markdown.ts` - Text renderers
- `html.ts`, `html/` - Self-contained HTML report
- `shared.ts` - Formatting helpers shared by renderers

### Utility Modules (src/utils/)

- `paths.ts` - Path constants and their environment overrides
- `dates.ts`, `text.ts` - Date and text helpers
- `logger.ts` - Minimal stderr logger (`createLogger`)
- `atomic-write.ts` - Temp-file-and-rename writes with unique temp names
- `collections.ts` - Linear `pushTo` for grouping into Maps

### Plugin (outside src/)

- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` - Claude Code plugin manifest; the repo is its own marketplace
- `skills/hyntx/SKILL.md` - The `/hyntx:hyntx` skill: a prompt for the session's Claude, which acts as the interpretation layer
- `skills/hyntx/scripts/run-analyzer.mjs` - Locates a v4 analyzer, runs it without a shell with validated arguments and `--format json --no-llm`, prints a digest and deletes its temp directory; helpers in `analyzer-lib.mjs`

---

## Security Rules

**Privacy is critical.** Session logs contain prompts, commands, file contents and tool output.

- The session reader sanitizes prompt, command, tool-result and assistant text before truncating them, so the in-memory session model is already redacted for those fields; other fields (titles, file paths, cwd) are not. It is never serialized as is, logged or sent.
- Everything in a `Report` is sanitized. Detectors sanitize what they put in an episode, and `sanitizeReport` runs over every free-text string again as a safety net, including engine output.
- Redaction pattern: `[REDACTED_<TYPE>]` (API keys, tokens, URL credentials, PEM keys, emails, personal identifiers). See `src/core/sanitizer.ts`.
- Engines receive the sanitized `Report`, never sessions.
- Only aggregate numbers go to `~/.hyntx/`.
- The CLI never writes to `~/.claude/` or to a project. Applying an action is done by the plugin skill, one change at a time, after the user confirms.

**What leaves the machine**: nothing with `--no-llm`; with `--engine ollama`, sanitized excerpts go to `OLLAMA_HOST`, which is this machine by default and not necessarily so if the variable is set; with the default `claude` engine, sanitized excerpts go to Anthropic. The CLI prints a notice on stderr before any engine call. Keep README and docs accurate about this when engines change.

---

## Engine Rules

An engine is a function, not a class:

```typescript
type EngineFn = (
  report: Report,
  options: InterpretOptions,
) => Promise<Interpretation | null>;
```

**Requirements**:

- Input is the sanitized `Report`; send only the excerpts needed to judge episodes
- Output is an `Interpretation`: a verdict per episode (`confirmed`, `rejected`, `unclear`), a summary, optional recommendations that cite the episodes they are based on
- Engines confirm or reject what the detectors found; they do not invent findings without evidence
- Return `null` when the engine is unavailable and throw on failure; `interpretReport` turns both into a `dataQuality` note
- No API keys: the `claude` engine uses the user's Claude Code login, Ollama is local
- Honour `options.signal`

**Report contract**: `schemaVersion` changes only for breaking changes. Adding fields is not breaking, and consumers (HTML report, plugin skill) must tolerate fields they do not know. When the `Report` shape changes, update `skills/hyntx/SKILL.md` and `docs/SPECS.md`.

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

- **Read `docs/SPECS.md`** before changing detectors, insights or the `Report`
- **Deterministic first**: a finding must stand without a model; the LLM step only confirms and phrases
- **Actionable**: every insight carries evidence and one apply-ready action
- **This file overrides** global `~/.claude/CLAUDE.md` when conflicts arise
