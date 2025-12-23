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

### 1.3 Tech Stack

- Runtime: Node.js >= 18
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

All configuration is managed via environment variables:

### 2.1 Core Configuration

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `HYNTX_SERVICES` | Comma-separated list | - | Providers in priority order (e.g., `ollama,anthropic`) |
| `HYNTX_REMINDER` | `7d`, `14d`, `30d`, `never` | `7d` | Reminder frequency |

### 2.2 Provider-Specific Configuration

**Ollama:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HYNTX_OLLAMA_MODEL` | `llama3.2` | Model to use |
| `HYNTX_OLLAMA_HOST` | `http://localhost:11434` | Ollama server URL |

**Anthropic:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HYNTX_ANTHROPIC_MODEL` | `claude-3-5-haiku-latest` | Model to use |
| `HYNTX_ANTHROPIC_KEY` | - | API key (required) |

**Google:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HYNTX_GOOGLE_MODEL` | `gemini-2.0-flash-exp` | Model to use |
| `HYNTX_GOOGLE_KEY` | - | API key (required) |

### 2.3 Example Configurations

```bash
# Single provider (Ollama only)
export HYNTX_SERVICES=ollama
export HYNTX_OLLAMA_MODEL=llama3.2

# Multi-provider with fallback (tries Ollama first, then Anthropic)
export HYNTX_SERVICES=ollama,anthropic
export HYNTX_OLLAMA_MODEL=llama3.2
export HYNTX_ANTHROPIC_KEY=sk-ant-your-key-here

# Cloud-first with local fallback
export HYNTX_SERVICES=anthropic,ollama
export HYNTX_ANTHROPIC_KEY=sk-ant-your-key-here
export HYNTX_OLLAMA_MODEL=llama3.2
```

### 2.4 Persistent State

File `~/.hyntx-last-run`:

- Contains ISO timestamp of last execution
- Automatically updated on successful analysis completion

---

## 3. Project Structure

```text
hyntx/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── core/
│   │   ├── setup.ts          # Interactive first-run setup
│   │   ├── reminder.ts       # Reminder system
│   │   ├── log-reader.ts     # Claude Code JSONL reading
│   │   ├── schema-validator.ts # Log schema validation
│   │   ├── sanitizer.ts      # Secret redaction
│   │   ├── analyzer.ts       # Analysis orchestration + batching
│   │   └── reporter.ts       # Terminal output
│   ├── providers/
│   │   ├── base.ts           # Interface, prompts, and limits
│   │   ├── ollama.ts
│   │   ├── anthropic.ts
│   │   ├── google.ts
│   │   └── index.ts          # Factory with multi-provider support
│   ├── utils/
│   │   ├── env.ts            # Environment variables
│   │   ├── paths.ts          # System paths
│   │   ├── shell-config.ts   # Auto-update shell config
│   │   └── terminal.ts       # Colors and formatting
│   └── types/
│       └── index.ts
├── docs/
│   └── SPECS.md              # This file
├── package.json
├── tsconfig.json
└── README.md
```

---

## 4. Dependencies (package.json)

```json
{
  "name": "hyntx",
  "version": "0.1.0",
  "description": "Analyze your Claude Code prompts and improve your prompt engineering",
  "type": "module",
  "bin": {
    "hyntx": "dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts --clean",
    "dev": "tsup src/index.ts --format esm --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "chalk": "^5.3.0",
    "ora": "^8.1.1",
    "prompts": "^2.4.2",
    "date-fns": "^4.1.0",
    "glob": "^11.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/prompts": "^2.4.9",
    "tsup": "^8.3.5",
    "typescript": "^5.7.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

---

## 5. CLI Interface

### 5.1 Usage

```bash
# Analyze today's prompts (default)
hyntx

# Options
hyntx --date yesterday
hyntx --date 2025-01-20
hyntx --from 2025-01-20 --to 2025-01-23
hyntx --project my-project
hyntx --output report.md
hyntx --verbose
hyntx --dry-run

# Internal flag for reminders (used in .zshrc)
hyntx --check-reminder
```

### 5.2 Flags

| Flag | Description |
|------|-------------|
| `--date <date>` | Date to analyze (`today`, `yesterday`, `YYYY-MM-DD`) |
| `--from <date>` | Range start date |
| `--to <date>` | Range end date |
| `--project <name>` | Filter by project name |
| `--output <path>` | Save report (`.md` or `.json`) |
| `--verbose` | Debug information |
| `--dry-run` | Show what would be sent without sending |
| `--check-reminder` | Check if reminder is due (for .zshrc) |

### 5.3 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | No logs found |
| 3 | All providers unavailable |

---

## 6. TypeScript Types (src/types/index.ts)

```typescript
// Claude Code JSONL
export interface ClaudeMessage {
  type: 'user' | 'assistant' | 'summary' | 'system';
  message: {
    role: string;
    content: string | Array<{ type: string; text?: string }>;
  };
  timestamp: string;
  sessionId: string;
  cwd: string;
}

// Extracted data
export interface ExtractedPrompt {
  content: string;
  timestamp: Date;
  sessionId: string;
  projectName: string;
}

export interface DayGroup {
  date: string;
  prompts: ExtractedPrompt[];
  projectNames: string[];
}

// Before/After rewrite example
export interface BeforeAfter {
  before: string;
  after: string;
}

// Analysis
export interface AnalysisPattern {
  id: string;
  name: string;
  frequency: number; // 0-1
  severity: 'low' | 'medium' | 'high';
  examples: string[];
  suggestion: string;
  beforeAfter?: BeforeAfter; // Concrete rewrite example
}

export interface AnalysisResult {
  patterns: AnalysisPattern[];
  stats: {
    totalPrompts: number;
    promptsWithIssues: number;
    overallScore: number; // 1-10
  };
  topSuggestion: string;
}

// Provider
export interface AnalysisProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompts: string[], date: string): Promise<AnalysisResult>;
}

// Provider limits for batching
export interface ProviderLimits {
  maxTokensPerBatch: number;
  prioritization: 'longest-first' | 'chronological';
}

// Supported provider types
export type ProviderType = 'ollama' | 'anthropic' | 'google';

// Provider-specific config
export interface OllamaConfig {
  model: string;
  host: string;
}

export interface AnthropicConfig {
  model: string;
  apiKey: string;
}

export interface GoogleConfig {
  model: string;
  apiKey: string;
}

// Config from env
export interface EnvConfig {
  services: ProviderType[];
  ollama: OllamaConfig;
  anthropic: AnthropicConfig;
  google: GoogleConfig;
  reminder: '7d' | '14d' | '30d' | 'never';
}

// Schema validation
export interface SchemaVersion {
  major: number;
  minor: number;
}

export interface LogReadResult {
  prompts: ExtractedPrompt[];
  warnings: string[];
}

// Shell config update result
export interface ShellConfigResult {
  success: boolean;
  shellFile?: string;
  error?: string;
}
```

---

## 7. Shell Config Auto-Update (src/utils/shell-config.ts)

Automatically updates user's shell configuration file with environment variables.

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { ShellConfigResult, ProviderType } from '../types/index.js';

const HYNTX_BLOCK_START = '# >>> hyntx config >>>';
const HYNTX_BLOCK_END = '# <<< hyntx config <<<';

/**
 * Detects the user's shell configuration file
 */
export function detectShellConfigFile(): string | null {
  const home = homedir();
  const shell = process.env.SHELL || '';

  // Priority order for detection
  const candidates: string[] = [];

  if (shell.includes('zsh')) {
    candidates.push('.zshrc', '.zprofile');
  } else if (shell.includes('bash')) {
    candidates.push('.bashrc', '.bash_profile', '.profile');
  } else {
    // Generic fallback
    candidates.push('.zshrc', '.bashrc', '.profile');
  }

  for (const file of candidates) {
    const path = join(home, file);
    if (existsSync(path)) {
      return path;
    }
  }

  // If no existing file found, create default based on shell
  if (shell.includes('zsh')) {
    return join(home, '.zshrc');
  }
  return join(home, '.bashrc');
}

/**
 * Generates environment variable export lines
 */
export function generateEnvExports(config: {
  services: ProviderType[];
  ollamaModel?: string;
  ollamaHost?: string;
  anthropicKey?: string;
  anthropicModel?: string;
  googleKey?: string;
  googleModel?: string;
  reminder?: string;
}): string {
  const lines: string[] = [HYNTX_BLOCK_START];

  // Services (required)
  lines.push(`export HYNTX_SERVICES=${config.services.join(',')}`);

  // Ollama config
  if (config.services.includes('ollama')) {
    if (config.ollamaModel && config.ollamaModel !== 'llama3.2') {
      lines.push(`export HYNTX_OLLAMA_MODEL=${config.ollamaModel}`);
    }
    if (config.ollamaHost && config.ollamaHost !== 'http://localhost:11434') {
      lines.push(`export HYNTX_OLLAMA_HOST=${config.ollamaHost}`);
    }
  }

  // Anthropic config
  if (config.services.includes('anthropic')) {
    if (config.anthropicKey) {
      lines.push(`export HYNTX_ANTHROPIC_KEY="${config.anthropicKey}"`);
    }
    if (config.anthropicModel && config.anthropicModel !== 'claude-3-5-haiku-latest') {
      lines.push(`export HYNTX_ANTHROPIC_MODEL=${config.anthropicModel}`);
    }
  }

  // Google config
  if (config.services.includes('google')) {
    if (config.googleKey) {
      lines.push(`export HYNTX_GOOGLE_KEY="${config.googleKey}"`);
    }
    if (config.googleModel && config.googleModel !== 'gemini-2.0-flash-exp') {
      lines.push(`export HYNTX_GOOGLE_MODEL=${config.googleModel}`);
    }
  }

  // Reminder (only if not default)
  if (config.reminder && config.reminder !== '7d') {
    lines.push(`export HYNTX_REMINDER=${config.reminder}`);
  }

  // Add reminder hook suggestion as comment
  lines.push('');
  lines.push('# Uncomment to enable periodic reminders:');
  lines.push('# hyntx --check-reminder 2>/dev/null');

  lines.push(HYNTX_BLOCK_END);

  return lines.join('\n');
}

/**
 * Updates or creates hyntx config block in shell file
 */
export function updateShellConfig(
  shellFile: string,
  envExports: string
): ShellConfigResult {
  try {
    let content = '';

    if (existsSync(shellFile)) {
      content = readFileSync(shellFile, 'utf-8');
    }

    // Check if hyntx block already exists
    const startIdx = content.indexOf(HYNTX_BLOCK_START);
    const endIdx = content.indexOf(HYNTX_BLOCK_END);

    if (startIdx !== -1 && endIdx !== -1) {
      // Replace existing block
      const before = content.slice(0, startIdx);
      const after = content.slice(endIdx + HYNTX_BLOCK_END.length);
      content = before + envExports + after;
    } else {
      // Append new block
      const separator = content.endsWith('\n') ? '\n' : '\n\n';
      content = content + separator + envExports + '\n';
    }

    writeFileSync(shellFile, content, 'utf-8');

    return { success: true, shellFile };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main function to save configuration to shell
 */
export function saveConfigToShell(config: {
  services: ProviderType[];
  ollamaModel?: string;
  ollamaHost?: string;
  anthropicKey?: string;
  anthropicModel?: string;
  googleKey?: string;
  googleModel?: string;
  reminder?: string;
}): ShellConfigResult {
  const shellFile = detectShellConfigFile();

  if (!shellFile) {
    return {
      success: false,
      error: 'Could not detect shell configuration file',
    };
  }

  const envExports = generateEnvExports(config);
  return updateShellConfig(shellFile, envExports);
}

/**
 * Generates manual instructions for the user
 */
export function getManualInstructions(config: {
  services: ProviderType[];
  ollamaModel?: string;
  ollamaHost?: string;
  anthropicKey?: string;
  anthropicModel?: string;
  googleKey?: string;
  googleModel?: string;
  reminder?: string;
}): string {
  const lines: string[] = [];

  lines.push(`export HYNTX_SERVICES=${config.services.join(',')}`);

  if (config.services.includes('ollama')) {
    if (config.ollamaModel) {
      lines.push(`export HYNTX_OLLAMA_MODEL=${config.ollamaModel}`);
    }
  }

  if (config.services.includes('anthropic') && config.anthropicKey) {
    lines.push(`export HYNTX_ANTHROPIC_KEY="${config.anthropicKey}"`);
  }

  if (config.services.includes('google') && config.googleKey) {
    lines.push(`export HYNTX_GOOGLE_KEY="${config.googleKey}"`);
  }

  if (config.reminder && config.reminder !== '7d') {
    lines.push(`export HYNTX_REMINDER=${config.reminder}`);
  }

  lines.push('');
  lines.push('# Reminder on terminal open (optional):');
  lines.push('hyntx --check-reminder 2>/dev/null');

  return lines.join('\n');
}
```

---

## 8. Interactive Setup (src/core/setup.ts)

```typescript
import prompts from 'prompts';
import chalk from 'chalk';
import type { ProviderType } from '../types/index.js';
import {
  saveConfigToShell,
  getManualInstructions,
  detectShellConfigFile,
} from '../utils/shell-config.js';

interface SetupConfig {
  services: ProviderType[];
  ollamaModel?: string;
  ollamaHost?: string;
  anthropicKey?: string;
  anthropicModel?: string;
  googleKey?: string;
  googleModel?: string;
  reminder?: string;
}

export async function runSetup(): Promise<void> {
  console.log(chalk.cyan('\n👋 Welcome to Hyntx!\n'));

  const config: SetupConfig = {
    services: [],
  };

  // 1. Select providers (multi-select)
  const { services } = await prompts({
    type: 'multiselect',
    name: 'services',
    message: 'Select providers (space to select, enter to confirm):',
    choices: [
      { title: 'ollama (local - requires Ollama installed)', value: 'ollama', selected: true },
      { title: 'anthropic (Claude Haiku - requires API key)', value: 'anthropic' },
      { title: 'google (Gemini Flash - requires API key)', value: 'google' },
    ],
    min: 1,
    hint: '- Space to select, Enter to confirm',
  });

  if (!services || services.length === 0) {
    console.log(chalk.yellow('No providers selected. Defaulting to Ollama.'));
    config.services = ['ollama'];
  } else {
    config.services = services as ProviderType[];
  }

  // 2. Configure each selected provider
  for (const service of config.services) {
    if (service === 'ollama') {
      const { model } = await prompts({
        type: 'text',
        name: 'model',
        message: 'Ollama model:',
        initial: 'llama3.2',
      });
      config.ollamaModel = model || 'llama3.2';
    } else if (service === 'anthropic') {
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'Anthropic API key:',
      });
      config.anthropicKey = key;
      config.anthropicModel = 'claude-3-5-haiku-latest';
    } else if (service === 'google') {
      const { key } = await prompts({
        type: 'password',
        name: 'key',
        message: 'Google API key:',
      });
      config.googleKey = key;
      config.googleModel = 'gemini-2.0-flash-exp';
    }
  }

  // 3. Reminders
  const { reminder } = await prompts({
    type: 'select',
    name: 'reminder',
    message: 'Periodic reminders?',
    choices: [
      { title: 'Every 7 days', value: '7d' },
      { title: 'Every 14 days', value: '14d' },
      { title: 'Every 30 days', value: '30d' },
      { title: 'Never', value: 'never' },
    ],
  });
  config.reminder = reminder;

  console.log(chalk.green('\n✅ Setup complete!\n'));

  // 4. Attempt auto-save to shell config
  const shellFile = detectShellConfigFile();
  const shellFileName = shellFile?.split('/').pop() || 'shell config';

  const { autoSave } = await prompts({
    type: 'confirm',
    name: 'autoSave',
    message: `Save configuration to ~/${shellFileName}?`,
    initial: true,
  });

  if (autoSave) {
    const result = saveConfigToShell(config);

    if (result.success) {
      console.log(chalk.green(`\n✅ Configuration saved to ${result.shellFile}`));
      console.log(chalk.dim(`   Run 'source ~/${shellFileName}' or open a new terminal to apply.\n`));
    } else {
      // Fallback: show manual instructions
      console.log(chalk.yellow(`\n⚠️  Could not auto-save: ${result.error}`));
      showManualInstructions(config);
    }
  } else {
    // User declined: show manual instructions
    showManualInstructions(config);
  }

  // 5. Set environment for current session
  process.env.HYNTX_SERVICES = config.services.join(',');

  if (config.ollamaModel) {
    process.env.HYNTX_OLLAMA_MODEL = config.ollamaModel;
  }
  if (config.anthropicKey) {
    process.env.HYNTX_ANTHROPIC_KEY = config.anthropicKey;
  }
  if (config.googleKey) {
    process.env.HYNTX_GOOGLE_KEY = config.googleKey;
  }
  if (config.reminder) {
    process.env.HYNTX_REMINDER = config.reminder;
  }
}

function showManualInstructions(config: SetupConfig): void {
  console.log(chalk.dim('\nAdd this to your ~/.zshrc or ~/.bashrc:\n'));
  console.log(chalk.yellow(getManualInstructions(config)));
  console.log('');
}
```

---

## 9. Reminder System (src/core/reminder.ts)

```typescript
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { differenceInDays } from 'date-fns';
import prompts from 'prompts';
import chalk from 'chalk';
import { getEnvConfig } from '../utils/env.js';

const LAST_RUN_FILE = join(homedir(), '.hyntx-last-run');

export function getLastRun(): Date | null {
  if (!existsSync(LAST_RUN_FILE)) return null;
  try {
    return new Date(readFileSync(LAST_RUN_FILE, 'utf-8').trim());
  } catch {
    return null;
  }
}

export function saveLastRun(): void {
  writeFileSync(LAST_RUN_FILE, new Date().toISOString());
}

export async function checkReminder(): Promise<boolean> {
  const config = getEnvConfig();

  // Disabled
  if (config.reminder === 'never') {
    process.exit(0);
  }

  const lastRun = getLastRun();
  const now = new Date();

  // First time
  if (!lastRun) {
    return await showReminder('You have never analyzed your prompts.');
  }

  const daysSinceRun = differenceInDays(now, lastRun);
  
  // Extract number of days from reminder config (e.g., "7d" -> 7)
  const reminderDaysMatch = config.reminder.match(/^(\d+)d$/);
  if (!reminderDaysMatch) {
    // Should not happen if config is valid, but handle gracefully
    return await showReminder(`Reminder configuration error. Please check HYNTX_REMINDER.`);
  }
  const reminderDays = parseInt(reminderDaysMatch[1], 10);

  if (daysSinceRun >= reminderDays) {
    return await showReminder(`It's been ${daysSinceRun} days since your last analysis.`);
  }

  process.exit(0);
}

async function showReminder(message: string): Promise<boolean> {
  console.log(chalk.cyan(`\n[hyntx] ${message}`));

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'Want to review your prompt quality?',
    choices: [
      { title: 'Yes, analyze now', value: 'yes' },
      { title: 'No, remind me later', value: 'no' },
      { title: 'Disable reminders', value: 'never' },
    ],
  });

  if (action === 'yes') {
    return true; // Continue with analysis
  }

  if (action === 'never') {
    console.log(chalk.yellow('\nTo disable, add to your shell:'));
    console.log(chalk.yellow('export HYNTX_REMINDER=never\n'));
  }

  process.exit(0);
}
```

---

## 10. Schema Validator (src/core/schema-validator.ts)

Validates Claude Code JSONL schema for compatibility and graceful degradation.

```typescript
import type { SchemaVersion } from '../types/index.js';

const SUPPORTED_SCHEMAS: SchemaVersion[] = [
  { major: 1, minor: 0 }, // Current known schema
];

/**
 * Detects schema version from message structure (heuristic)
 */
export function detectSchemaVersion(message: unknown): SchemaVersion | null {
  if (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    'message' in message &&
    'timestamp' in message
  ) {
    return { major: 1, minor: 0 }; // Current schema
  }
  return null;
}

/**
 * Checks if detected schema is supported
 */
export function isSchemaSupported(version: SchemaVersion | null): boolean {
  if (!version) return false;
  return SUPPORTED_SCHEMAS.some(
    s => s.major === version.major && s.minor === version.minor
  );
}

/**
 * Returns user-friendly error message for schema issues
 */
export function getSchemaWarning(version: SchemaVersion | null): string {
  if (!version) {
    return 'Unknown Claude Code log format. The log structure may have changed. Analysis may be incomplete.';
  }
  return `Unsupported Claude Code schema v${version.major}.${version.minor}. Consider updating Hyntx.`;
}
```

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

```typescript
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { glob } from 'glob';
import { startOfDay, endOfDay, parseISO, isWithinInterval, subDays, isValid } from 'date-fns';
import type { ClaudeMessage, ExtractedPrompt, LogReadResult } from '../types/index.js';
import { detectSchemaVersion, isSchemaSupported, getSchemaWarning } from './schema-validator.js';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');

export function claudeProjectsExist(): boolean {
  return existsSync(PROJECTS_DIR);
}

export function parseDate(dateStr: string): Date {
  if (dateStr === 'today') return new Date();
  if (dateStr === 'yesterday') return subDays(new Date(), 1);
  const date = parseISO(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateStr}. Expected 'today', 'yesterday', or ISO date (YYYY-MM-DD).`);
  }
  return date;
}

export function readLogs(options: {
  date?: string;
  from?: string;
  to?: string;
  project?: string;
  verbose?: boolean;
}): LogReadResult {
  // Determine date range
  let dateFrom: Date, dateTo: Date;

  try {
    if (options.from && options.to) {
      dateFrom = startOfDay(parseDate(options.from));
      dateTo = endOfDay(parseDate(options.to));
      
      // Validate range
      if (dateFrom > dateTo) {
        throw new Error(`Invalid date range: --from (${options.from}) must be before --to (${options.to})`);
      }
    } else {
      const date = parseDate(options.date || 'today');
      dateFrom = startOfDay(date);
      dateTo = endOfDay(date);
    }
  } catch (error) {
    // Re-throw date parsing errors
    if (error instanceof Error && error.message.includes('Invalid date')) {
      throw error;
    }
    throw new Error(`Failed to parse date range: ${error instanceof Error ? error.message : String(error)}`);
  }

  const prompts: ExtractedPrompt[] = [];
  const warnings: string[] = [];
  let schemaChecked = false;

  // List projects
  const projectDirs = readdirSync(PROJECTS_DIR).filter(name => {
    const path = join(PROJECTS_DIR, name);
    if (!statSync(path).isDirectory()) return false;
    if (options.project && !name.includes(options.project)) return false;
    return true;
  });

  for (const projectDir of projectDirs) {
    const projectPath = join(PROJECTS_DIR, projectDir);
    const projectName = projectDir.replace(/^-/, '').replace(/-/g, '/');

    // Read all JSONL files
    const files = glob.sync('*.jsonl', { cwd: projectPath });

    for (const file of files) {
      const content = readFileSync(join(projectPath, file), 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const msg: ClaudeMessage = JSON.parse(line);

          // Check schema version (once per run)
          if (!schemaChecked) {
            const version = detectSchemaVersion(msg);
            if (!isSchemaSupported(version)) {
              warnings.push(getSchemaWarning(version));
            }
            schemaChecked = true;
          }

          // Only user messages
          if (msg.type !== 'user') continue;

          const timestamp = parseISO(msg.timestamp);
          
          // Validate timestamp
          if (!isValid(timestamp)) {
            if (options.verbose) {
              warnings.push(`Skipping message with invalid timestamp: ${msg.timestamp}`);
            }
            continue;
          }

          // Check range
          if (!isWithinInterval(timestamp, { start: dateFrom, end: dateTo })) {
            continue;
          }

          // Extract content
          let content: string;
          if (typeof msg.message.content === 'string') {
            content = msg.message.content;
          } else {
            content = msg.message.content
              .filter(b => b.type === 'text' && b.text)
              .map(b => b.text!)
              .join('\n');
          }

          if (content) {
            prompts.push({
              content,
              timestamp,
              sessionId: msg.sessionId,
              projectName,
            });
          }
        } catch (error) {
          // Log parse errors in verbose mode
          if (options.verbose) {
            console.warn(`Skipping malformed line: ${error instanceof Error ? error.message : 'Parse error'}`);
          }
        }
      }
    }
  }

  return {
    prompts: prompts.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    warnings,
  };
}

export function groupByDay(prompts: ExtractedPrompt[]): import('../types/index.js').DayGroup[] {
  const groups = new Map<string, import('../types/index.js').DayGroup>();

  for (const prompt of prompts) {
    const date = prompt.timestamp.toISOString().split('T')[0];

    if (!groups.has(date)) {
      groups.set(date, { date, prompts: [], projectNames: [] });
    }

    const group = groups.get(date)!;
    group.prompts.push(prompt);

    if (!group.projectNames.includes(prompt.projectName)) {
      group.projectNames.push(prompt.projectName);
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date));
}
```

---

## 12. Sanitizer (src/core/sanitizer.ts)

```typescript
const PATTERNS = [
  { regex: /\b(sk-[a-zA-Z0-9]{20,})\b/g, replacement: '[REDACTED_KEY]' },
  { regex: /\b(sk-ant-[a-zA-Z0-9-]{20,})\b/g, replacement: '[REDACTED_KEY]' },
  { regex: /\b(AKIA[0-9A-Z]{16})\b/g, replacement: '[REDACTED_AWS]' },
  { regex: /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, replacement: 'Bearer [REDACTED]' },
  { regex: /(https?:\/\/)([^:]+):([^@]+)@/g, replacement: '$1[REDACTED]@' },
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[REDACTED_EMAIL]' },
  { regex: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g, replacement: '[REDACTED_KEY]' },
];

export function sanitize(text: string): { text: string; redacted: number } {
  let result = text;
  let count = 0;

  for (const { regex, replacement } of PATTERNS) {
    const matches = result.match(regex);
    if (matches) count += matches.length;
    result = result.replace(regex, replacement);
  }

  return { text: result, redacted: count };
}

export function sanitizePrompts(prompts: string[]): { prompts: string[]; totalRedacted: number } {
  let total = 0;
  const sanitized = prompts.map(p => {
    const { text, redacted } = sanitize(p);
    total += redacted;
    return text;
  });
  return { prompts: sanitized, totalRedacted: total };
}
```

---

## 13. Analyzer with Batching (src/core/analyzer.ts)

Handles context window limitations with smart batching (Map-Reduce approach).

```typescript
import type { AnalysisResult, AnalysisPattern, AnalysisProvider, ProviderLimits } from '../types/index.js';
import { PROVIDER_LIMITS } from '../providers/base.js';

/**
 * Estimates token count (rough: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Batches prompts to fit within context window limits
 */
export function batchPrompts(
  prompts: string[],
  limits: ProviderLimits
): string[][] {
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentTokens = 0;

  // Sort based on prioritization strategy
  const sorted = [...prompts];
  if (limits.prioritization === 'longest-first') {
    sorted.sort((a, b) => b.length - a.length);
  }

  for (const prompt of sorted) {
    const tokens = estimateTokens(prompt);

    // Handle edge case: prompt exceeds batch limit
    if (tokens > limits.maxTokensPerBatch) {
      // Log warning if batch already exists (we'll process oversized prompt in its own batch)
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentTokens = 0;
      }
      // Create single-prompt batch for oversized prompt
      batches.push([prompt]);
      continue;
    }

    if (currentTokens + tokens > limits.maxTokensPerBatch && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }

    currentBatch.push(prompt);
    currentTokens += tokens;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

/**
 * Merges results from multiple batches (reduce phase)
 */
function mergeBatchResults(
  results: AnalysisResult[],
  totalPrompts: number
): AnalysisResult {
  const allPatterns = results.flatMap(r => r.patterns);

  // Deduplicate patterns by ID and merge
  const patternMap = new Map<string, AnalysisPattern>();

  for (const pattern of allPatterns) {
    if (!patternMap.has(pattern.id)) {
      patternMap.set(pattern.id, { ...pattern });
    } else {
      const existing = patternMap.get(pattern.id)!;
      // Merge examples (unique, max 3)
      existing.examples = [...new Set([...existing.examples, ...pattern.examples])].slice(0, 3);
      // Average frequency
      existing.frequency = (existing.frequency + pattern.frequency) / 2;
      // Take highest severity
      if (pattern.severity === 'high') existing.severity = 'high';
      else if (pattern.severity === 'medium' && existing.severity === 'low') {
        existing.severity = 'medium';
      }
      // Keep first beforeAfter if exists
      if (!existing.beforeAfter && pattern.beforeAfter) {
        existing.beforeAfter = pattern.beforeAfter;
      }
    }
  }

  const patterns = Array.from(patternMap.values())
    .sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    })
    .slice(0, 5);

  const avgScore = results.reduce((sum, r) => sum + r.stats.overallScore, 0) / results.length;

  return {
    patterns,
    stats: {
      totalPrompts,
      promptsWithIssues: Math.round(
        results.reduce((sum, r) => sum + r.stats.promptsWithIssues, 0)
      ),
      overallScore: Math.round(avgScore * 10) / 10,
    },
    topSuggestion: results[0]?.topSuggestion || 'No suggestions.',
  };
}

/**
 * Main analysis function with automatic batching
 */
export async function analyzePrompts(
  prompts: string[],
  provider: AnalysisProvider,
  date: string,
  onProgress?: (batch: number, total: number) => void
): Promise<AnalysisResult> {
  const limits = PROVIDER_LIMITS[provider.name as keyof typeof PROVIDER_LIMITS] || PROVIDER_LIMITS.ollama;
  const batches = batchPrompts(prompts, limits);

  if (batches.length === 1) {
    // Single batch - direct analysis
    return await provider.analyze(batches[0], date);
  }

  // Multi-batch - Map-Reduce approach
  const batchResults: AnalysisResult[] = [];

  for (let i = 0; i < batches.length; i++) {
    onProgress?.(i + 1, batches.length);
    const result = await provider.analyze(
      batches[i],
      `${date} (batch ${i + 1}/${batches.length})`
    );
    batchResults.push(result);
  }

  // Merge results
  return mergeBatchResults(batchResults, prompts.length);
}
```

---

## 14. Providers

### 14.1 Base (src/providers/base.ts)

```typescript
import type { AnalysisResult, ProviderLimits } from '../types/index.js';

export interface AnalysisProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompts: string[], date: string): Promise<AnalysisResult>;
}

/**
 * Provider-specific context window limits
 */
export const PROVIDER_LIMITS: Record<string, ProviderLimits> = {
  ollama: {
    maxTokensPerBatch: 30000, // Conservative for llama3.2 (128k context)
    prioritization: 'longest-first',
  },
  anthropic: {
    maxTokensPerBatch: 100000, // Haiku has 200k context
    prioritization: 'chronological',
  },
  google: {
    maxTokensPerBatch: 500000, // Gemini Flash has 1M context
    prioritization: 'chronological',
  },
};

/**
 * Enhanced system prompt with Before/After requirement
 */
export const SYSTEM_PROMPT = `You are an expert in Prompt Engineering for programming LLMs (like Claude Code).

Analyze the prompts and detect COMMON improvement PATTERNS (do not analyze individually).

CRITERIA:
1. Missing technical context (versions, frameworks, error messages)
2. Vague or ambiguous instructions
3. Absence of success criteria or expected outcomes
4. Very short prompts lacking necessary detail
5. Missing current vs desired state context

IMPORTANT: For each pattern, provide a CONCRETE "Before → After" rewrite example using the user's actual prompts.

RESPOND ONLY JSON:
{
  "patterns": [
    {
      "id": "missing_context",
      "name": "Missing Technical Context",
      "frequency": 0.68,
      "severity": "medium",
      "examples": ["fix auth bug", "update component", "refactor this"],
      "suggestion": "Include specific error messages, framework versions, and file paths",
      "beforeAfter": {
        "before": "fix auth bug",
        "after": "Fix authentication bug in src/auth/login.ts where users get 'Invalid token' error after successful login. Using Next.js 14.1.0 with next-auth 4.24.5. Error occurs on line 42 when validating JWT tokens."
      }
    }
  ],
  "stats": {
    "totalPrompts": 23,
    "promptsWithIssues": 15,
    "overallScore": 7.2
  },
  "topSuggestion": "Add error messages and stack traces to debugging requests for 10x faster resolution"
}

RULES:
- Maximum 5 patterns
- Maximum 3 examples per pattern (literal from input)
- Each pattern MUST include a "beforeAfter" object with realistic rewrites
- "before" should be taken from actual user prompts
- "after" should be a concrete, specific rewrite that addresses the pattern
- frequency: 0-1 (percentage of prompts with this issue)
- severity: low|medium|high
- overallScore: 1-10
- If everything is excellent: patterns=[], high overallScore`;

export function buildUserPrompt(prompts: string[], date: string): string {
  const list = prompts.map((p, i) => `${i + 1}. ${p}`).join('\n---\n');
  return `Prompts from ${date} (${prompts.length} total):\n---\n${list}\n---\nRespond ONLY JSON.`;
}

export function parseResponse(text: string): AnalysisResult {
  let json = text.trim();

  // Clean markdown
  if (json.startsWith('```')) {
    json = json.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const data = JSON.parse(json);
    return {
      patterns: (data.patterns || []).slice(0, 5).map((p: any) => ({
        id: p.id || 'unknown',
        name: p.name || 'Pattern',
        frequency: p.frequency || 0.5,
        severity: ['low', 'medium', 'high'].includes(p.severity) ? p.severity : 'medium',
        examples: (p.examples || []).slice(0, 3),
        suggestion: p.suggestion || '',
        beforeAfter: p.beforeAfter ? {
          before: p.beforeAfter.before || '',
          after: p.beforeAfter.after || '',
        } : undefined,
      })),
      stats: {
        totalPrompts: data.stats?.totalPrompts || 0,
        promptsWithIssues: data.stats?.promptsWithIssues || 0,
        overallScore: data.stats?.overallScore || 5,
      },
      topSuggestion: data.topSuggestion || 'No suggestions.',
    };
  } catch {
    return {
      patterns: [],
      stats: { totalPrompts: 0, promptsWithIssues: 0, overallScore: 5 },
      topSuggestion: 'Error parsing model response.',
    };
  }
}
```

### 14.2 Ollama (src/providers/ollama.ts)

```typescript
import type { AnalysisResult } from '../types/index.js';
import { AnalysisProvider, SYSTEM_PROMPT, buildUserPrompt, parseResponse } from './base.js';

export class OllamaProvider implements AnalysisProvider {
  name = 'ollama';

  constructor(
    private host: string,
    private model: string
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.host}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!res.ok) return false;

      const data = await res.json();
      return data.models?.some((m: any) =>
        m.name === this.model || m.name.startsWith(`${this.model}:`)
      );
    } catch {
      return false;
    }
  }

  async analyze(prompts: string[], date: string): Promise<AnalysisResult> {
    const res = await fetch(`${this.host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(prompts, date)}`,
        stream: false,
        format: 'json',
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${await res.text()}`);

    const data = await res.json();
    const result = parseResponse(data.response);
    result.stats.totalPrompts = prompts.length;
    return result;
  }
}
```

### 14.3 Anthropic (src/providers/anthropic.ts)

```typescript
import type { AnalysisResult } from '../types/index.js';
import { AnalysisProvider, SYSTEM_PROMPT, buildUserPrompt, parseResponse } from './base.js';

export class AnthropicProvider implements AnalysisProvider {
  name = 'anthropic';

  constructor(
    private apiKey: string,
    private model: string = 'claude-3-5-haiku-latest'
  ) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey && this.apiKey.startsWith('sk-ant-');
  }

  async analyze(prompts: string[], date: string): Promise<AnalysisResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(prompts, date) }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);

    const data = await res.json();
    const text = data.content?.find((b: any) => b.type === 'text')?.text || '';

    const result = parseResponse(text);
    result.stats.totalPrompts = prompts.length;
    return result;
  }
}
```

### 14.4 Google (src/providers/google.ts)

```typescript
import type { AnalysisResult } from '../types/index.js';
import { AnalysisProvider, SYSTEM_PROMPT, buildUserPrompt, parseResponse } from './base.js';

export class GoogleProvider implements AnalysisProvider {
  name = 'google';

  constructor(
    private apiKey: string,
    private model: string = 'gemini-2.0-flash-exp'
  ) {}

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async analyze(prompts: string[], date: string): Promise<AnalysisResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(prompts, date)}` }]
        }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });

    if (!res.ok) throw new Error(`Google error: ${await res.text()}`);

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const result = parseResponse(text);
    result.stats.totalPrompts = prompts.length;
    return result;
  }
}
```

### 14.5 Factory with Multi-Provider Support (src/providers/index.ts)

```typescript
import type { EnvConfig, AnalysisProvider, ProviderType } from '../types/index.js';
import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';

/**
 * Creates a provider instance for a specific type
 */
function createProvider(type: ProviderType, config: EnvConfig): AnalysisProvider {
  switch (type) {
    case 'ollama':
      return new OllamaProvider(config.ollama.host, config.ollama.model);
    case 'anthropic':
      return new AnthropicProvider(config.anthropic.apiKey, config.anthropic.model);
    case 'google':
      return new GoogleProvider(config.google.apiKey, config.google.model);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

/**
 * Gets the first available provider from the configured services list
 * @param config Environment configuration
 * @param onFallback Callback when falling back to next provider
 * @returns Available provider or throws if none available
 */
export async function getAvailableProvider(
  config: EnvConfig,
  onFallback?: (from: ProviderType, to: ProviderType) => void
): Promise<AnalysisProvider> {
  const services = config.services;

  if (services.length === 0) {
    throw new Error('No providers configured. Set HYNTX_SERVICES environment variable.');
  }

  for (let i = 0; i < services.length; i++) {
    const type = services[i];
    const provider = createProvider(type, config);

    try {
      const available = await provider.isAvailable();
      if (available) {
        return provider;
      }
    } catch {
      // Provider check failed, try next
    }

    // Notify about fallback (if not the last one)
    if (i < services.length - 1 && onFallback) {
      onFallback(type, services[i + 1]);
    }
  }

  throw new Error(
    `All providers unavailable: ${services.join(', ')}. ` +
    'Check your configuration and ensure at least one provider is accessible.'
  );
}

/**
 * Gets all configured providers (for dry-run or listing)
 */
export function getAllProviders(config: EnvConfig): AnalysisProvider[] {
  return config.services.map(type => createProvider(type, config));
}
```

---

## 15. Reporter (src/core/reporter.ts)

Enhanced with Before/After display.

```typescript
import chalk from 'chalk';
import type { AnalysisResult } from '../types/index.js';

function severityIcon(s: string): string {
  return s === 'high' ? '🔴' : s === 'medium' ? '🟡' : '🟢';
}

function scoreColor(score: number): string {
  const text = `${score.toFixed(1)}/10`;
  if (score >= 8) return chalk.green(text + ' ✨');
  if (score >= 6) return chalk.yellow(text);
  return chalk.red(text);
}

export function printReport(result: AnalysisResult, date: string, projects: string[]): void {
  console.log('\n' + chalk.bold(`📊 Hyntx - ${date}`));
  console.log('─'.repeat(50));

  console.log(`\n${chalk.bold('📈 Statistics')}`);
  console.log(`   Prompts: ${result.stats.totalPrompts}`);
  console.log(`   Projects: ${projects.join(', ') || '-'}`);
  console.log(`   Score: ${scoreColor(result.stats.overallScore)}`);

  if (result.patterns.length > 0) {
    console.log(`\n${chalk.bold(`⚠️  Patterns (${result.patterns.length})`)}\n`);

    for (const p of result.patterns) {
      const pct = Math.round(p.frequency * 100);
      console.log(`${severityIcon(p.severity)} ${chalk.bold(p.name)} (${pct}%)`);

      for (const ex of p.examples) {
        const short = ex.length > 50 ? ex.slice(0, 47) + '...' : ex;
        console.log(chalk.dim(`   • "${short}"`));
      }

      console.log(chalk.cyan(`   💡 ${p.suggestion}`));

      // Display Before/After example if available
      if (p.beforeAfter) {
        console.log('');
        console.log(chalk.gray('   Before:'));
        const beforeShort = p.beforeAfter.before.length > 60
          ? p.beforeAfter.before.slice(0, 57) + '...'
          : p.beforeAfter.before;
        console.log(chalk.red(`   ❌ "${beforeShort}"`));

        console.log(chalk.gray('   After:'));
        const afterLines = p.beforeAfter.after.split('\n');
        if (afterLines.length === 1 && p.beforeAfter.after.length <= 80) {
          console.log(chalk.green(`   ✅ "${p.beforeAfter.after}"`));
        } else {
          console.log(chalk.green(`   ✅ "${afterLines[0]}..."`));
        }
      }

      console.log('');
    }
  } else {
    console.log(chalk.green('\n✅ No improvement patterns detected!'));
  }

  console.log('─'.repeat(50));
  console.log(chalk.bold('💎 Top Suggestion'));
  console.log(chalk.italic(`   "${result.topSuggestion}"`));
  console.log('─'.repeat(50) + '\n');
}

export function formatMarkdown(result: AnalysisResult, date: string, projects: string[]): string {
  let md = `# Hyntx Analysis - ${date}\n\n`;
  md += `## Statistics\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Prompts | ${result.stats.totalPrompts} |\n`;
  md += `| Projects | ${projects.join(', ') || '-'} |\n`;
  md += `| Score | ${result.stats.overallScore.toFixed(1)}/10 |\n\n`;

  if (result.patterns.length > 0) {
    md += `## Patterns\n\n`;
    for (const p of result.patterns) {
      const icon = p.severity === 'high' ? '🔴' : p.severity === 'medium' ? '🟡' : '🟢';
      md += `### ${icon} ${p.name} (${Math.round(p.frequency * 100)}%)\n\n`;

      md += `**Examples:**\n`;
      for (const ex of p.examples) md += `- "${ex}"\n`;
      md += `\n**Suggestion:** ${p.suggestion}\n\n`;

      if (p.beforeAfter) {
        md += `**Before → After:**\n\n`;
        md += `> ❌ **Before:** "${p.beforeAfter.before}"\n>\n`;
        md += `> ✅ **After:** "${p.beforeAfter.after}"\n\n`;
      }
    }
  }

  md += `## Top Suggestion\n\n> ${result.topSuggestion}\n`;
  return md;
}
```

---

## 16. Entry Point (src/index.ts)

```typescript
#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import { parseArgs } from 'util';
import { writeFileSync, readFileSync, existsSync } from 'fs';

import { isFirstRun, getEnvConfig } from './utils/env.js';
import { runSetup } from './core/setup.js';
import { checkReminder, saveLastRun } from './core/reminder.js';
import { claudeProjectsExist, readLogs, groupByDay } from './core/log-reader.js';
import { sanitizePrompts } from './core/sanitizer.js';
import { analyzePrompts } from './core/analyzer.js';
import { getAvailableProvider } from './providers/index.js';
import { printReport, formatMarkdown } from './core/reporter.js';

async function main() {
  // Parse args
  const { values } = parseArgs({
    options: {
      date: { type: 'string', default: 'today' },
      from: { type: 'string' },
      to: { type: 'string' },
      project: { type: 'string' },
      output: { type: 'string' },
      verbose: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'check-reminder': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
      version: { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  // Help
  if (values.help) {
    console.log(`
${chalk.bold('hyntx')} - Analyze your Claude Code prompts

${chalk.bold('Usage:')}
  hyntx [options]

${chalk.bold('Options:')}
  --date <date>      Date to analyze (today, yesterday, YYYY-MM-DD)
  --from <date>      Range start
  --to <date>        Range end
  --project <name>   Filter by project
  --output <path>    Save report (.md or .json)
  --verbose          Show debug info
  --dry-run          Don't send to model
  --help             Show help
  --version          Show version

${chalk.bold('Configuration:')}
  HYNTX_SERVICES=ollama,anthropic    Providers in priority order
  HYNTX_OLLAMA_MODEL=llama3.2        Ollama model
  HYNTX_ANTHROPIC_KEY=sk-ant-...     Anthropic API key

  See: https://github.com/xxx/hyntx
`);
    process.exit(0);
  }

  if (values.version) {
    console.log('0.1.0');
    process.exit(0);
  }

  // Check reminder mode
  if (values['check-reminder']) {
    const shouldContinue = await checkReminder();
    if (!shouldContinue) process.exit(0);
  }

  // First run setup
  if (isFirstRun()) {
    await runSetup();
  }

  const config = getEnvConfig();

  // Verify Claude Code exists
  if (!claudeProjectsExist()) {
    console.error(chalk.red('❌ ~/.claude/projects/ not found'));
    console.error(chalk.dim('   Is Claude Code installed?'));
    process.exit(2);
  }

  // Read logs
  const spinner = ora('Reading logs...').start();

  const { prompts, warnings } = readLogs({
    date: values.date,
    from: values.from,
    to: values.to,
    project: values.project,
    verbose: values.verbose,
  });

  if (prompts.length === 0) {
    spinner.info('No prompts found for the specified range.');
    process.exit(2);
  }

  spinner.succeed(`${prompts.length} prompts found`);

  // Display warnings (schema issues, etc.)
  if (warnings.length > 0) {
    console.log(chalk.yellow('\n⚠️  Warnings:'));
    warnings.forEach(w => console.log(chalk.yellow(`   ${w}`)));
    console.log('');
  }

  // Group by day
  const days = groupByDay(prompts);

  // Sanitize
  const allPromptTexts = prompts.map(p => p.content);
  const { prompts: sanitized, totalRedacted } = sanitizePrompts(allPromptTexts);

  if (values.verbose && totalRedacted > 0) {
    console.log(chalk.dim(`🔒 ${totalRedacted} secret(s) redacted`));
  }

  // Dry run
  if (values['dry-run']) {
    console.log(chalk.yellow('\n📋 Dry-run mode:\n'));
    sanitized.slice(0, 10).forEach((p, i) => {
      const short = p.length > 60 ? p.slice(0, 57) + '...' : p;
      console.log(chalk.dim(`${i + 1}. ${short}`));
    });
    if (sanitized.length > 10) {
      console.log(chalk.dim(`... and ${sanitized.length - 10} more`));
    }
    console.log(chalk.yellow(`\nConfigured services: ${config.services.join(', ')}`));
    process.exit(0);
  }

  // Get available provider (with fallback)
  spinner.start('Connecting to provider...');

  let provider;
  try {
    provider = await getAvailableProvider(config, (from, to) => {
      spinner.warn(`${from} unavailable, trying ${to}...`);
      spinner.start(`Checking ${to}...`);
    });
    spinner.succeed(`${provider.name} connected`);
  } catch (error) {
    spinner.fail('No providers available');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(3);
  }

  // Analyze each day
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const dayPrompts = day.prompts.map(p => p.content);
    const { prompts: daySanitized } = sanitizePrompts(dayPrompts);

    try {
      spinner.start(`Analyzing ${day.date}...`);

      // Use analyzer with batching support
      const result = await analyzePrompts(
        daySanitized,
        provider,
        day.date,
        (batch, total) => {
          spinner.text = `Analyzing ${day.date} (batch ${batch}/${total})...`;
        }
      );

      spinner.stop();
      printReport(result, day.date, day.projectNames);

      // Save to file if requested
      if (values.output) {
        try {
          let content: string;
          const outputPath = values.output;
          const isLastDay = dayIndex === days.length - 1;
          
          // Handle multi-day output: append for markdown, separate files for JSON
          if (days.length > 1) {
            if (outputPath.endsWith('.json')) {
              // For JSON with multiple days, create separate files per day
              const basePath = outputPath.replace(/\.json$/, '');
              const dayOutputPath = `${basePath}-${day.date}.json`;
              content = JSON.stringify({ date: day.date, ...result }, null, 2);
              writeFileSync(dayOutputPath, content, 'utf-8');
              console.log(chalk.green(`✅ Saved to ${dayOutputPath}`));
            } else {
              // For markdown with multiple days, append content
              const existingContent = existsSync(outputPath) 
                ? readFileSync(outputPath, 'utf-8') + '\n\n---\n\n'
                : '';
              content = existingContent + formatMarkdown(result, day.date, day.projectNames);
              writeFileSync(outputPath, content, 'utf-8');
              if (isLastDay) {
                // Only show success message for last day to avoid spam
                console.log(chalk.green(`✅ Saved ${days.length} day(s) to ${outputPath}`));
              }
            }
          } else {
            // Single day: normal behavior
            content = outputPath.endsWith('.json')
              ? JSON.stringify({ date: day.date, ...result }, null, 2)
              : formatMarkdown(result, day.date, day.projectNames);
            writeFileSync(outputPath, content, 'utf-8');
            console.log(chalk.green(`✅ Saved to ${outputPath}`));
          }
        } catch (error) {
          console.error(chalk.red(`Failed to write output file: ${error instanceof Error ? error.message : String(error)}`));
          // Continue execution, don't exit on write failure
        }
      }
    } catch (err) {
      spinner.fail('Analysis error');
      console.error(chalk.red(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
  }

  // Save last run
  saveLastRun();
}

main().catch(err => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});
```

---

## 17. Utils

### 17.1 env.ts

```typescript
import type { EnvConfig, ProviderType } from '../types/index.js';

/**
 * Checks if this is the first run (no services configured)
 */
export function isFirstRun(): boolean {
  return !process.env.HYNTX_SERVICES;
}

/**
 * Parses the HYNTX_SERVICES environment variable
 */
function parseServices(): ProviderType[] {
  const services = process.env.HYNTX_SERVICES || '';
  if (!services) return [];

  return services
    .split(',')
    .map(s => s.trim().toLowerCase() as ProviderType)
    .filter(s => ['ollama', 'anthropic', 'google'].includes(s));
}

/**
 * Gets the full environment configuration
 */
export function getEnvConfig(): EnvConfig {
  return {
    services: parseServices(),
    ollama: {
      model: process.env.HYNTX_OLLAMA_MODEL || 'llama3.2',
      host: process.env.HYNTX_OLLAMA_HOST || 'http://localhost:11434',
    },
    anthropic: {
      model: process.env.HYNTX_ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
      apiKey: process.env.HYNTX_ANTHROPIC_KEY || '',
    },
    google: {
      model: process.env.HYNTX_GOOGLE_MODEL || 'gemini-2.0-flash-exp',
      apiKey: process.env.HYNTX_GOOGLE_KEY || '',
    },
    reminder: (process.env.HYNTX_REMINDER || '7d') as EnvConfig['reminder'],
  };
}
```

### 17.2 paths.ts

```typescript
import { join } from 'path';
import { homedir } from 'os';

export const CLAUDE_PROJECTS_DIR = join(homedir(), '.claude', 'projects');
export const LAST_RUN_FILE = join(homedir(), '.hyntx-last-run');
```

---

## 18. Error Handling

| Situation | Message | Exit |
|-----------|---------|------|
| ~/.claude/projects/ doesn't exist | `❌ ~/.claude/projects/ not found` | 2 |
| No prompts in range | `ℹ️ No prompts found for the specified range` | 2 |
| All providers unavailable | `❌ All providers unavailable: ...` | 3 |
| Network/API error | `❌ Error: [message]` | 1 |
| Invalid date format | `Invalid date format: ... Expected 'today', 'yesterday', or ISO date` | 1 |
| Invalid date range | `Invalid date range: --from must be before --to` | 1 |
| Invalid timestamp in log | Warning added, message skipped | continues |
| Output file write failed | `Failed to write output file: [message]` | continues |
| Schema validation warning | `⚠️ Unknown Claude Code log format...` | continues |
| Shell config write failed | Shows manual instructions | continues |
| Reminder config error | `Reminder configuration error. Please check HYNTX_REMINDER.` | continues |

---

## 19. Testing

Main test cases:

1. **log-reader**: JSONL parsing, date filtering, content extraction, schema validation
2. **schema-validator**: Known schema detection, unknown schema handling
3. **sanitizer**: Detection of each secret type
4. **analyzer**: Batching logic, result merging
5. **providers**: Availability, response parsing, Before/After extraction
6. **provider-factory**: Multi-provider fallback logic
7. **reporter**: Terminal format with Before/After, markdown format
8. **setup**: Interactive flow, multi-select providers
9. **shell-config**: Auto-detection, block update, manual instructions
10. **reminder**: Day calculation, state saving

### Edge Cases to Test

1. **Date parsing**: Invalid date strings, edge dates (year 0, far future)
2. **Batching**: Prompts that exceed `maxTokensPerBatch` individually
3. **Multi-day output**: File writing behavior with `--from`/`--to` spanning multiple days
4. **Invalid timestamps**: Malformed ISO strings in Claude Code logs
5. **Reminder parsing**: Edge cases with `'never'` and invalid reminder formats
6. **Empty prompts**: Files with no user messages, empty content strings
7. **Large files**: Performance with very large JSONL files (>100MB)
8. **Provider failures**: Network timeouts, API rate limits, partial failures
9. **Schema evolution**: Unknown schema versions, missing required fields
10. **File permissions**: Read-only directories, insufficient write permissions

---

## 20. Future Enhancements (v1.1+)

Features deferred from v1.0 for future consideration:

### 20.1 Project-Specific Context (.hyntxrc)

Allow users to provide project context for more tailored advice:

```json
{
  "frameworks": ["Next.js 14", "TypeScript", "tRPC"],
  "description": "E-commerce platform",
  "customRules": "Always specify API endpoint paths"
}
```

### 20.2 Prompt Template Generation

Generate `.claudeprompt` files based on analysis results to help users improve future prompts.

### 20.3 Claude Code Version Detection

Detect Claude Code version from `~/.claude/settings.json` for better compatibility messaging.

---

## 21. Documentation Standards

### 21.1 File Organization

Documentation is organized in single files by topic, stored in the `docs/` directory:

| File | Purpose |
|------|---------|
| `SPECS.md` | Technical specifications and implementation details |
| `ARCHITECTURE.md` | System architecture and design decisions |
| `DEPLOYMENT.md` | Deployment processes and configuration |

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
