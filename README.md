# Hyntx

**Hyntx** is a CLI tool that analyzes your Claude Code prompts and helps you become a better prompt engineer through retrospective analysis and actionable feedback.

[![npm version](https://img.shields.io/npm/v/hyntx.svg)](https://www.npmjs.com/package/hyntx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

> 🚧 **NOT READY FOR USE**: This project is under active development. The published npm package does not produce output yet. Check back for updates.

## What is Hyntx?

Hyntx reads your Claude Code conversation logs and uses AI to detect common prompt engineering anti-patterns. It provides you with:

- **Pattern detection**: Identifies recurring issues in your prompts (missing context, vague instructions, etc.)
- **Actionable suggestions**: Specific recommendations with concrete "Before/After" rewrites
- **Privacy-first**: Automatically redacts secrets and defaults to local AI (Ollama)
- **Zero configuration**: Interactive setup on first run with auto-save to shell config

Think of it as a **retrospective code review for your prompts**.

## Features

- **Offline-first analysis** with local Ollama (privacy-friendly, cost-free)
- **Multi-provider support**: Ollama (local), Anthropic Claude, Google Gemini with automatic fallback
- **Before/After rewrites**: Concrete examples showing how to improve your prompts
- **Automatic secret redaction**: API keys, emails, tokens, credentials
- **Flexible date filtering**: Analyze today, yesterday, specific dates, or date ranges
- **Project filtering**: Focus on specific Claude Code projects
- **Multiple output formats**: Beautiful terminal output or markdown reports
- **Watch mode**: Real-time monitoring and analysis of prompts as you work
- **Smart reminders**: Oh-my-zsh style periodic reminders (configurable)
- **Auto-configuration**: Saves settings to your shell config automatically
- **Dry-run mode**: Preview what will be analyzed before sending to AI

## Installation

### NPM (Global)

```bash
npm install -g hyntx
```

### NPX (No installation)

```bash
npx hyntx
```

### PNPM

```bash
pnpm add -g hyntx
```

## Quick Start

Run Hyntx with a single command:

```bash
hyntx
```

On first run, Hyntx will guide you through an interactive setup:

1. Select one or more AI providers (Ollama recommended for privacy)
2. Configure models and API keys for selected providers
3. Set reminder preferences
4. **Auto-save** configuration to your shell (or get manual instructions)

That's it! Hyntx will analyze today's prompts and show you improvement suggestions with concrete "Before/After" examples.

## Usage

### Basic Commands

```bash
# Analyze today's prompts
hyntx

# Analyze yesterday
hyntx --date yesterday

# Analyze a specific date
hyntx --date 2025-01-20

# Analyze a date range
hyntx --from 2025-01-15 --to 2025-01-20

# Filter by project name
hyntx --project my-awesome-app

# Save report to file
hyntx --output report.md

# Preview without sending to AI
hyntx --dry-run

# Check reminder status
hyntx --check-reminder

# Watch mode - real-time analysis
hyntx --watch

# Watch specific project only
hyntx --watch --project my-app
```

### Combining Options

```bash
# Analyze last week for a specific project
hyntx --from 2025-01-15 --to 2025-01-22 --project backend-api

# Generate markdown report for yesterday
hyntx --date yesterday --output yesterday-analysis.md
```

## Configuration

### Rules Configuration

Hyntx allows you to customize which analysis rules are enabled and their severity levels through a `.hyntxrc.json` file in your project root.

#### Available Pattern IDs

- `vague` - Detects vague requests lacking specificity
- `no-context` - Detects missing background information
- `too-broad` - Detects overly broad requests that should be broken down
- `no-goal` - Detects prompts without a clear outcome
- `imperative` - Detects commands without explanation

#### Configuration Options

For each pattern, you can:

- **Disable**: Set `enabled: false` to skip detection
- **Override severity**: Set `severity` to `"low"`, `"medium"`, or `"high"`

#### Example Configuration

Create `.hyntxrc.json` in your project root:

```json
{
  "rules": {
    "imperative": {
      "enabled": false
    },
    "vague": {
      "severity": "high"
    },
    "no-context": {
      "severity": "high"
    },
    "too-broad": {
      "severity": "medium"
    }
  }
}
```

#### What Happens When Patterns Are Disabled

- **Filtered out**: Disabled patterns are completely excluded from analysis results
- **No detection**: The AI will not look for those specific issues
- **Updated stats**: Pattern counts and frequency calculations exclude disabled patterns
- **Warning**: If all patterns are disabled, you'll see a warning that no analysis will occur

#### How Severity Overrides Work

- **Changed priority**: Patterns are sorted by severity (high → medium → low), then by frequency
- **Updated display**: The reporter shows severity badges based on your configuration
- **No effect on detection**: Severity only affects sorting and display, not whether the pattern is detected

#### Configuration Warnings

Hyntx will warn you about:

- **Invalid pattern IDs**: If you specify a pattern ID that doesn't exist
- **All patterns disabled**: If your configuration disables every pattern

These warnings appear immediately when the configuration is loaded.

### Environment Variables

Hyntx uses environment variables for configuration. The interactive setup can **auto-save** these to your shell config (`~/.zshrc`, `~/.bashrc`).

#### Multi-Provider Configuration

Configure one or more providers in priority order. Hyntx will try each provider in order and fall back to the next if unavailable.

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

#### Provider-Specific Variables

**Ollama:**

| Variable             | Default                  | Description       |
| -------------------- | ------------------------ | ----------------- |
| `HYNTX_OLLAMA_MODEL` | `llama3.2`               | Model to use      |
| `HYNTX_OLLAMA_HOST`  | `http://localhost:11434` | Ollama server URL |

**Anthropic:**

| Variable                | Default                   | Description        |
| ----------------------- | ------------------------- | ------------------ |
| `HYNTX_ANTHROPIC_MODEL` | `claude-3-5-haiku-latest` | Model to use       |
| `HYNTX_ANTHROPIC_KEY`   | -                         | API key (required) |

**Google:**

| Variable             | Default                | Description        |
| -------------------- | ---------------------- | ------------------ |
| `HYNTX_GOOGLE_MODEL` | `gemini-2.0-flash-exp` | Model to use       |
| `HYNTX_GOOGLE_KEY`   | -                      | API key (required) |

#### Reminder Settings

```bash
# Set reminder frequency (7d, 14d, 30d, or never)
export HYNTX_REMINDER=7d
```

#### Complete Example

```bash
# Add to ~/.zshrc or ~/.bashrc (or let Hyntx auto-save it)
export HYNTX_SERVICES=ollama,anthropic
export HYNTX_OLLAMA_MODEL=llama3.2
export HYNTX_ANTHROPIC_KEY=sk-ant-your-key-here
export HYNTX_REMINDER=14d

# Optional: Enable periodic reminders
hyntx --check-reminder 2>/dev/null
```

Then reload your shell:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

## AI Provider Setup

### Ollama (Recommended)

Ollama runs AI models locally for **privacy and cost savings**.

1. Install Ollama: [ollama.ai](https://ollama.ai)
2. Pull a model:

   ```bash
   ollama pull llama3.2
   ```

3. Verify it's running:

   ```bash
   ollama list
   ```

4. Run Hyntx (it will auto-configure on first run):

   ```bash
   hyntx
   ```

### Anthropic Claude

1. Get API key from [console.anthropic.com](https://console.anthropic.com/)
2. Run Hyntx and select Anthropic during setup, or set manually:

   ```bash
   export HYNTX_SERVICES=anthropic
   export HYNTX_ANTHROPIC_KEY=sk-ant-your-key-here
   ```

### Google Gemini

1. Get API key from [ai.google.dev](https://ai.google.dev)
2. Run Hyntx and select Google during setup, or set manually:

   ```bash
   export HYNTX_SERVICES=google
   export HYNTX_GOOGLE_KEY=your-google-api-key
   ```

### Using Multiple Providers

Configure multiple providers for automatic fallback:

```bash
# If Ollama is down, automatically try Anthropic
export HYNTX_SERVICES=ollama,anthropic
export HYNTX_OLLAMA_MODEL=llama3.2
export HYNTX_ANTHROPIC_KEY=sk-ant-your-key-here
```

When running, Hyntx will show fallback behavior:

```text
⚠️  ollama unavailable, trying anthropic...
✅ anthropic connected
```

## Example Output

```text
📊 Hyntx - 2025-01-20
──────────────────────────────────────────────────

📈 Statistics
   Prompts: 15
   Projects: my-app, backend-api
   Score: 6.5/10

⚠️  Patterns (3)

🔴 Missing Context (60%)
   • "Fix the bug in auth"
   • "Update the component"
   💡 Include specific error messages, framework versions, and file paths

   Before:
   ❌ "Fix the bug in auth"
   After:
   ✅ "Fix authentication bug in src/auth/login.ts where users get
      'Invalid token' error. Using Next.js 14.1.0 with next-auth 4.24.5."

🟡 Vague Instructions (40%)
   • "Make it better"
   • "Improve this"
   💡 Define specific success criteria and expected outcomes

   Before:
   ❌ "Make it better"
   After:
   ✅ "Optimize the database query to reduce response time from 500ms
      to under 100ms. Focus on adding proper indexes."

──────────────────────────────────────────────────
💎 Top Suggestion
   "Add error messages and stack traces to debugging requests for
    10x faster resolution."
──────────────────────────────────────────────────
```

## MCP Integration

Hyntx can run as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server, enabling real-time prompt analysis directly within MCP-compatible clients like Claude Code.

### Quick Setup

Add hyntx to your Claude Code MCP configuration:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hyntx": {
      "command": "hyntx",
      "args": ["--mcp-server"]
    }
  }
}
```

After editing, restart Claude Code. The hyntx tools will be available in your conversations.

### Prerequisites

- **Hyntx installed globally**: `npm install -g hyntx`
- **AI provider configured**: Set up Ollama (recommended) or cloud providers via environment variables

If using Ollama (recommended for privacy):

```bash
# Ensure Ollama is running
ollama serve

# Pull a model if needed
ollama pull llama3.2

# Set environment variables (add to ~/.zshrc or ~/.bashrc)
export HYNTX_SERVICES=ollama
export HYNTX_OLLAMA_MODEL=llama3.2
```

### Available MCP Tools

Hyntx exposes three tools through the MCP interface:

#### analyze-prompt

Analyze a prompt to detect anti-patterns, issues, and get improvement suggestions.

**Input Schema:**

| Parameter | Type   | Required | Description                                           |
| --------- | ------ | -------- | ----------------------------------------------------- |
| `prompt`  | string | Yes      | The prompt text to analyze                            |
| `date`    | string | No       | Date context in ISO format. Defaults to current date. |

**Example Output:**

```json
{
  "patterns": [
    {
      "id": "no-context",
      "name": "Missing Context",
      "severity": "high",
      "frequency": "100%",
      "suggestion": "Include specific error messages and file paths",
      "examples": ["Fix the bug in auth"]
    }
  ],
  "stats": {
    "promptCount": 1,
    "overallScore": 4.5
  },
  "topSuggestion": "Add error messages and stack traces for faster resolution"
}
```

#### suggest-improvements

Get concrete before/after rewrites showing how to improve a prompt.

**Input Schema:**

| Parameter | Type   | Required | Description                                           |
| --------- | ------ | -------- | ----------------------------------------------------- |
| `prompt`  | string | Yes      | The prompt text to analyze for improvements           |
| `date`    | string | No       | Date context in ISO format. Defaults to current date. |

**Example Output:**

```json
{
  "improvements": [
    {
      "issue": "Missing Context",
      "before": "Fix the bug in auth",
      "after": "Fix authentication bug in src/auth/login.ts where users get 'Invalid token' error. Using Next.js 14.1.0 with next-auth 4.24.5.",
      "suggestion": "Include specific error messages, framework versions, and file paths"
    }
  ],
  "summary": "Found 1 improvement(s)",
  "topSuggestion": "Add error messages and stack traces for faster resolution"
}
```

#### check-context

Verify if a prompt has sufficient context for effective AI interaction.

**Input Schema:**

| Parameter | Type   | Required | Description                                           |
| --------- | ------ | -------- | ----------------------------------------------------- |
| `prompt`  | string | Yes      | The prompt text to check for context                  |
| `date`    | string | No       | Date context in ISO format. Defaults to current date. |

**Example Output:**

```json
{
  "hasSufficientContext": false,
  "score": 4.5,
  "issues": ["Missing Context", "Vague Instructions"],
  "suggestion": "Include specific error messages and file paths",
  "details": "Prompt lacks sufficient context for effective AI interaction"
}
```

### Usage Examples

Once configured, you can use these tools in your Claude Code conversations:

**Analyze a prompt before sending:**

```text
Use the analyze-prompt tool to check: "Fix the login bug"
```

**Get improvement suggestions:**

```text
Use suggest-improvements on: "Make the API faster"
```

**Check if your prompt has enough context:**

```text
Use check-context to verify: "Update the component to handle errors"
```

### MCP Server Troubleshooting

#### "Server failed to start"

1. Verify hyntx is installed globally:

   ```bash
   which hyntx
   # Should output: /usr/local/bin/hyntx or similar
   ```

2. Test manual startup:

   ```bash
   hyntx --mcp-server
   # Should output: MCP server running on stdio
   ```

3. Check environment variables are set (if using cloud providers):

   ```bash
   echo $HYNTX_SERVICES
   echo $HYNTX_ANTHROPIC_KEY  # if using Anthropic
   ```

#### "Analysis failed: Provider not available"

1. If using Ollama, ensure it's running:

   ```bash
   ollama list
   # If no output, start Ollama:
   ollama serve
   ```

2. If using cloud providers, verify API keys are set:

   ```bash
   # Check if keys are configured
   env | grep HYNTX_
   ```

#### "Tools not appearing in Claude Code"

1. Restart Claude Code completely after config changes
2. Verify the config file path is correct for your OS
3. Check JSON syntax in the config file:

   ```bash
   # macOS
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
   ```

#### "Slow responses"

- Local Ollama models are fastest but require GPU for best performance
- Consider using a faster model: `export HYNTX_OLLAMA_MODEL=llama3.2:1b`
- Cloud providers (Anthropic, Google) offer faster responses but require API keys

## Privacy & Security

Hyntx takes your privacy seriously:

- **Local-first**: Defaults to Ollama for offline analysis
- **Automatic redaction**: Removes API keys, credentials, emails, tokens before analysis
- **Read-only**: Never modifies your Claude Code logs
- **No telemetry**: Hyntx doesn't send usage data anywhere

### What Gets Redacted?

- OpenAI/Anthropic API keys (`sk-*`, `claude-*`)
- AWS credentials (`AKIA*`, secret keys)
- Bearer tokens
- HTTP credentials in URLs
- Email addresses
- Private keys (PEM format)

## How It Works

1. **Read logs**: Parses Claude Code conversation logs from `~/.claude/projects/`
2. **Extract prompts**: Filters user messages from conversations
3. **Sanitize**: Redacts sensitive information automatically
4. **Analyze**: Sends sanitized prompts to AI provider for pattern detection
5. **Report**: Displays findings with examples and suggestions

## Requirements

- **Node.js**: 22.0.0 or higher
- **Claude Code**: Must have Claude Code installed and used
- **AI Provider**: Ollama (local) or Anthropic/Google API key

## Troubleshooting

### "No Claude Code logs found"

Make sure you've used Claude Code at least once. Logs are stored in:

```text
~/.claude/projects/<project-hash>/logs.jsonl
```

### "Ollama connection failed"

1. Check Ollama is running: `ollama list`
2. Start Ollama: `ollama serve`
3. Verify the host: `echo $HYNTX_OLLAMA_HOST` (default: `http://localhost:11434`)

### "No prompts found for date range"

- Check the date format: `YYYY-MM-DD`
- Verify you used Claude Code on those dates
- Try `--dry-run` to see what logs are being read

## Programmatic API

Hyntx can also be used as a library in your Node.js applications for custom integrations, CI/CD pipelines, or building tooling on top of the analysis engine.

### Installation

```bash
npm install hyntx
# or
pnpm add hyntx
```

### Basic Usage

```typescript
import {
  analyzePrompts,
  sanitizePrompts,
  readLogs,
  createProvider,
  getEnvConfig,
  type AnalysisResult,
  type ExtractedPrompt,
} from 'hyntx';

// Read Claude Code logs for a specific date
const { prompts } = await readLogs({ date: 'today' });

// Sanitize prompts to remove secrets
const { prompts: sanitizedTexts } = sanitizePrompts(
  prompts.map((p: ExtractedPrompt) => p.content),
);

// Get environment configuration
const config = getEnvConfig();

// Create an AI provider
const provider = await createProvider('ollama', config);

// Analyze the prompts
const result: AnalysisResult = await analyzePrompts({
  provider,
  prompts: sanitizedTexts,
  date: '2025-12-26',
});

// Use the results
console.log(`Overall score: ${result.stats.overallScore}/10`);
console.log(`Patterns detected: ${result.patterns.length}`);

result.patterns.forEach((pattern) => {
  console.log(`- ${pattern.name}: ${pattern.severity}`);
  console.log(`  Suggestion: ${pattern.suggestion}`);
});
```

### Advanced Examples

**CI/CD Integration** - Fail builds when prompt quality drops below threshold:

```typescript
import { analyzePrompts, readLogs, createProvider, getEnvConfig } from 'hyntx';

const config = getEnvConfig();
const provider = await createProvider('ollama', config);
const { prompts } = await readLogs({ date: 'today' });

const result = await analyzePrompts({
  provider,
  prompts: prompts.map((p) => p.content),
  date: new Date().toISOString().split('T')[0],
});

// Fail CI if quality score is too low
const QUALITY_THRESHOLD = 7.0;
if (result.stats.overallScore < QUALITY_THRESHOLD) {
  console.error(
    `Quality score ${result.stats.overallScore} below threshold ${QUALITY_THRESHOLD}`,
  );
  process.exit(1);
}
```

**Custom Analysis** - Analyze specific prompts without reading logs:

```typescript
import { analyzePrompts, createProvider, getEnvConfig } from 'hyntx';

const config = getEnvConfig();
const provider = await createProvider('anthropic', config);

const customPrompts = [
  'Fix the bug',
  'Make it better',
  'Refactor the authentication module to use JWT tokens instead of sessions',
];

const result = await analyzePrompts({
  provider,
  prompts: customPrompts,
  date: '2025-12-26',
  context: {
    role: 'developer',
    techStack: ['TypeScript', 'React', 'Node.js'],
  },
});

console.log(result.patterns);
```

**History Management** - Track analysis over time:

```typescript
import {
  analyzePrompts,
  saveAnalysisResult,
  loadAnalysisResult,
  compareResults,
  type HistoryMetadata,
} from 'hyntx';

// Run analysis
const result = await analyzePrompts({
  /* ... */
});

// Save to history
const metadata: HistoryMetadata = {
  date: '2025-12-26',
  promptCount: result.stats.promptCount,
  score: result.stats.overallScore,
  projectFilter: undefined,
  provider: 'ollama',
};
await saveAnalysisResult(result, metadata);

// Load previous analysis
const previousResult = await loadAnalysisResult('2025-12-19');

// Compare results
const comparison = await compareResults('2025-12-19', '2025-12-26');
console.log(
  `Score change: ${comparison.scoreChange > 0 ? '+' : ''}${comparison.scoreChange}`,
);
```

### API Reference

#### Core Functions

- **`analyzePrompts(options: AnalysisOptions): Promise<AnalysisResult>`** - Analyze prompts and detect anti-patterns
- **`readLogs(options?: ReadLogsOptions): Promise<LogReadResult>`** - Read Claude Code conversation logs
- **`sanitize(text: string): SanitizeResult`** - Remove secrets from a single text
- **`sanitizePrompts(prompts: string[]): { prompts: string[]; totalRedacted: number }`** - Remove secrets from multiple prompts

#### Provider Functions

- **`createProvider(type: ProviderType, config: EnvConfig): Promise<AnalysisProvider>`** - Create an AI provider instance
- **`getAvailableProvider(config: EnvConfig, onFallback?: Function): Promise<AnalysisProvider>`** - Get first available provider with fallback
- **`getAllProviders(services: string[], config: EnvConfig): AnalysisProvider[]`** - Get all configured providers

#### History Functions

- **`saveAnalysisResult(result: AnalysisResult, metadata: HistoryMetadata): Promise<void>`** - Save analysis to history
- **`loadAnalysisResult(date: string): Promise<HistoryEntry | null>`** - Load analysis from history
- **`listAvailableDates(): Promise<string[]>`** - Get list of dates with saved analyses
- **`compareResults(beforeDate: string, afterDate: string): Promise<ComparisonResult>`** - Compare two analyses

#### Utility Functions

- **`getEnvConfig(): EnvConfig`** - Get environment configuration
- **`claudeProjectsExist(): boolean`** - Check if Claude projects directory exists
- **`parseDate(dateStr: string): Date`** - Parse date string to Date object
- **`groupByDay(prompts: ExtractedPrompt[]): DayGroup[]`** - Group prompts by day

#### Cache Functions

- **`generateCacheKey(config: CacheKeyConfig): string`** - Generate cache key for analysis
- **`getCachedResult(cacheKey: string): Promise<AnalysisResult | null>`** - Get cached result
- **`setCachedResult(cacheKey: string, result: AnalysisResult, ttlMinutes?: number): Promise<void>`** - Cache analysis result

### TypeScript Support

Hyntx is written in TypeScript and provides full type definitions. All types are exported:

```typescript
import type {
  AnalysisResult,
  AnalysisPattern,
  AnalysisStats,
  ExtractedPrompt,
  ProviderType,
  EnvConfig,
  HistoryEntry,
  ComparisonResult,
} from 'hyntx';
```

See the TypeScript definitions for complete API documentation.

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/jmlweb/hyntx.git
cd hyntx

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Build
pnpm build

# Test the CLI
pnpm start
```

### Project Structure

```text
hyntx/
├── src/
│   ├── index.ts              # Library entry point (re-exports api/)
│   ├── cli.ts                # CLI entry point
│   ├── api/
│   │   └── index.ts          # Public API surface
│   ├── core/                 # Core business logic
│   │   ├── setup.ts         # Interactive setup (multi-provider)
│   │   ├── reminder.ts      # Reminder system
│   │   ├── log-reader.ts    # Log parsing
│   │   ├── schema-validator.ts # Log schema validation
│   │   ├── sanitizer.ts     # Secret redaction
│   │   ├── analyzer.ts      # Analysis orchestration + batching
│   │   ├── reporter.ts      # Output formatting (Before/After)
│   │   ├── watcher.ts       # Real-time log file monitoring
│   │   └── history.ts       # Analysis history management
│   ├── providers/            # AI providers
│   │   ├── base.ts          # Interface & prompts
│   │   ├── ollama.ts        # Ollama integration
│   │   ├── anthropic.ts     # Claude integration
│   │   ├── google.ts        # Gemini integration
│   │   └── index.ts         # Provider factory with fallback
│   ├── utils/               # Utility functions
│   │   ├── env.ts           # Environment config
│   │   ├── shell-config.ts  # Shell auto-configuration
│   │   ├── paths.ts         # System path constants
│   │   ├── logger-base.ts   # Base logger (no CLI deps)
│   │   ├── logger.ts        # CLI logger (with chalk)
│   │   └── terminal.ts      # Terminal utilities
│   └── types/
│       └── index.ts         # TypeScript type definitions
├── docs/
│   └── SPECS.md             # Technical specifications
└── package.json
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using Conventional Commits
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

For detailed development roadmap, planned features, and implementation status, see [docs/ROADMAP.md](docs/ROADMAP.md).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for [Claude Code](https://claude.com/claude-code) users
- Inspired by retrospective practices in Agile development
- Privacy-first approach inspired by local-first software movement

## Support

- **Issues**: [GitHub Issues](https://github.com/jmlweb/hyntx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jmlweb/hyntx/discussions)

---

**Made with ❤️ for better prompt engineering**
