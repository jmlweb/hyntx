# Architecture

Hyntx is a pipeline from Claude Code session logs to a `Report`. Everything up to the report is deterministic; a model is only involved in one optional step at the end.

```text
~/.claude/projects/**/*.jsonl
        |
        v
  session-reader   streams JSONL into Session objects (raw, in memory)
        |
        +--> metrics     totals, per project, per day, per session
        +--> friction    Episodes: moments that cost the user something
        |        |
        v        v
      insights           ranked Insights with evidence and one action each
        |
        v
      report             the Report, with every string sanitized
        |
        v
  engines (optional)     claude -p or Ollama: verdicts per episode, summary
        |
        v
  renderers              terminal, markdown, JSON, self-contained HTML
```

The Claude Code plugin sits beside the last two steps: it runs the pipeline with `--format json --no-llm` and the Claude in the user's session does the interpretation and applies actions.

## Two data layers

`src/types/index.ts` defines both and is the source of truth.

1. **Raw session model** (`Session`, `Turn`, `ToolCall`, ...). Produced by the session reader, held in memory, may contain unsanitized text. Never serialized.
2. **`Report`**. Serializable and sanitized. Renderers, engines and the plugin only ever see this layer. It carries `schemaVersion`; fields are added without bumping it, and consumers must ignore fields they do not know.

## Modules

| Path                         | Responsibility                                                           | IO                       |
| ---------------------------- | ------------------------------------------------------------------------ | ------------------------ |
| `src/cli.ts`                 | Parse arguments, orchestrate, write output, set the exit code            | yes                      |
| `src/cli-args.ts`            | Period resolution and argument helpers                                   | no                       |
| `src/core/session-reader.ts` | Stream logs and subagent sidechains into sessions; classify user records | reads logs               |
| `src/core/metrics.ts`        | Aggregates and distributions                                             | no                       |
| `src/core/friction.ts`       | Friction detectors and prompt-trait correlations                         | no                       |
| `src/core/tool-errors.ts`    | Tool error classification for the detectors                              | no                       |
| `src/core/insights.ts`       | Group episodes into insights, attach evidence and actions, rank          | no                       |
| `src/core/permissions.ts`    | Existing allow rules, so they are not suggested again                    | reads settings           |
| `src/core/report.ts`         | Assemble the `Report`, compute data quality, final sanitization          | no                       |
| `src/core/sanitizer.ts`      | Redaction                                                                | no                       |
| `src/core/history.ts`        | Daily aggregates that outlive log retention                              | `~/.hyntx/daily.json`    |
| `src/engines/`               | Optional interpretation                                                  | subprocess or local HTTP |
| `src/report/`                | Renderers                                                                | no                       |
| `src/index.ts`               | Library API: the same functions the CLI composes                         | no                       |
| `skills/hyntx/`              | Plugin skill and its analyzer runner                                     | runs the CLI             |

## Design decisions

**Outcomes, not prompt text.** The unit of analysis is what happened in a session: tool results, interruptions, denials, edits, compactions and what the user typed next. Prompt wording is only used as a signal next to those.

**Deterministic core.** The same logs produce the same report. An insight exists only if its evidence clears a minimum bar, and with little data the result is empty and says so (`dataQuality.enoughData`). There is no price table: token counts are reported, dollar figures are not, because prices go stale.

**Honest heuristics.** Detectors that guess (corrections are inferred from phrasing) carry a confidence below 1 and are labelled as unconfirmed until an interpretation step, or the plugin, confirms them.

**Tolerant parsing.** The log format is not a public contract and changes between Claude Code versions. Unknown record types and malformed lines are counted and skipped, never fatal, and the counts are reported in `dataQuality`.

**Interpretation is optional and cannot break the run.** An engine receives the sanitized report and returns verdicts and a summary. If it is missing or fails, the deterministic report is returned with a note.

**Sanitized by contract.** Detectors sanitize what they put in episodes, and `sanitizeReport` passes over every free-text string of the finished report, including engine output. See the security rules in [AGENTS.md](../AGENTS.md).

**Read-only.** The CLI reads logs and settings and writes only `~/.hyntx/daily.json` and the files named by `--output` and `--html`. Applying an action is the plugin's job, with one confirmation per change.

**Trends beyond retention.** Claude Code deletes old session logs. Each unfiltered run merges per-day aggregates into `~/.hyntx/daily.json`; a stored day is only replaced by a fresh one that saw at least as much activity, so a partly pruned day does not overwrite a complete one. Project-filtered runs neither read nor write the history.

## Plugin

The repository is a Claude Code plugin and its own single-plugin marketplace (`.claude-plugin/`). The skill in `skills/hyntx/SKILL.md` is a prompt: it tells the session's Claude how to run the analyzer, how to judge episodes against their context, how to present findings and how to apply actions safely.

`skills/hyntx/scripts/run-analyzer.mjs` finds an analyzer of the right major version (`HYNTX_CLI`, the checkout the skill lives in, a global `hyntx`, then `npx hyntx@4`), writes the full report to a private temp directory, reads it back, deletes the directory and prints a digest without the per-day and per-session series. The digest drops fields by name and passes everything else through, so new report fields reach the skill without changes to the script.
