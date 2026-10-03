# CLI Reference

```text
hyntx [options]
```

`hyntx --help` is generated from the code and is the final word; this page adds the behaviour behind each flag.

## Period

| Flag            | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `--days <n>`    | The last n days, including today. Positive integer. Default: 7 |
| `--from <date>` | Start date: `YYYY-MM-DD`, `today` or `yesterday`               |
| `--to <date>`   | End date, inclusive. Default: now                              |

`--days` cannot be combined with `--from` or `--to`. With only `--to`, the period is the 7 days ending on that date. Dates are local time.

## Filters and output

| Flag               | Description                                                                |
| ------------------ | -------------------------------------------------------------------------- |
| `--project <name>` | Only projects whose name or directory contains `<name>` (case-insensitive) |
| `--format <fmt>`   | `terminal` (default), `json`, `markdown`                                   |
| `--output <file>`  | Write the report to a file instead of stdout (no colors)                   |
| `--html [path]`    | Also write a self-contained HTML report. Default path: `hyntx-report.html` |

`--html` is in addition to the main output, not instead of it. The HTML file has inline CSS, JavaScript and charts and loads nothing from the network.

A run with `--project` does not read or update the stored daily history, so its trend only covers the logs still on disk.

## Interpretation

| Flag              | Description                                           |
| ----------------- | ----------------------------------------------------- |
| `--no-llm`        | Deterministic analysis only; nothing is sent anywhere |
| `--engine <name>` | `claude` (default) or `ollama`                        |
| `--model <name>`  | Model for the engine; each engine has its own default |

- `claude` runs `claude -p` with your existing Claude Code login and sends sanitized report excerpts to Anthropic. It needs the `claude` command on the PATH and counts against your plan or API usage.
- `ollama` talks to a local Ollama server. Nothing leaves the machine.

If the engine is unavailable or fails, the report is still produced and a note explains what happened. The exit code stays `0`.

## Other

| Flag              | Description             |
| ----------------- | ----------------------- |
| `--verbose`       | Debug logging on stderr |
| `--help`, `-h`    | Show help               |
| `--version`, `-v` | Show version            |

## Streams and exit codes

Report data goes to stdout. The spinner, logs, warnings and "written to" messages go to stderr, so this is safe:

```bash
hyntx --format json --no-llm > report.json
hyntx --format json --no-llm | jq '.insights[] | {title, severity}'
```

| Code | Meaning                                                  |
| ---- | -------------------------------------------------------- |
| 0    | Success                                                  |
| 1    | Error: invalid arguments, unreadable or unwritable files |
| 2    | No Claude Code logs found, or no sessions for the period |

## Output formats

- **terminal**: headline numbers, the top insights with evidence and action, a short metrics block and data-quality notes.
- **markdown**: the full report, suitable for sharing or committing.
- **json**: the `Report` object described in [SPECS.md](SPECS.md), pretty-printed.
- **html** (`--html`): the full report with charts and trends, in one file.

## Environment variables

| Variable                    | Purpose                                       | Default              |
| --------------------------- | --------------------------------------------- | -------------------- |
| `HYNTX_CLAUDE_PROJECTS_DIR` | Where to read session logs from               | `~/.claude/projects` |
| `HYNTX_HOME`                | Where Hyntx keeps its state (`daily.json`)    | `~/.hyntx`           |
| `HYNTX_CLI`                 | Plugin only: path to the `dist/cli.js` to run | unset                |

There are no API keys and no configuration file.

## Examples

```bash
hyntx                                        # last 7 days, default engine
hyntx --days 30 --no-llm                     # a month, fully local
hyntx --project api --days 14                # one project
hyntx --from 2026-09-01 --to 2026-09-30 --format markdown --output september.md
hyntx --days 30 --html reports/hyntx.html
hyntx --engine ollama
```

## In Claude Code

With the plugin installed, `/hyntx [period] [project]` runs the analysis inside a session and offers to apply the actions. See the [README](../README.md#claude-code-plugin).
