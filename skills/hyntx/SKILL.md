---
name: hyntx
description: Analyze the user's Claude Code session logs for recurring friction (corrections, interruptions, tool-error loops, denied tools, rework, repeated instructions, read-only commands approved over and over) and offer to apply the fix to CLAUDE.md, settings.json or a slash command. Use when the user asks how their Claude Code sessions are going, where they lose time, or what to add to CLAUDE.md or their permissions based on real usage.
argument-hint: '[period, e.g. 14d or 2026-09-01..2026-09-30] [project name]'
allowed-tools: Bash(node ${CLAUDE_SKILL_DIR}/scripts/run-analyzer.mjs *)
---

# Hyntx: session insights

Hyntx reads the user's Claude Code session logs on this machine and detects, with deterministic heuristics, the moments where a session visibly cost them something. You are the interpretation layer on top of that: the analyzer finds candidates and counts them, you decide which are real, explain them, and help the user fix the cause.

The goal is a small number of changes the user actually makes. A report they skim and close is a failure, and so is a CLAUDE.md that grows a rule for every one-off incident.

## 1. Run the analyzer

```bash
node ${CLAUDE_SKILL_DIR}/scripts/run-analyzer.mjs --days 30
```

The script only accepts `--days <n>`, `--from <YYYY-MM-DD>`, `--to <YYYY-MM-DD>` and `--project <name>`. Translate what the user typed into those:

- a period such as `14`, `14d`, "last two weeks" becomes `--days 14`; a range such as `2026-09-01..2026-09-30` becomes `--from` and `--to`
- anything else is a project name: `--project <name>` (a case-insensitive substring of the project name)
- with no period, use `--days 30`. Friction patterns need volume, and Claude Code deletes session logs after 30 days by default, so that is normally everything there is.

The run is local and read-only, and it makes no model call: it is always `--no-llm`, because you do the interpretation.

Exit codes: `2` means there are no logs or no sessions for that period and filter; say so and suggest a longer period or no project filter. `3` means no Hyntx v4 analyzer could be run; relay the fix the script prints and stop. Do not fall back to reading the logs yourself.

## 2. What you get back

The script prints a digest of the analyzer's `Report` as JSON. Every string in it has already been sanitized (secrets and personal data appear as `[REDACTED_…]`). The parts that matter:

- `period`, `filters.project`: what was analyzed.
- `dataQuality`: `sessionsInPeriod`, `typedPrompts`, `enoughData` and `notes` (caveats written by the analyzer).
- `metrics.overall`: totals for sessions, prompts, tool calls, errors, denials, interruptions, compactions, tokens, models.
- `insights[]`: ranked findings, highest `score` first. Each has `kind`, `severity`, `title`, `finding`, `confidence` (0-1), `evidence` (`count`, `sessions`, `projects`, `outOf`, `examples[]` with `project`, `date`, `quote`, `note`), `episodeIds[]` and one `action`.
- `episodes[]`: the individual moments behind the insights. Each has `id`, `type`, `project`, `timestamp`, `confidence`, `count`, `prompt` (what the user typed, if anything), `summary`, and `context`: `previousPrompt` (what they had asked before), `assistantExcerpt` (what Claude had just said), `tools`, and `detail` (type-specific facts: command, file, denial reason, counts).
- `promptTraits[]`: correlations between prompt features and outcomes, with group sizes and a `significant` flag.
- `digest`: `reportFile` is the full report on disk; `omitted` lists what was left out of the digest (per-day and per-session series, and unreferenced episodes when there are many). Read from `reportFile` only if you need one of those.

`action.kind` is one of:

| kind               | fields                             | meaning                             |
| ------------------ | ---------------------------------- | ----------------------------------- |
| `claude-md-rule`   | `scope`, `project`, `file`, `text` | a rule to add to a CLAUDE.md        |
| `permission-allow` | `patterns[]`, `file`, `snippet`    | allow rules for a settings file     |
| `slash-command`    | `name`, `file`, `content`          | a reusable prompt to save as a file |
| `prompt-habit`     | `habit`, `before`, `after`         | a change in how the user prompts    |
| `workflow`         | `suggestion`, `steps[]`            | a change in how they work           |

The report is versioned (`schemaVersion`, currently 1) and grows by adding fields. Use what you recognize and ignore the rest; an insight or action kind you do not recognize should be described from its own text, not dropped. If `schemaVersion` is higher than 1, say that the plugin may be older than the analyzer and carry on carefully.

## 3. Decide what is real

The detectors are heuristics. Confidence values are honest but they are not verdicts, and nothing has confirmed them before you. For each insight, read the episodes it points to and ask whether a person looking at that moment would agree it was friction:

- **Corrections** are detected from phrasing. "No, use pnpm" after Claude ran npm is a correction. "No problem, go ahead" or a "no" that answers Claude's question is not. `previousPrompt` and `assistantExcerpt` tell you which.
- **Interruptions** can be the user changing their mind or stopping a long run they no longer needed. They are friction when the same thing keeps getting interrupted.
- **Tool-error loops** are real when the same cause repeats. A test suite failing several times while Claude fixes a bug is the job, not friction.
- **Denials** by a hook, a permission rule or the auto-mode classifier are the user's own guardrails working. The friction is Claude walking into them repeatedly; the fix is never to weaken the guardrail.
- **Repeated instructions** are real when the user re-explains a fact or preference across sessions. The same short command typed often ("continue", "run the tests") is not.
- **Prompt traits** are correlations. Mention one only when `significant` is true, and present it as a correlation with its group sizes.

Drop what does not hold up, and say in one line what you dropped and why, so the user can see the filter working. If an insight survives only in part, restate its numbers for the episodes you kept rather than repeating the analyzer's count.

If `dataQuality.enoughData` is false, or nothing survives, say that plainly: how many sessions and prompts there were, and that this is too little to conclude anything. Offer a longer period. Do not pad the answer with generic advice about prompting; an empty result is a legitimate result.

## 4. Present

Lead with one or two sentences on the period: sessions, typed prompts, and the single most important thing you found. Then the insights that matter, usually two to four and never more than five, most valuable first. For each:

- what happens, with the real numbers (how often, in how many sessions, in which projects)
- one or two pieces of evidence, quoted from `evidence.examples` or the episode, with project and date
- what you propose to change, concretely

Write for the user, not for the schema: no ids, no confidence decimals, no field names. Keep quotes short. Metrics belong in the answer only where they support a finding.

Treat the analyzer's `action` as a draft. Rule text generated from a template often just restates the incident ("`cat x` failed 7 times"). Rewrite it as the durable instruction that would have prevented the incident, short and specific, in the voice of the file it is going into. If you cannot phrase a rule that would still make sense in three months, the right action is probably a habit or nothing at all.

## 5. Offer to apply

After presenting, ask which of the proposed changes the user wants. Then handle them one at a time: read the target, show the exact change (file path plus the lines to add, or a diff), and wait for a yes before writing. A yes covers that one change only. Never write anything the user has not seen, and if the session is not interactive, present the changes and apply none.

Finding the right file:

- **Project rules.** `scope: project` names a project, not a path. If it is the project of the current working directory, the target is its `CLAUDE.md`; if that file only imports or defers to another (commonly `AGENTS.md`), put the rule where the project's rules actually live. If the insight is about a different project, do not guess its location: ask for the path, or suggest running `/hyntx` from that project.
- **User rules.** `scope: user` goes to `~/.claude/CLAUDE.md`.
- **Permissions.** Default to the file the action names (normally `~/.claude/settings.json`); if the commands only occur in one project, offer that project's `.claude/settings.json` instead. Merge the patterns into the existing `permissions.allow` array and leave every other key untouched; the `snippet` is a fragment to merge, not a file to write.
- **Slash commands.** `file` is a directory (`.claude/commands/` or `~/.claude/commands/`); the file is `<name>.md` inside it.

Before proposing a write, check that it is not already there:

- A rule is a duplicate when the file already says the same thing in any words. Skip it and tell the user it is already covered; if the existing rule is evidently not working, propose sharpening that rule instead of adding a second one.
- A permission is a duplicate when an existing allow rule in user, project or local settings already covers the command. If a `deny` or `ask` rule covers it, the user decided that on purpose: do not propose the allow.
- Only propose allow rules for commands that cannot change anything. Check the patterns yourself; if a pattern would also match a variant that writes, deletes or executes (`find -exec`, `sed -i`, output redirection), narrow it or leave it out.
- If a slash command file with that name exists, show it and ask whether to rename or replace.

`prompt-habit` and `workflow` actions have nothing to write. Give the habit with its before/after example, or the steps, and leave it there.

Finish with a short list of what was applied and where, and what was declined. Rules in CLAUDE.md and settings changes take effect in new sessions.
