# Code Style Guide

## General Principles

### Functional Approach

Favor functions over classes. Use composition instead of inheritance.

```typescript
// ✅ Good: Pure functions
function sanitize(text: string): { text: string; redacted: number } {
  let result = text;
  let count = 0;
  // ...
  return { text: result, redacted: count };
}

// ✅ Good: Composition
const pipeline = compose(
  readLogs,
  sanitizePrompts,
  analyzePrompts,
  formatReport,
);

// ❌ Avoid: Classes for stateless operations
class Sanitizer {
  sanitize(text: string): string {
    // ...
  }
}
```

**Exception**: Provider classes are acceptable because they encapsulate configuration state.

### Immutability

Avoid mutations. Prefer spreading and mapping.

```typescript
// ✅ Good: Create new object
const updated = { ...config, model: 'gpt-4' };

// ✅ Good: Map to new array
const filtered = prompts.filter((p) => p.length > 0);

// ❌ Avoid: Mutation
config.model = 'gpt-4';
prompts.push(newPrompt);
```

### Pure Functions

Functions should be predictable - same input, same output.

```typescript
// ✅ Good: Pure function
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ❌ Avoid: Side effects in pure-looking functions
function estimateTokens(text: string): number {
  console.log('Estimating tokens...'); // Side effect!
  return Math.ceil(text.length / 4);
}
```

---

## TypeScript Conventions

### Strict Mode

All projects use strict TypeScript. Never use `any`.

```typescript
// ✅ Good: Explicit types
function parseResponse(text: string): AnalysisResult {
  const data: unknown = JSON.parse(text);
  // Validate and type-narrow
}

// ❌ Avoid: any
function parseResponse(text: string): any {
  return JSON.parse(text);
}
```

### Type Definitions

Use `type` over `interface` for consistency:

```typescript
// ✅ Preferred: type
type AnalysisResult = {
  patterns: AnalysisPattern[];
  stats: AnalysisStats;
};

// ❌ Avoid: interface (unless extending)
interface AnalysisResult {
  patterns: AnalysisPattern[];
  stats: AnalysisStats;
}
```

### Const Maps Over Enums

```typescript
// ✅ Good: Const map with type derivation
const Severity = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

type Severity = (typeof Severity)[keyof typeof Severity];

// ❌ Avoid: enum
enum Severity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}
```

### Type-Only Imports

Use inline type imports:

```typescript
// ✅ Good: Inline type import
import { type AnalysisResult, parseResponse } from './base.js';

// ❌ Avoid: Separate type import lines
import type { AnalysisResult } from './base.js';
import { parseResponse } from './base.js';
```

### Explicit Return Types

Always declare return types for exported functions:

```typescript
// ✅ Good: Explicit return type
export function sanitize(text: string): { text: string; redacted: number } {
  // ...
}

// ❌ Avoid: Inferred return type for exports
export function sanitize(text: string) {
  // ...
}
```

---

## Naming Conventions

### Variables and Functions

Use `camelCase` with descriptive names:

```typescript
// ✅ Good: Descriptive with auxiliary verbs
const isLoading = true;
const hasError = false;
const canSubmit = !isLoading && !hasError;

function readLogs(options: ReadOptions): LogReadResult;
function sanitizePrompts(prompts: string[]): SanitizeResult;
```

### Types and Interfaces

Use `PascalCase`:

```typescript
type AnalysisResult = { ... };
type ProviderType = 'ollama' | 'anthropic' | 'google';
type ClaudeMessage = { ... };
```

### Constants

Use `UPPER_SNAKE_CASE` for true constants:

```typescript
const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const MAX_PATTERNS = 5;
const DEFAULT_TIMEOUT = 3000;
```

### Files and Folders

Use `kebab-case`:

```text
src/
├── core/
│   ├── log-reader.ts
│   ├── schema-validator.ts
│   └── analyzer.ts
├── providers/
│   ├── ollama.ts
│   └── anthropic.ts
└── utils/
    └── shell-config.ts
```

---

## Module Organization

### Export Style

Use named exports only. No default exports.

```typescript
// ✅ Good: Named exports
export function readLogs(options: ReadOptions): LogReadResult;
export function groupByDay(prompts: ExtractedPrompt[]): DayGroup[];
export type { LogReadResult, ReadOptions };

// ❌ Avoid: Default exports
export default function readLogs() {}
```

### Import Order

1. Node.js built-ins
2. External packages
3. Internal modules (relative imports)

```typescript
// 1. Node.js built-ins
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// 2. External packages
import chalk from 'chalk';
import ora from 'ora';
import { parseISO, isWithinInterval } from 'date-fns';

// 3. Internal modules
import { type AnalysisResult, parseResponse } from './base.js';
import { getEnvConfig } from '../utils/env.js';
```

### File Extensions

Always include `.js` extension in imports (ESM requirement):

```typescript
// ✅ Good: Include .js extension
import { readLogs } from './core/log-reader.js';
import { sanitize } from './core/sanitizer.js';

// ❌ Avoid: Missing extension
import { readLogs } from './core/log-reader';
```

---

## Error Handling

### Custom Error Classes

Create specific error types:

```typescript
class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
```

### Exit Codes

Use consistent exit codes for CLI errors:

```typescript
// Define exit codes as constants
const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_NO_DATA = 2;
const EXIT_PROVIDER_UNAVAILABLE = 3;

// Use consistently
if (!prompts.length) {
  console.error('No prompts found');
  process.exit(EXIT_NO_DATA);
}
```

### Try-Catch Boundaries

Handle errors at appropriate boundaries:

```typescript
// ✅ Good: Error boundary at CLI level
async function main(): Promise<void> {
  try {
    const result = await analyzePrompts(prompts, provider);
    printReport(result);
  } catch (error) {
    if (error instanceof ProviderError) {
      spinner.fail(`Provider error: ${error.message}`);
      process.exit(EXIT_PROVIDER_UNAVAILABLE);
    }
    throw error; // Re-throw unknown errors
  }
}

// ❌ Avoid: Swallowing errors
try {
  doSomething();
} catch {
  // Silent failure
}
```

---

## CLI Output

### Use Chalk for Colors

```typescript
import chalk from 'chalk';

// Status messages
console.log(chalk.green('✅ Analysis complete'));
console.log(chalk.yellow('⚠️  Warning: Schema version unknown'));
console.log(chalk.red('❌ Error: Provider unavailable'));

// Formatting
console.log(chalk.bold('Section Title'));
console.log(chalk.dim('Supplementary info'));
console.log(chalk.cyan('💡 Tip: Add more context'));
```

### Use Ora for Spinners

```typescript
import ora from 'ora';

const spinner = ora('Analyzing prompts...').start();

try {
  const result = await longOperation();
  spinner.succeed('Analysis complete');
  return result;
} catch (error) {
  spinner.fail('Analysis failed');
  throw error;
}
```

### Avoid Plain console.log for UX

```typescript
// ✅ Good: Styled output
console.log(chalk.green(`✅ ${count} prompts analyzed`));

// ❌ Avoid: Plain output for user-facing messages
console.log('Analysis complete');
```

---

## Documentation

### JSDoc for Exported Functions

```typescript
/**
 * Reads Claude Code logs from the projects directory
 * @param options - Reading options including date range and filters
 * @returns Extracted prompts and any warnings encountered
 */
export function readLogs(options: ReadOptions): LogReadResult {
  // ...
}
```

### Self-Documenting Code

Prefer clear names over comments:

```typescript
// ✅ Good: Self-documenting
const promptsWithinDateRange = prompts.filter((p) =>
  isWithinInterval(p.timestamp, { start: dateFrom, end: dateTo }),
);

// ❌ Avoid: Comment explaining obvious code
// Filter prompts by date range
const filtered = prompts.filter((p) => isInRange(p.timestamp));
```

### Comment Only When Necessary

```typescript
// ✅ Good: Explain non-obvious logic
// Estimate tokens: ~4 characters per token (conservative for English)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ❌ Avoid: Stating the obvious
// Increment counter
count++;
```

---

## Performance Guidelines

### Chain Array Operations

```typescript
// ✅ Good: Chained operations
const result = prompts
  .filter((p) => p.length > 0)
  .map((p) => sanitize(p))
  .slice(0, MAX_PROMPTS);

// ❌ Avoid: Intermediate variables
const nonEmpty = prompts.filter((p) => p.length > 0);
const sanitized = nonEmpty.map((p) => sanitize(p));
const limited = sanitized.slice(0, MAX_PROMPTS);
```

### Use Map/Set for Lookups

```typescript
// ✅ Good: O(1) lookup
const patternMap = new Map<string, AnalysisPattern>();
if (patternMap.has(pattern.id)) {
  // ...
}

// ❌ Avoid: O(n) lookup
const patterns: AnalysisPattern[] = [];
if (patterns.some((p) => p.id === pattern.id)) {
  // ...
}
```

### Early Returns

```typescript
// ✅ Good: Early return for edge cases
function processPrompt(prompt: string): string {
  if (!prompt.trim()) return '';
  if (prompt.length > MAX_LENGTH) return truncate(prompt);

  return transform(prompt);
}

// ❌ Avoid: Deep nesting
function processPrompt(prompt: string): string {
  if (prompt.trim()) {
    if (prompt.length <= MAX_LENGTH) {
      return transform(prompt);
    } else {
      return truncate(prompt);
    }
  } else {
    return '';
  }
}
```
