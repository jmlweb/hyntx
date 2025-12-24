# Hyntx

**Hyntx** is a CLI tool that analyzes your Claude Code prompts and helps you become a better prompt engineer through retrospective analysis and actionable feedback.

[![npm version](https://img.shields.io/npm/v/hyntx.svg)](https://www.npmjs.com/package/hyntx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

> **🚧 NOT READY FOR USE**: Hyntx is currently **under active development** and **not yet ready for production use**. The tool is not functional at this time. This README describes the planned features and functionality. For the current development status, implementation progress, and what's actually working, please see the [ROADMAP.md](ROADMAP.md).

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
- **Smart reminders**: Oh-my-zsh style periodic reminders (configurable)
- **Auto-configuration**: Saves settings to your shell config automatically
- **Dry-run mode**: Preview what will be analyzed before sending to AI

## Installation

> **Note**: Hyntx is not yet ready for use. The installation instructions below are for reference only. See [ROADMAP.md](ROADMAP.md) for development status.

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
```

### Combining Options

```bash
# Analyze last week for a specific project
hyntx --from 2025-01-15 --to 2025-01-22 --project backend-api

# Generate markdown report for yesterday
hyntx --date yesterday --output yesterday-analysis.md
```

## Configuration

Hyntx uses environment variables for configuration. The interactive setup can **auto-save** these to your shell config (`~/.zshrc`, `~/.bashrc`).

### Multi-Provider Configuration

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

### Provider-Specific Variables

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

### Reminder Settings

```bash
# Set reminder frequency (7d, 14d, 30d, or never)
export HYNTX_REMINDER=7d
```

### Complete Example

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

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/hyntx.git
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
│   ├── index.ts              # CLI entry point
│   ├── core/                 # Core business logic
│   │   ├── setup.ts         # Interactive setup (multi-provider)
│   │   ├── reminder.ts      # Reminder system
│   │   ├── log-reader.ts    # Log parsing
│   │   ├── schema-validator.ts # Log schema validation
│   │   ├── sanitizer.ts     # Secret redaction
│   │   ├── analyzer.ts      # Analysis orchestration + batching
│   │   └── reporter.ts      # Output formatting (Before/After)
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

For detailed development roadmap, planned features, and implementation status, see [ROADMAP.md](ROADMAP.md).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built for [Claude Code](https://claude.com/claude-code) users
- Inspired by retrospective practices in Agile development
- Privacy-first approach inspired by local-first software movement

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/hyntx/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/hyntx/discussions)
- **Email**: your-email@example.com

---

**Made with ❤️ for better prompt engineering**
