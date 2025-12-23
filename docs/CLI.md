# CLI Specification

## Usage

```bash
hyntx [options]
```

## Options

| Flag               | Alias | Type      | Default | Description                   |
| ------------------ | ----- | --------- | ------- | ----------------------------- |
| `--date`           |       | `string`  | `today` | Date to analyze               |
| `--from`           |       | `string`  |         | Range start date              |
| `--to`             |       | `string`  |         | Range end date                |
| `--project`        |       | `string`  |         | Filter by project name        |
| `--output`         | `-o`  | `string`  |         | Save report to file           |
| `--verbose`        | `-v`  | `boolean` | `false` | Show debug information        |
| `--dry-run`        |       | `boolean` | `false` | Preview without sending to AI |
| `--check-reminder` |       | `boolean` | `false` | Check if reminder is due      |
| `--help`           | `-h`  | `boolean` |         | Show help                     |
| `--version`        |       | `boolean` |         | Show version                  |

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

# Save as JSON
hyntx --output analysis.json

# Multi-day range to file
hyntx --from 2025-01-15 --to 2025-01-20 --output weekly-report.md
```

### Debugging

```bash
# Preview what would be sent
hyntx --dry-run

# Verbose output
hyntx --verbose

# Both
hyntx --dry-run --verbose
```

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

```text
📊 Hyntx - 2025-01-20
──────────────────────────────────────────────────

📈 Statistics
   Prompts: 23
   Projects: my-app, backend
   Score: 7.2/10

⚠️  Patterns (3)

🟡 Missing Technical Context (68%)
   • "fix auth bug"
   • "update component"
   💡 Include specific error messages and file paths

   Before:
   ❌ "fix auth bug"
   After:
   ✅ "Fix authentication bug in src/auth/login.ts..."

──────────────────────────────────────────────────
💎 Top Suggestion
   "Add error messages to debugging requests"
──────────────────────────────────────────────────
```

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

### JSON (`--output analysis.json`)

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
