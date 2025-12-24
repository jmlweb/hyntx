# Add Verbose/Debug Mode

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: cli-entry-basico.md
- **Estimation**: TBD
- **Source**: IDEA-003 - Add Verbose/Debug Mode for Troubleshooting

## Description

The CLI currently provides minimal feedback when issues occur - spinners succeed or fail with brief messages, but there's no way to see internal details like: which log files are being scanned, how many entries were filtered out by sanitization, provider connection details, batching decisions in the analyzer, or schema validation warnings.

A `--verbose` or `--debug` flag would output detailed operational information to stderr, enabling users to diagnose issues without modifying source code.

## Objective

Provide visibility into internal operations for troubleshooting and debugging without requiring source code modifications.

## Scope

- Includes:
  - Add `--verbose` (or `-v`) CLI flag
  - Create simple logger utility respecting verbose flag
  - Output debug information to stderr (keeping stdout clean)
  - Add debug points at key operational stages
- Excludes:
  - Multiple log levels (info/debug/trace) - keep it simple
  - Log file output
  - Environment variable control (DEBUG=hyntx:\*)

## Files to Create/Modify

- `src/index.ts` - Add `--verbose` CLI flag
- `src/utils/logger.ts` - Create logger utility (or integrate with IDEA-004 if implemented first)
- `src/core/log-reader.ts` - Add debug logging
- `src/core/sanitizer.ts` - Add debug logging
- `src/core/analyzer.ts` - Add debug logging
- `src/providers/*.ts` - Add debug logging

## Implementation

1. Add `--verbose` or `-v` flag to CLI argument parser

2. Create logger utility:

   ```typescript
   // src/utils/logger.ts
   let verboseEnabled = false;

   export const setVerbose = (enabled: boolean) => {
     verboseEnabled = enabled;
   };

   export const debug = (message: string) => {
     if (verboseEnabled) {
       process.stderr.write(`[DEBUG] ${message}\n`);
     }
   };
   ```

3. Add debug points at key stages:
   - Log file discovery and scanning
   - Schema validation (entries skipped, warnings)
   - Sanitization (secrets detected and redacted)
   - Provider connection and configuration
   - Batching decisions (batch sizes, count)
   - Analysis progress (per-batch timing)

Example output:

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
```

## Acceptance Criteria

- [ ] `--verbose` or `-v` flag enables debug output
- [ ] Debug output goes to stderr (stdout remains clean)
- [ ] Log reader reports files scanned and entries found
- [ ] Sanitizer reports number of secrets redacted
- [ ] Provider reports connection details
- [ ] Analyzer reports batching decisions and timing
- [ ] No debug output when flag is not set
- [ ] Works correctly with `--format json` (no pollution)

## Test Cases

- Test verbose flag enables debug output
- Test debug output goes to stderr not stdout
- Test no debug output when verbose disabled
- Test debug messages contain expected information
- Test compatibility with JSON format output

## References

- See ROADMAP.md for context
- See IDEA-003 for original proposal
- Coordinates with IDEA-004 (Centralized Logging) when implemented
