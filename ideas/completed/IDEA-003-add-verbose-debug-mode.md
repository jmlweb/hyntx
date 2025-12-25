---
id: IDEA-003
title: Add Verbose/Debug Mode for Troubleshooting
status: completed
category: improvement
created_date: 2025-12-24
validated_date: 2025-12-24
completed_date: 2025-12-25
effort: low
impact: medium
rejection_reason: null
---

# Add Verbose/Debug Mode for Troubleshooting

## Description

The CLI currently provides minimal feedback when issues occur - spinners succeed or fail with brief messages, but there's no way to see internal details like: which log files are being scanned, how many entries were filtered out by sanitization, provider connection details, batching decisions in the analyzer, or schema validation warnings. A `--verbose` or `--debug` flag would output detailed operational information to stderr, enabling users to diagnose issues without modifying source code.

## Motivation

- **Troubleshooting**: Users have no visibility into why prompts aren't being found or why providers fail
- **Developer Experience**: Debugging requires adding console.log statements and rebuilding
- **Support Reduction**: Detailed logs help users self-diagnose common issues
- **Transparency**: Users can understand what the tool is actually doing under the hood
- **Confidence**: Seeing internal operations builds trust in the tool's correctness

## Proposed Solution

1. Add `--verbose` (or `-v`) CLI flag that enables detailed logging
2. Create a simple logger utility that respects the verbose flag
3. Output debug information to stderr (keeping stdout clean for results)
4. Add debug points at key operational stages:
   - Log file discovery and scanning
   - Schema validation (entries skipped, warnings)
   - Sanitization (secrets detected and redacted)
   - Provider connection and configuration
   - Batching decisions (batch sizes, count)
   - Analysis progress (per-batch timing)

Example output with `--verbose`:

```text
[DEBUG] Scanning /Users/x/.claude/projects/...
[DEBUG] Found 3 project directories
[DEBUG] Reading logs for date: 2025-01-20
[DEBUG] Parsed 150 log entries, 45 are user prompts
[DEBUG] Sanitizer: redacted 2 API keys, 1 password
[DEBUG] Connecting to Ollama at http://localhost:11434
[DEBUG] Model: gemma3:4b, available: true
[DEBUG] Analyzer: 45 prompts in 3 batches (15 each)
[DEBUG] Batch 1/3 completed in 2.3s
...
```

## Acceptance Criteria

- [ ] `--verbose` or `-v` flag enables debug output
- [ ] Debug output goes to stderr (stdout remains clean)
- [ ] Log reader reports files scanned and entries found
- [ ] Sanitizer reports number of secrets redacted
- [ ] Provider reports connection details
- [ ] Analyzer reports batching decisions and timing
- [ ] No debug output when flag is not set

## Technical Considerations

- Use a simple logger module that checks a global/context verbose flag
- Consider using `DEBUG=hyntx:*` environment variable as alternative (debug package pattern)
- Keep debug messages concise but informative
- Avoid logging sensitive information even in debug mode
- Consider log levels: `--verbose` for info, `--debug` for detailed tracing

## Validation Notes

Accepted during revalidation on 2025-12-24. Complements existing `cli-completo.md` task with detailed implementation specification. Quick win that improves debugging capabilities with low effort and medium impact. Should coordinate with centralized logging system (IDEA-004) when implemented.

## Related Tasks

- `add-verbose-debug-mode.md` - P2, Phase 3 (task file removed after completion)
