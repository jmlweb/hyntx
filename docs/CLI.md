# CLI Specification

## Usage

```bash
hyntx [options]
```

## Options

| Flag               | Alias | Type      | Default | Description                                |
| ------------------ | ----- | --------- | ------- | ------------------------------------------ |
| `--date`           |       | `string`  | `today` | Date to analyze                            |
| `--from`           |       | `string`  |         | Range start date                           |
| `--to`             |       | `string`  |         | Range end date                             |
| `--project`        |       | `string`  |         | Filter by project name                     |
| `--output`         | `-o`  | `string`  |         | Save report to file                        |
| `--format`         |       | `string`  |         | Output format: `json`, `markdown`          |
| `--verbose`        | `-v`  | `boolean` | `false` | Show debug information                     |
| `--dry-run`        |       | `boolean` | `false` | Preview without sending to AI              |
| `--check-config`   |       | `boolean` | `false` | Validate configuration and check providers |
| `--check-reminder` |       | `boolean` | `false` | Check if reminder is due                   |
| `--watch`          |       | `boolean` | `false` | Monitor logs in real-time                  |
| `--quiet`          | `-q`  | `boolean` | `false` | Show only high-severity (with --watch)     |
| `--help`           | `-h`  | `boolean` |         | Show help                                  |
| `--version`        |       | `boolean` |         | Show version                               |

---

## Date Formats

The `--date`, `--from`, and `--to` flags accept:

| Format      | Example             | Description   |
| ----------- | ------------------- | ------------- |
| `today`     | `--date today`      | Current day   |
| `yesterday` | `--date yesterday`  | Previous day  |
| ISO date    | `--date 2025-01-20` | Specific date |

### Date Range

```bash
# Analyze specific range
hyntx --from 2025-01-15 --to 2025-01-20

# Single day (equivalent forms)
hyntx --date 2025-01-20
hyntx --from 2025-01-20 --to 2025-01-20
```

---

## Examples

### Basic Usage

```bash
# Analyze today's prompts
hyntx

# Analyze yesterday
hyntx --date yesterday

# Analyze specific date
hyntx --date 2025-01-20
```

### Filtering

```bash
# Filter by project
hyntx --project my-app

# Combine with date
hyntx --date yesterday --project backend
```

### Output

```bash
# Save as Markdown
hyntx --output report.md
hyntx --format markdown --output report.md

# Save as JSON (to file)
hyntx --output analysis.json
hyntx --format json --output analysis.json

# JSON to stdout (for piping)
hyntx --format json

# Multi-day range to file
hyntx --from 2025-01-15 --to 2025-01-20 --output weekly-report.md
```

### Debugging

```bash
# Preview what would be sent
hyntx --dry-run

# Verbose output
hyntx --verbose

# Check configuration health
hyntx --check-config

# Both dry-run and verbose
hyntx --dry-run --verbose
```

---

## Watch Mode

Watch mode monitors Claude Code logs in real-time and analyzes new prompts as they arrive.

### Basic Usage

```bash
# Start watching for new prompts
hyntx --watch

# Watch specific project only
hyntx --watch --project my-app

# Show only high-severity patterns
hyntx --watch --quiet
```

### Output Format

Watch mode provides concise, real-time output for each analyzed prompt:

```text
Watch Mode
Monitoring Claude Code logs for new prompts...
Press Ctrl+C to stop

[14:32:15] my-project ⚠️ Missing Technical Context
[14:32:15] my-project ⚠️ Vague Action Verbs
[14:35:22] backend ✓ No issues
[14:38:45] frontend ⚠️ Missing Technical Context
```

Each line shows:

- **Timestamp**: `[HH:MM:SS]` - When the prompt was analyzed
- **Project**: Project name from Claude Code
- **Icon**: Severity indicator (⚠️ red=high, ⚠️ yellow=medium, ℹ️ blue=low, ✓ green=no issues)
- **Pattern**: Name of the detected pattern

### Quiet Mode

Use `--quiet` to filter output to only high-severity patterns:

```bash
hyntx --watch --quiet
```

This is useful for:

- Monitoring in the background
- Focusing on critical issues only
- Reducing noise during active development

### Restrictions

Watch mode is incompatible with:

- Date filtering (`--date`, `--from`, `--to`)
- Output files (`--output`)
- Dry-run mode (`--dry-run`)
- Comparison flags (`--compare-*`)
- History flags (`--history`, `--history-summary`)

### Stopping the Watcher

Press `Ctrl+C` to stop watch mode gracefully.

---

## Exit Codes

| Code | Name                   | Scenario                                    |
| ---- | ---------------------- | ------------------------------------------- |
| 0    | `SUCCESS`              | Analysis completed successfully             |
| 1    | `ERROR`                | General error (API, network, parse failure) |
| 2    | `NO_DATA`              | No logs found or no prompts in range        |
| 3    | `PROVIDER_UNAVAILABLE` | All configured providers unavailable        |

### Usage in Scripts

```bash
#!/bin/bash
hyntx --date today --output report.md

case $? in
  0) echo "Report generated" ;;
  2) echo "No prompts to analyze" ;;
  3) echo "Check provider configuration" ;;
  *) echo "Error occurred" ;;
esac
```

---

## Environment Variables

### Provider Configuration

| Variable         | Default  | Description                   |
| ---------------- | -------- | ----------------------------- |
| `HYNTX_SERVICES` | Required | Comma-separated provider list |
| `HYNTX_REMINDER` | `7d`     | Reminder frequency            |

### Ollama

| Variable             | Default                  |
| -------------------- | ------------------------ |
| `HYNTX_OLLAMA_MODEL` | `llama3.2`               |
| `HYNTX_OLLAMA_HOST`  | `http://localhost:11434` |

### Anthropic

| Variable                | Default                     |
| ----------------------- | --------------------------- |
| `HYNTX_ANTHROPIC_MODEL` | `claude-3-5-haiku-latest`   |
| `HYNTX_ANTHROPIC_KEY`   | Required if using Anthropic |

### Google

| Variable             | Default                  |
| -------------------- | ------------------------ |
| `HYNTX_GOOGLE_MODEL` | `gemini-2.0-flash-exp`   |
| `HYNTX_GOOGLE_KEY`   | Required if using Google |

### Example Configurations

```bash
# Ollama only (offline)
export HYNTX_SERVICES=ollama
export HYNTX_OLLAMA_MODEL=llama3.2

# Multi-provider with fallback
export HYNTX_SERVICES=ollama,anthropic
export HYNTX_ANTHROPIC_KEY=sk-ant-...

# Cloud-first
export HYNTX_SERVICES=anthropic,google,ollama
export HYNTX_ANTHROPIC_KEY=sk-ant-...
export HYNTX_GOOGLE_KEY=AI...
```

---

## Error Messages

| Error                                      | Cause                          | Solution                                  |
| ------------------------------------------ | ------------------------------ | ----------------------------------------- |
| `~/.claude/projects/ not found`            | Claude Code not installed      | Install Claude Code                       |
| `No prompts found for the specified range` | No user messages in date range | Try different date                        |
| `All providers unavailable`                | No provider responded          | Check provider config                     |
| `Invalid date format`                      | Unrecognized date string       | Use `today`, `yesterday`, or `YYYY-MM-DD` |
| `Invalid date range`                       | `--from` is after `--to`       | Swap dates                                |

---

## Output Formats

### Terminal (Default)

The terminal output uses ASCII art, boxes, tables, and colors for an attractive visual experience:

```text
  _   _                  _
 | | | |_   _ _ __  _ __| |_ _   _
 | |_| | | | | '_ \| '__| __| | | |
 |  _  | |_| | | | | |  | |_| |_| |
 |_| |_|\__,_|_| |_|_|   \__|\__, |
                              |___/

📊 Hyntx Analysis - 2025-01-20
═══════════════════════════════════════════════════

┌─────────────────────────────────────────────────┐
│ 📈 Statistics                                    │
├─────────────────────────────────────────────────┤
│ Prompts  │ 23                                    │
│ Projects │ my-app, backend                       │
│ Score    │ 7.2/10                               │
└─────────────────────────────────────────────────┘

⚠️  Patterns Detected (3)

┌─────────────────────────────────────────────────┐
│ 🟡 Missing Technical Context (68%)              │
├─────────────────────────────────────────────────┤
│ Examples:                                        │
│   • "fix auth bug"                              │
│   • "update component"                          │
│                                                  │
│ 💡 Suggestion:                                  │
│   Include specific error messages and file paths │
│                                                  │
│ ── Before ────────────────────────────────────  │
│ ❌ "fix auth bug"                               │
│                                                  │
│ ── After ─────────────────────────────────────  │
│ ✅ "Fix authentication bug in src/auth/login.ts │
│    where users cannot authenticate after..."     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 💎 Top Suggestion                               │
├─────────────────────────────────────────────────┤
│ Add error messages to debugging requests         │
└─────────────────────────────────────────────────┘
```

**Visual Features:**

- ASCII art header (optional, can be disabled with `--no-art`)
- Boxed sections using borders for visual separation
- Tables for structured statistics
- Color-coded scores and severity indicators
- Progress bars during long operations
- Spinners during short operations

### Markdown (`--output report.md`)

```markdown
# Hyntx Analysis - 2025-01-20

## Statistics

| Metric   | Value           |
| -------- | --------------- |
| Prompts  | 23              |
| Projects | my-app, backend |
| Score    | 7.2/10          |

## Patterns

### 🟡 Missing Technical Context (68%)

**Examples:**

- "fix auth bug"
- "update component"

**Suggestion:** Include specific error messages and file paths

**Before → After:**

> ❌ **Before:** "fix auth bug"
>
> ✅ **After:** "Fix authentication bug in src/auth/login.ts..."

## Top Suggestion

> Add error messages to debugging requests
```

### JSON (`--output analysis.json` or `--format json`)

JSON output is useful for programmatic consumption and integration with other tools.

**To stdout** (for piping or programmatic use):

```bash
hyntx --format json | jq '.stats.overallScore'
```

**To file**:

```bash
hyntx --format json --output analysis.json
# Or infer from file extension:
hyntx --output analysis.json
```

**Example JSON output**:

```json
{
  "date": "2025-01-20",
  "patterns": [
    {
      "id": "missing_context",
      "name": "Missing Technical Context",
      "frequency": 0.68,
      "severity": "medium",
      "examples": ["fix auth bug", "update component"],
      "suggestion": "Include specific error messages and file paths",
      "beforeAfter": {
        "before": "fix auth bug",
        "after": "Fix authentication bug in src/auth/login.ts..."
      }
    }
  ],
  "stats": {
    "totalPrompts": 23,
    "promptsWithIssues": 15,
    "overallScore": 7.2
  },
  "topSuggestion": "Add error messages to debugging requests"
}
```

**Common use cases**:

```bash
# Extract overall score
hyntx --format json | jq '.stats.overallScore'

# Count patterns
hyntx --format json | jq '.patterns | length'

# Get pattern names
hyntx --format json | jq '.patterns[].name'

# Filter high-severity patterns
hyntx --format json | jq '.patterns[] | select(.severity == "high")'
```

---

## Configuration Health Check

The `--check-config` flag validates your configuration and checks provider availability without running analysis.

```bash
hyntx --check-config
```

**Output example**:

```text
✅ Configuration valid

Providers:
  ✅ ollama - connected (llama3.2 available)
  ✅ anthropic - API key valid
  ⚠️  google - API key not configured (optional)

Reminder: 7d (last run: 3 days ago)

Project config: .hyntxrc found
  - Overrides: ollama_model=llama3.3
```

**Common issues detected**:

- Missing API keys
- Invalid provider configuration
- Unavailable Ollama service
- Malformed `.hyntxrc` file

---

## Shell Integration

### Reminder Hook

Add to `~/.zshrc` or `~/.bashrc`:

```bash
# Periodic reminder to analyze prompts
hyntx --check-reminder 2>/dev/null
```

### Auto-Generated Config Block

First run creates:

```bash
# >>> hyntx config >>>
export HYNTX_SERVICES=ollama
export HYNTX_OLLAMA_MODEL=llama3.2

# Uncomment to enable periodic reminders:
# hyntx --check-reminder 2>/dev/null
# <<< hyntx config <<<
```
