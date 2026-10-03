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

Existing permission allow rules are also read from Claude Code settings files, only to avoid suggesting them again.

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
  interpretation: Interpretation | null;
};
```

Rules of the contract:

- Every free-text string is sanitized.
- Fields are added without changing `schemaVersion`; a breaking change increments it. Consumers ignore what they do not know.
- `--format json` prints exactly this object.

### Data quality

`dataQuality` reports what was read (files, records, skipped and unknown records, Claude Code versions seen), `sessionsInPeriod`, `typedPrompts`, and:

- `enoughData`: false below `MIN_SESSIONS_FOR_FINDINGS` sessions or `MIN_PROMPTS_FOR_FINDINGS` typed prompts
- `notes`: human-readable caveats, including skipped records, unconfirmed heuristics and engine failures

### Metrics

`metrics.overall`, `metrics.byProject[]` and `metrics.byDay[]` share one shape: sessions, turns, typed prompts, tool calls with errors and denials per tool, token totals with cache-hit ratio, model mix, subagent use, permission modes, plan mode, slash commands, interruptions, compactions, API errors and session length distributions. `metrics.sessions[]` has one row per session and `metrics.activity` the prompts per hour and weekday.

Active minutes exclude idle gaps longer than 10 minutes. Tokens are counts; there are no cost figures.

### Episodes

An episode is one moment where the workflow visibly cost the user something.

| Type                        | Detected when                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `interruption`              | The user stopped Claude mid-turn                                                            |
| `correction`                | A prompt reads like pushback on the previous turn (heuristic, scored)                       |
| `tool-error-loop`           | The same command or tool signature keeps failing in a session                               |
| `tool-denied`               | A tool call was rejected by the user, a permission rule, the auto-mode classifier or a hook |
| `rework`                    | One file was edited many times in a session (`REWORK_MIN_EDITS`)                            |
| `context-pressure`          | Compactions, or sessions beyond `LONG_SESSION_TURNS` / `LONG_SESSION_MESSAGES`              |
| `repeated-instruction`      | Similar prompts recur across sessions (`SIMILARITY_THRESHOLD`)                              |
| `frequent-readonly-command` | A read-only shell command ran often while permission prompts were on (`READONLY_MIN_RUNS`)  |
| `model-switch`              | A mid-session model change that forced a large cache rewrite                                |

Each episode has an `id`, `confidence` (0-1), `count` (occurrences collapsed into it), the sanitized triggering `prompt` when there is one, a `summary`, and `context`: the previous prompt, the tail of the assistant's last text, tool counts for the turn and type-specific `detail`. New types may be added.

`promptTraits[]` are correlations between a prompt feature and an outcome, with both group sizes. `significant` is true only when both groups reach `MIN_TRAIT_SAMPLE` and the gap is material. They are correlations and are presented as such.

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

Permission suggestions are limited to commands recognized as read-only, and rules that are already allowed are not suggested. The CLI only prints actions. The plugin applies them after confirmation.

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

Engines get the sanitized report and their output is sanitized again. `null` from an engine or an exception becomes a `dataQuality` note; the run still succeeds.

| Engine   | Transport                                 | Data leaves the machine |
| -------- | ----------------------------------------- | ----------------------- |
| `claude` | `claude -p`, the user's Claude Code login | Yes, to Anthropic       |
| `ollama` | Local Ollama server                       | No                      |
| none     | `--no-llm`                                | No                      |

## Sanitization

`sanitize(text)` replaces matches with `[REDACTED_<TYPE>]`: provider API keys and tokens (OpenAI, Anthropic, AWS, GitHub, Slack, Google, Stripe, JWT), bearer tokens, values assigned to secret-looking names, credentials in URLs, PEM private keys, emails, and personal identifiers such as phone numbers, card numbers, national IDs, IP and MAC addresses and postal addresses.

It is pattern-based. It can miss a secret in an unknown format and it can redact something harmless that looks like an identifier.

## Persistence

`~/.hyntx/daily.json` (override the directory with `HYNTX_HOME`):

```typescript
type HistoryFile = { schemaVersion: 1; days: DailyPoint[] };
```

A `DailyPoint` holds counts and token totals for one local day. No text. Written atomically (temp file, then rename) on every run without `--project`.

## Plugin skill

`/hyntx [period] [project]` runs `skills/hyntx/scripts/run-analyzer.mjs`, which accepts only `--days`, `--from`, `--to`, `--project` and always adds `--format json --no-llm`. It prints the report without `daily`, `metrics.byDay`, `metrics.byProject` and `metrics.sessions`, plus a `digest` object naming the full report file and what was omitted. With more than 60 episodes, only those referenced by an insight are printed.

Runner exit codes: `0` ok, `1` error, `2` no logs or sessions, `3` no v4 analyzer available.
