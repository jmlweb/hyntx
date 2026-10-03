# Hyntx

[![npm version](https://img.shields.io/npm/v/hyntx.svg)](https://www.npmjs.com/package/hyntx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg)](https://nodejs.org/)

Hyntx reads your Claude Code session logs and tells you where your sessions cost you time, with the evidence and a fix you can apply.

It looks at what actually happened in each session, not at how your prompts are worded: the times you corrected Claude, interrupted it, watched the same command fail in a loop, hit a blocked tool, re-explained the same thing in three sessions, or ran the same read-only command again and again in a mode that can prompt. Each finding comes with counts, quoted examples and one concrete action: a rule for `CLAUDE.md`, a permission entry for `settings.json`, a slash command file, a prompting habit or a workflow change.

> Hyntx 4 is a rewrite. Versions up to 3 sent the text of your prompts to a model and returned prompt-writing advice. If you are upgrading, read [Migrating from v3](#migrating-from-v3).

## How it differs

**From prompt linting.** A prompt linter judges the text of a prompt. Hyntx judges outcomes: a short prompt that worked is fine, and a careful prompt that led to four corrections is a finding.

**From Claude Code's `/insights`.** Claude Code has a built-in [`/insights`](https://code.claude.com/docs/en/costs#analyze-your-usage-patterns) command that has a model read your recent sessions and writes a narrative HTML report. Hyntx overlaps with it and is built differently:

- The core is deterministic. Parsing, metrics, friction detection and ranking are plain code; the same logs give the same findings, and the whole analysis runs with no model at all (`--no-llm`).
- Every finding carries its evidence: how many times, in how many sessions, in which projects, with quoted examples.
- Every finding ends in an action that is ready to apply (review it first: suggestions are heuristics, and a permission rule in particular should be checked before you paste it), and the [plugin](#claude-code-plugin) applies it for you after you confirm.
- Output is also available as JSON and markdown, for scripts and for other tools.
- Daily totals are kept in `~/.hyntx/`, so trends remain after Claude Code deletes old session logs (30 days by default).

## Install and run

Requires Node.js 22 or later and Claude Code session logs in `~/.claude/projects/`.

```bash
npx hyntx                 # last 7 days, all projects
npm install -g hyntx      # or install it
```

```bash
hyntx --days 30                     # a longer period
hyntx --project my-app              # one project (substring match)
hyntx --from 2026-09-01 --to 2026-09-30
hyntx --no-llm                      # deterministic analysis only
hyntx --html                        # also write hyntx-report.html
hyntx --format json > report.json   # machine-readable
```

## Example output

Shortened, from `hyntx --days 30 --no-llm`:

```text
hyntx  2026-09-04 to 2026-10-03 (30 days) - all projects

14 sessions  45 typed prompts  645 tool calls (1.6% errors)
98.3M tokens (97% cache hits, 468.9k output)  0 interruptions  0 compactions

Top insights (3 of 6)

1. [MEDIUM] A hook keeps blocking Bash: "Use 'trash' instead of 'rm'"
   A PreToolUse hook blocked 4 calls with the same message in 4 sessions in shop.
   evidence: 4 in 4 sessions; e.g. "… touch /var/www/html/.t && cleanup /var/www/html/.t …" (shop, 2026-09-19)
   do: Add to CLAUDE.md in project "shop"
      - A hook blocks commands that break this rule: "Use 'trash' instead of 'rm'".
        Follow it on the first attempt instead of retrying the blocked command.

2. [LOW] Read-only commands that may be worth allowing
   1 read-only command ran 6 times in permission modes that can prompt (top: Bash(gh pr view *)).
   do: Allow in ~/.claude/settings.json
      { "permissions": { "allow": ["Bash(gh pr view *)"] } }

3. [LOW] `bin/sync` was reworked repeatedly
   `bin/sync` was edited 6 times across 3 of your prompts, with 2 tool failures in between (plan mode was not used).
   do: Plan before editing: agree on the exact changes first, then execute.

Metrics
  Projects shop 38, printing 3, hyntx 1
  Tools    Bash 476 (8 err), Write 26, Edit 18, Read 14
  Sessions median 4m, p90 38m
```

With too little data (fewer than 3 sessions or 10 typed prompts) Hyntx says so instead of producing findings.

## Claude Code plugin

The plugin adds the `/hyntx:hyntx` command to Claude Code. It runs the same analyzer with `--no-llm` and lets the Claude in your session do the interpretation: it checks each detected episode against its context, discards the ones that are not real friction, shows you the few findings that matter and offers to apply the fixes. It shows the exact change and asks before every write, and it does not add a rule that is already there. The runner validates its arguments, never uses a shell, and deletes the temporary report it writes before it exits.

```bash
claude plugin marketplace add jmlweb/hyntx
claude plugin install hyntx@hyntx
```

Then, in a session:

```text
/hyntx:hyntx                     # last 30 days, all projects
/hyntx:hyntx 14d                 # a period
/hyntx:hyntx 60d my-app          # a period and a project
```

The command is `/hyntx:hyntx` (plugin name, then skill name); Claude Code may also accept the short `/hyntx` when nothing else uses that name.

The plugin needs a Hyntx 4 analyzer. It uses, in order: the path in `HYNTX_CLI`, a built checkout that contains the plugin, a globally installed `hyntx` (version 4 or later), and finally `npx hyntx@4`. To try the plugin from a checkout before installing it, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#testing-the-plugin-locally).

## Interpretation engines and privacy

Reading the logs, computing metrics, detecting friction and ranking insights all happen on your machine and never modify Claude Code's files. Hyntx reads `~/.claude/projects/**/*.jsonl` and, to avoid suggesting permissions you already have, the `permissions` in your Claude Code settings files.

After that, an optional interpretation step asks a model to confirm or reject the heuristic episodes (corrections in particular are guessed from phrasing) and to write a short summary. What leaves your machine depends on the engine:

| Engine             | Flag              | What is sent, and where                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claude` (default) | none              | Sanitized excerpts of the report (counts, up to 8 insights, and up to 16 flagged episodes with their summary and a 220-character excerpt of the prompt, the previous prompt and the assistant's last text) go to Anthropic through `claude -p`, using your existing Claude Code login. It uses your plan or API usage like any other Claude Code request. A bare run prints a notice about this on stderr before the call. |
| `ollama`           | `--engine ollama` | A smaller selection (8 episodes, 140 characters each) goes to the Ollama server at `OLLAMA_HOST` (default `http://localhost:11434`). That stays on your machine unless you point `OLLAMA_HOST` elsewhere, in which case it leaves the machine and hyntx warns you.                                                                                                                                                         |
| none               | `--no-llm`        | Nothing is sent anywhere. You get the deterministic findings, and heuristic ones are marked as unconfirmed.                                                                                                                                                                                                                                                                                                                |

Sanitized means that API keys, tokens, credentials in URLs and on command lines, private keys, email addresses and common personal identifiers are replaced with `[REDACTED_<TYPE>]` before text is put in a report, sent to an engine or written to disk, and that terminal escape sequences are removed. Redaction is pattern-based: it catches well-known formats, not every possible secret, and it can hide harmless text that looks like an identifier. Treat a report like any file that may mention your projects.

If the engine is not available (no `claude` on the PATH, Ollama not running), Hyntx still prints the deterministic report and notes that interpretation was skipped. The model sees only some of the episodes, so a verdict covers part of an insight: an insight is hidden as dismissed only when every episode behind it was rejected, and otherwise it shows how many were reviewed.

The `/hyntx:hyntx` plugin always runs the analyzer with `--no-llm`. The findings it reads are then part of your Claude Code conversation, like any other tool output in that session.

## Options

| Flag               | Description                                                   |
| ------------------ | ------------------------------------------------------------- |
| `--days <n>`       | Analyze the last n days (default: 7)                          |
| `--from <date>`    | Start date: `YYYY-MM-DD`, `today` or `yesterday`              |
| `--to <date>`      | End date, inclusive (default: now)                            |
| `--project <name>` | Only projects whose name contains `<name>`                    |
| `--format <fmt>`   | `terminal` (default), `json`, `markdown`                      |
| `--output <file>`  | Write the report to a file instead of stdout                  |
| `--html [path]`    | Also write a self-contained HTML report (`hyntx-report.html`) |
| `--no-llm`         | Skip the interpretation step                                  |
| `--engine <name>`  | `claude` (default) or `ollama`                                |
| `--model <name>`   | Model for the interpretation engine                           |
| `--verbose`        | Debug logging on stderr                                       |
| `--help`, `-h`     | Show help                                                     |
| `--version`, `-v`  | Show version                                                  |

`--days` cannot be combined with `--from`/`--to`. With `--format json`, stdout contains only the report JSON; progress and logs go to stderr. Exit codes: `0` success, `1` error, `2` no logs or no sessions for the period.

Full reference: [docs/CLI.md](docs/CLI.md).

## What it writes to disk

- `~/.hyntx/daily.json`: one record per day with aggregate numbers only (sessions, prompts, tool calls, errors, tokens and similar). No prompt text, no file names. It is updated on every run that is not filtered by project (including plugin runs), and it is what keeps trends available after Claude Code prunes old logs.
- The files you ask for: `--output <file>` and `--html [path]`.
- Temporary files while writing (a uniquely named `*.tmp` next to the target, renamed into place). If `daily.json` cannot be parsed it is renamed to `daily.json.corrupt`.
- The plugin runner writes the full report to a private temp directory and deletes it before it exits.

Nothing else. Hyntx never writes to `~/.claude/` or to your projects. Only the plugin edits `CLAUDE.md`, settings or command files, one change at a time, after you approve each one.

Set `HYNTX_HOME` to move `~/.hyntx/`, and `HYNTX_CLAUDE_PROJECTS_DIR` to read logs from another location. `OLLAMA_HOST` selects the Ollama server for `--engine ollama`.

## Migrating from v3

Hyntx 4 does a different job, and most of v3 was removed rather than ported.

Removed:

- Prompt-quality analysis: anti-pattern detection, the rules engine and its issue taxonomy, Before/After prompt rewrites
- Cloud providers called with API keys (Anthropic, Google Gemini), the provider fallback chain and rate limiting
- The interactive setup wizard and all shell-config editing; there is nothing to configure
- All `HYNTX_*` provider, model and API-key environment variables, and `.hyntxrc.json` project configuration
- Watch mode (`--watch`), periodic reminders (`--check-reminder`), `--dry-run`, `--date` and `--analysis-mode`
- The MCP server (`--mcp-server`)
- The results cache and per-run history under `~/.hyntx/` (`results/` and `history/` can be deleted)
- Exit code `3`

Changed:

- Input is the whole session (turns, tool calls, results, interruptions, compactions), not just prompt text
- Ollama is opt-in (`--engine ollama`) instead of the default; the default engine is your own Claude Code login, and `--no-llm` needs no model
- `--format json` now prints a versioned `Report` object (`schemaVersion: 1`); the v3 JSON shape is gone
- The library entry point exports the v4 pipeline (`readSessions`, `buildReport`, `interpretReport`, renderers); the v3 API is gone

## Development

```bash
pnpm install
pnpm build
pnpm check && pnpm test
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [AGENTS.md](AGENTS.md).

## License

MIT
