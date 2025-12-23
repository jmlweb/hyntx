# Architecture

## Overview

Hyntx follows a layered architecture with clear separation of concerns:

```text
┌─────────────────────────────────────────────────────────┐
│                      CLI Layer                          │
│                    (src/index.ts)                       │
│         Argument parsing, orchestration, output         │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│     Core      │   │   Providers   │   │    Utils      │
│  (src/core/)  │   │(src/providers)│   │ (src/utils/)  │
│               │   │               │   │               │
│ • Log reading │   │ • Ollama      │   │ • Env config  │
│ • Sanitizing  │   │ • Anthropic   │   │ • Shell config│
│ • Analysis    │   │ • Google      │   │ • Paths       │
│ • Reporting   │   │ • Factory     │   │ • Terminal    │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │
        └───────────────────┘
                │
        ┌───────────────┐
        │    Types      │
        │ (src/types/)  │
        │               │
        │ Shared type   │
        │ definitions   │
        └───────────────┘
```

---

## Design Principles

### 1. Single Responsibility

Each module has one clear purpose:

| Module | Responsibility |
|--------|---------------|
| `log-reader.ts` | Read and parse Claude Code JSONL logs |
| `sanitizer.ts` | Redact secrets from prompts |
| `analyzer.ts` | Orchestrate analysis with batching |
| `reporter.ts` | Format output for terminal/file |

### 2. Dependency Inversion

High-level modules depend on abstractions, not concrete implementations:

```typescript
// ✅ Good: Core depends on interface
type AnalysisProvider = {
  name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompts: string[], date: string): Promise<AnalysisResult>;
};

// Analyzer works with any provider
function analyzePrompts(
  prompts: string[],
  provider: AnalysisProvider,
): Promise<AnalysisResult>;
```

### 3. Factory Pattern for Providers

Provider creation is centralized in a factory:

```typescript
// src/providers/index.ts
async function getAvailableProvider(
  config: EnvConfig,
  onFallback?: (from: ProviderType, to: ProviderType) => void,
): Promise<AnalysisProvider>;
```

**Benefits**:

- Single point of provider instantiation
- Automatic fallback logic
- Easy to add new providers

### 4. Fail-Fast at Boundaries

Validate inputs at system boundaries, trust internal code:

```typescript
// ✅ Validate at CLI boundary
if (!claudeProjectsExist()) {
  console.error('~/.claude/projects/ not found');
  process.exit(2);
}

// ✅ Internal functions can assume valid inputs
function extractPrompts(messages: ClaudeMessage[]): ExtractedPrompt[] {
  // No need to validate - already validated at boundary
}
```

---

## Data Flow

### Main Execution Flow

```text
1. CLI Entry (index.ts)
   │
   ├─► First Run? ──yes──► Interactive Setup (setup.ts)
   │                              │
   │                              ▼
   │                       Save to shell config
   │
   ├─► Check Reminder? ──yes──► Reminder System (reminder.ts)
   │
   ├─► Read Logs (log-reader.ts)
   │        │
   │        ├─► Validate schema (schema-validator.ts)
   │        └─► Extract user prompts
   │
   ├─► Sanitize Prompts (sanitizer.ts)
   │        │
   │        └─► Redact secrets
   │
   ├─► Get Provider (providers/index.ts)
   │        │
   │        └─► Try each provider in order
   │
   ├─► Analyze (analyzer.ts)
   │        │
   │        ├─► Batch prompts if needed
   │        ├─► Send to provider
   │        └─► Merge results (Map-Reduce)
   │
   └─► Report (reporter.ts)
            │
            ├─► Terminal output
            └─► File output (if --output)
```

---

## Module Specifications

### Core Modules

#### log-reader.ts

Reads Claude Code JSONL logs from `~/.claude/projects/`.

```typescript
type LogReadResult = {
  prompts: ExtractedPrompt[];
  warnings: string[];
};

function readLogs(options: ReadOptions): LogReadResult;
function groupByDay(prompts: ExtractedPrompt[]): DayGroup[];
```

**Responsibilities**:

- Locate project directories
- Parse JSONL files
- Filter by date range and project
- Extract user messages only

#### sanitizer.ts

Redacts sensitive information before sending to AI.

```typescript
function sanitize(text: string): { text: string; redacted: number };
function sanitizePrompts(prompts: string[]): {
  prompts: string[];
  totalRedacted: number;
};
```

**Patterns Detected**:

- API keys (OpenAI, Anthropic, AWS)
- Bearer tokens
- HTTP credentials in URLs
- Email addresses
- Private keys (PEM format)

#### analyzer.ts

Orchestrates analysis with smart batching.

```typescript
function batchPrompts(prompts: string[], limits: ProviderLimits): string[][];

async function analyzePrompts(
  prompts: string[],
  provider: AnalysisProvider,
  date: string,
  onProgress?: (batch: number, total: number) => void,
): Promise<AnalysisResult>;
```

**Batching Strategy**:

1. Check token count against provider limits
2. Split into batches if needed
3. Analyze each batch (Map phase)
4. Merge results (Reduce phase)

#### reporter.ts

Formats analysis results for output.

```typescript
function printReport(
  result: AnalysisResult,
  date: string,
  projects: string[],
): void;

function formatMarkdown(
  result: AnalysisResult,
  date: string,
  projects: string[],
): string;
```

### Provider Modules

All providers implement the same interface:

```typescript
type AnalysisProvider = {
  name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompts: string[], date: string): Promise<AnalysisResult>;
};
```

#### Provider Limits

| Provider | Max Tokens/Batch | Prioritization |
|----------|------------------|----------------|
| Ollama | 30,000 | Longest-first |
| Anthropic | 100,000 | Chronological |
| Google | 500,000 | Chronological |

---

## Key Patterns

### Map-Reduce for Large Volumes

When prompts exceed provider context limits:

```text
┌─────────────────────────────────────────────────────────┐
│                    All Prompts                          │
└─────────────────────────────────────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │  Batch 1  │  │  Batch 2  │  │  Batch 3  │
    └───────────┘  └───────────┘  └───────────┘
           │              │              │
           ▼              ▼              ▼
    ┌───────────┐  ┌───────────┐  ┌───────────┐
    │ Result 1  │  │ Result 2  │  │ Result 3  │   ← MAP
    └───────────┘  └───────────┘  └───────────┘
           │              │              │
           └──────────────┼──────────────┘
                          ▼
                  ┌───────────────┐
                  │ Merged Result │                ← REDUCE
                  └───────────────┘
```

### Multi-Provider Fallback

```typescript
// Tries providers in order until one succeeds
const services = ['ollama', 'anthropic', 'google'];

for (const service of services) {
  const provider = createProvider(service);
  if (await provider.isAvailable()) {
    return provider;
  }
  // Log fallback and continue
}
```

### Schema Validation (Graceful Degradation)

```typescript
// Detect schema version from message structure
const version = detectSchemaVersion(message);

if (!isSchemaSupported(version)) {
  // Add warning but continue with best-effort extraction
  warnings.push(getSchemaWarning(version));
}
```

---

## Error Handling Strategy

### Exit Codes

| Code | Meaning | Example |
|------|---------|---------|
| 0 | Success | Analysis completed |
| 1 | General error | Network failure, API error |
| 2 | No data | No logs found, no prompts in range |
| 3 | Provider unavailable | All providers failed |

### Error Categories

1. **Fatal Errors** - Exit immediately with appropriate code
2. **Warnings** - Log and continue (e.g., schema warnings)
3. **Recoverable** - Try fallback (e.g., provider unavailable)

---

## Extension Points

### Adding a New Provider

1. Create `src/providers/newprovider.ts` implementing `AnalysisProvider`
2. Add to factory in `src/providers/index.ts`
3. Add configuration to `src/utils/env.ts`
4. Add limits to `PROVIDER_LIMITS` in `src/providers/base.ts`

### Adding a New Secret Pattern

Add regex to `PATTERNS` array in `src/core/sanitizer.ts`:

```typescript
{ regex: /pattern/, replacement: '[REDACTED_TYPE]' }
```

### Adding a New CLI Flag

1. Add to `parseArgs` options in `src/index.ts`
2. Handle in main flow
3. Update help text
