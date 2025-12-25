---
id: IDEA-015
title: Interactive Watch Mode for Real-Time Prompt Analysis
status: accepted
category: feature
created_date: 2025-12-25
validated_date: 2025-12-25
effort: medium
impact: high
rejection_reason: null
---

# Interactive Watch Mode for Real-Time Prompt Analysis

## Description

Currently, Hyntx only supports retrospective analysis of Claude Code prompts at the end of the day or for specific date ranges. A watch mode would enable users to get immediate feedback on their prompts as they work, enhancing the learning loop. The feature would monitor the Claude logs directory for changes and trigger analysis on new prompts, showing quick feedback in the terminal without interrupting the workflow. This creates a tighter feedback loop for users learning to write better prompts.

## Motivation

- **Immediate feedback**: Users currently only get analysis after-the-fact, missing the opportunity to learn and improve in real-time
- **Enhanced learning**: A tighter feedback loop helps users internalize better prompting patterns faster
- **Active development support**: Developers often work in long sessions where real-time feedback would be more valuable than end-of-day retrospectives
- **Reduced context switching**: Instead of running `hyntx` manually, the tool continuously provides insights
- **Habit formation**: Seeing feedback immediately after writing a prompt helps form better prompting habits

## Proposed Solution

Add a `--watch` flag to the CLI that:

1. **File system monitoring**: Use Node.js `fs.watch` or a library like `chokidar` to monitor `~/.claude/projects/` for new log entries
2. **Incremental analysis**: Track which prompts have already been analyzed to avoid re-processing
3. **Lightweight output**: Show condensed, non-intrusive feedback in the terminal (e.g., a single-line summary or minimal pattern detection)
4. **Batching**: Optionally batch multiple prompts before triggering analysis to reduce API costs
5. **Quiet mode**: Option to only notify on significant issues (e.g., high-severity patterns)

### Example Usage

```bash
# Start watching for new prompts
hyntx --watch

# Watch with minimal output (only high-severity issues)
hyntx --watch --quiet

# Watch with custom batch interval (analyze every 5 prompts)
hyntx --watch --batch 5
```

### Example Output

```text
🔍 Watching for new prompts... (Ctrl+C to stop)

[14:32:15] New prompt detected in project: my-app
           ⚠️ Missing context: Consider adding error messages or stack traces

[14:35:42] New prompt detected in project: my-app
           ✅ Good prompt structure

[14:38:20] New prompt detected in project: backend-api
           ⚠️ Vague instruction: "fix the bug" - be more specific about which bug
```

## Acceptance Criteria

- [ ] `--watch` flag starts file system monitoring for Claude logs
- [ ] New prompts are detected and analyzed incrementally
- [ ] Output is concise and non-intrusive (single-line or minimal)
- [ ] Previously analyzed prompts are not re-processed
- [ ] Graceful shutdown with Ctrl+C
- [ ] Works with project filtering (`--watch --project my-app`)
- [ ] Optional `--quiet` mode for high-severity issues only
- [ ] Tests cover watch mode initialization and cleanup

## Technical Considerations

- **File watching library**: Consider `chokidar` for cross-platform file watching reliability, or use native `fs.watch` to avoid adding dependencies
- **State management**: Need to track analyzed prompts (in-memory or temp file) to avoid duplicates
- **API costs**: Frequent analysis could increase API usage; batching or local Ollama recommendation helps
- **Terminal UI**: Consider using `ora` spinners or `chalk` for clear, non-intrusive output
- **Signal handling**: Proper cleanup on SIGINT/SIGTERM to stop file watchers
- **Debouncing**: Log files may be written incrementally; debounce to avoid multiple triggers

## Validation Notes

Accepted on 2025-12-25. This feature aligns strongly with the project's core goal of helping users improve their prompting skills. Real-time feedback creates a tighter learning loop than retrospective analysis alone. The project is in maintenance mode with all 43 planned tasks completed, making this an ideal time for new feature development. Technical implementation is feasible using existing infrastructure (log-reader, providers, reporter) with additions for file watching and incremental state tracking. API cost concerns are mitigated by the batching option and local Ollama recommendation.

## Related Tasks

{Links to backlog tasks created from this idea - filled by feed-backlog}
