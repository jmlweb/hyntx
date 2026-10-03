# Specifications

The types in `src/types/index.ts` are authoritative. This document explains what they mean and which rules the pipeline follows. Thresholds are exported constants; the names are given here so the values can be read from the code.

## Input

Claude Code session logs: `~/.claude/projects/<project-dir>/**/*.jsonl`, including nested subagent (sidechain) files. Override the root with `HYNTX_CLAUDE_PROJECTS_DIR`.

The session reader:

- filters by period and by project (case-insensitive substring of the project name or directory)
- decides what each `user` record really is: a typed prompt, an accepted suggestion, a tool result, injected context, an interruption marker or a slash command
- pairs tool calls with their results and classifies denials by source: `user`, `rule`, `classifier` (auto mode) or `hook`
- drops duplicate records from resumed sessions
- counts, and skips, unknown record types and malformed lines
- skips (and counts) a log file that cannot be read mid-run instead of failing the run
- leaves out sessions with no typed prompt, tool call or reply (for example only `/clear`) and reports how many
- sanitizes prompt, command, tool-result and assistant text first and truncates afterwards, so a secret cut by the length limit leaves no fragment; for assistant text it keeps the end, where a closing question shows
- counts a turn as a typed prompt only if it contains words: `[Image #3]` or `[Pasted text #1 +20 lines]` alone do not count

Existing `allow`, `deny` and `ask` permission rules are also read from Claude Code settings files (user and per-project `settings.json` / `settings.local.json`), only to avoid suggesting a rule that already exists or that a deny or ask rule overrides. Managed (enterprise) settings are not read.

## Report

```typescript
type Report = {
  schemaVersion: 1;
  generator: { name: 'hyntx'; version: string };
  generatedAt: string;
  period: { from: string; to: string; days: number }; // local dates, inclusive
  filters: { project: string | null };
  dataQuality: DataQuality;
  metrics: Metrics;
  daily: DailyPoint[]; // stored history merged with this run
  episodes: Episode[];
  promptTraits: PromptTraitFinding[];
  insights: Insight[];
  insightReviews: InsightReview[]; // one per insight; the single source for what is confirmed or dismissed
  interpretation: Interpretation | null;
};
```

Rules of the contract:

- Free-text strings are passed through the sanitizer and stripped of terminal escape sequences and control characters. Identifier fields (ids, timestamps, versions) are not. Sanitization is pattern-based; see below for its limits.
- Fields are added without changing `schemaVersion`; a breaking change increments it. Consumers ignore what they do not know.
- `--format json` prints exactly this object.

### Data quality

`dataQuality` reports what was read (files, records, skipped and unknown records, Claude Code versions seen), `sessionsInPeriod`, `typedPrompts`, and:

- `enoughData`: false below `MIN_SESSIONS_FOR_FINDINGS` sessions or `MIN_PROMPTS_FOR_FINDINGS` typed prompts
- `filesFailed`, `emptySessionsSkipped`: log files that could not be read and sessions left out as empty
- `notes`: human-readable caveats, including skipped records, unreadable files, an unreadable history file, unconfirmed heuristics and engine failures

### Metrics

`metrics.overall`, `metrics.byProject[]` and `metrics.byDay[]` share one shape: sessions, turns, typed prompts, tool calls with errors and denials per tool, token totals with cache-hit ratio, model mix, subagent use, permission modes, plan mode, slash commands, interruptions, compactions, API errors and session length distributions. `metrics.sessions[]` has one row per session and `metrics.activity` the prompts per hour and weekday.

Active minutes exclude idle gaps longer than 10 minutes. Tokens are counts; there are no cost figures.

### Episodes

An episode is one moment where the workflow visibly cost the user something.

| Type                        | Detected when                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `interruption`              | The user stopped Claude mid-turn                                                                                                                                                                 |
| `correction`                | A prompt reads like pushback on the previous turn (heuristic, scored; the strong tier needs a previous turn that did or claimed something, and a bare "no" answering a question does not count)  |
| `tool-error-loop`           | The same command or tool signature keeps failing in a session                                                                                                                                    |
| `tool-denied`               | A tool call was rejected by the user, a permission rule, the auto-mode classifier or a hook                                                                                                      |
| `rework`                    | One file was edited `REWORK_MIN_EDITS`+ times across `REWORK_MIN_TURNS` of the user's prompts, or across two with a tool failure in between; many edits inside one prompt is ordinary authoring  |
| `context-pressure`          | Compactions, or sessions beyond `LONG_SESSION_TURNS` typed turns                                                                                                                                 |
| `repeated-instruction`      | Similar prompts recur across sessions (`SIMILARITY_THRESHOLD`)                                                                                                                                   |
| `frequent-readonly-command` | A command from a short safe list (`SAFE_RULE_KEYS`) ran often in permission modes that can prompt (`READONLY_MIN_RUNS`). Logs do not record approvals, so this counts runs, not prompts answered |
| `model-switch`              | A mid-session model change that forced a large cache rewrite                                                                                                                                     |

Each episode has an `id`, `confidence` (0-1), `count` (occurrences collapsed into it), the sanitized triggering `prompt` when there is one, a `summary`, and `context`: the previous prompt, the tail of the assistant's last text, tool counts for the turn and type-specific `detail`. New types may be added.

`promptTraits[]` are exploratory correlations between a prompt feature and an outcome, with both group sizes. `meetsThreshold` is true when both groups reach `MIN_TRAIT_SAMPLE` and the gap is large; it is not a statistical test. They are never turned into insights or actions, because a ratio on a handful of replies ("done", "wait") does not tell anyone what to change.

### Insights

`generateInsights` groups episodes into findings and ranks them by `score`.

```typescript
type Insight = {
  id: string;
  kind: InsightKind;
  title: string;
  severity: 'high' | 'medium' | 'low';
  finding: string; // one line with real numbers
  evidence: {
    count: number;
    sessions: number;
    projects: string[];
    outOf: number | null;
    examples: { project; date; sessionId; quote; note }[];
  };
  action: InsightAction;
  confidence: number;
  score: number;
  episodeIds: string[];
};
```

An insight is produced only when its evidence clears a minimum bar. Each has exactly one action:

| `action.kind`      | Fields                             | Applied as                                                 |
| ------------------ | ---------------------------------- | ---------------------------------------------------------- |
| `claude-md-rule`   | `scope`, `project`, `file`, `text` | Lines appended to a project or user `CLAUDE.md`            |
| `permission-allow` | `patterns`, `file`, `snippet`      | Entries merged into `permissions.allow` of a settings file |
| `slash-command`    | `name`, `file`, `content`          | A new command file                                         |
| `prompt-habit`     | `habit`, `before`, `after`         | Nothing to write; a habit with an example                  |
| `workflow`         | `suggestion`, `steps`              | Nothing to write; steps to follow                          |

Permission suggestions come only from a short list of `<binary> <subcommand>` prefixes (`SAFE_RULE_KEYS`: read-only `gh` views, `docker ps`/`images`, `pnpm`/`npm` listing) whose every invocation, with any arguments, is meant to be harmless. Plain read-only commands such as `ls`, `cat`, `grep` and read-only `git` are already run by Claude Code without a prompt and are never suggested. A suggestion is skipped if an `allow` rule already covers it or a `deny`/`ask` rule touches it. This is a conservative heuristic, not a proof: review a pattern before you paste it. Repeated-instruction actions are emitted only when the prompt text is intact (not shortened, not redacted): a slash-command file holds the complete prompt and a quoted `description`, and a task-like prompt never becomes a CLAUDE.md rule; otherwise the action is a `workflow` explaining how to save it. The CLI only prints actions. The plugin applies them after confirmation.

### Interpretation

Filled by an engine, otherwise `null`:

```typescript
type Interpretation = {
  engine: string;
  model: string | null;
  generatedAt: string;
  summary: string;
  episodeVerdicts: {
    episodeId;
    verdict: 'confirmed' | 'rejected' | 'unclear';
    note;
  }[];
  recommendations: { title; body; basedOn: string[] }[];
};
```

Engines get a sanitized selection from the report and their output is sanitized again. `null` from an engine or an exception becomes a `dataQuality` note; the run still succeeds.

What is selected (`selectEvidence`): aggregate stats (period, counts of sessions, prompts, tool calls, errors, denials, interruptions, compactions, cache-hit percent); up to 8 insights (5 for Ollama) with title, severity, finding and action kind; and up to 16 episodes (8 for Ollama) that need a verdict, each with its summary, project, a short excerpt (220 characters, 140 for Ollama) of the triggering prompt, the previous prompt and the assistant's last text, and a few facts such as file name or error class. Full commands, tool output beyond those excerpts and the other episodes are not sent. Because only a subset is sent, verdicts cover only part of the episodes: an insight is hidden as dismissed only when every episode behind it was reviewed and rejected, and otherwise its coverage ("reviewed 3 of 9") is shown.

`insightReviews[]` holds, per insight, `state` (`confirmed`, `dismissed` or `unverified`), `episodes`, `reviewed`, `confirmed`, `rejected` and `unclear`. The terminal, markdown and HTML reports and the plugin digest all use it, so they agree on what is hidden.

| Engine   | Transport                                 | Data leaves the machine |
| -------- | ----------------------------------------- | ----------------------- |
| `claude` | `claude -p`, the user's Claude Code login | Yes, to Anthropic       |
| `ollama` | Local Ollama server                       | No                      |
| none     | `--no-llm`                                | No                      |

## Sanitization

`sanitize(text)` replaces matches with `[REDACTED_<TYPE>]`: provider API keys and tokens (OpenAI, Anthropic, AWS, GitHub, Slack, Google, Stripe, JWT), bearer tokens, values assigned to secret-looking names, credentials in URLs, PEM private keys, emails, and personal identifiers such as phone numbers, card numbers, national IDs, IP and MAC addresses and postal addresses.

It is pattern-based. It can miss a secret in an unknown format and it can redact something harmless that looks like an identifier. Besides well-known token formats it covers URL credentials for any scheme, `--password`/`-p`/`curl -u` style arguments, `Authorization` and `Cookie` headers, quoted secret values, and unterminated PEM blocks. Greetings of the form "Hey Claude", version numbers, commit ids next to git words and `ssh user@host` targets are kept readable (the account name in an ssh target is still redacted). When readability and secrecy conflict, secrecy wins.

## Persistence

`~/.hyntx/daily.json` (override the directory with `HYNTX_HOME`):

```typescript
type HistoryFile = { schemaVersion: 1; days: DailyPoint[] };
```

A `DailyPoint` holds counts and token totals for one local day. No text. Written on every run without `--project` through a uniquely named temp file and an atomic rename, after re-reading and merging the file, so two runs at the same time (CLI and plugin) do not corrupt it. A file that cannot be parsed is renamed to `daily.json.corrupt` and the report says so in `dataQuality.notes`.

## Plugin skill

`/hyntx:hyntx [period] [project]` runs `skills/hyntx/scripts/run-analyzer.mjs`, which accepts only `--days`, `--from`, `--to`, `--project` and always adds `--format json --no-llm`. It validates argument values (no shell is ever involved), writes the full report to a private temp directory, deletes that directory before exiting, and prints the report without `daily`, `metrics.byDay`, `metrics.byProject` and `metrics.sessions`, plus a `digest` object naming the analyzer used and what was omitted. With more than 60 episodes, only those referenced by an insight are printed. The command is `/hyntx:hyntx` (plugin name, then skill name).

Runner exit codes: `0` ok, `1` error, `2` no logs or sessions, `3` no v4 analyzer available.
