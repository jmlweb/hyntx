# Implement Watch Mode File Watcher

## Metadata

- **Priority**: P1
- **Phase**: 5
- **Dependencies**: None
- **Estimation**: Medium
- **Source**: IDEA-015 - Interactive Watch Mode for Real-Time Prompt Analysis

## Description

Create a file watcher module (`src/core/watcher.ts`) that monitors `~/.claude/projects/` for new log entries. Use native `fs.watch` with debouncing to handle incremental file writes. Include proper signal handling for SIGINT/SIGTERM cleanup.

## Objective

Provide the core infrastructure for watch mode by detecting new prompts in Claude Code logs as they are written, enabling real-time analysis feedback.

## Scope

- Includes:
  - File watcher module using native `fs.watch`
  - Debouncing mechanism for handling rapid file changes
  - Signal handling for graceful shutdown (SIGINT/SIGTERM)
  - Project directory discovery and monitoring
  - Event emitter pattern for notifying consumers of new log entries
- Excludes:
  - CLI integration (separate task)
  - Analysis logic (uses existing analyzer)
  - Output formatting (separate task)

## Files to Create/Modify

- `src/core/watcher.ts` - Main watcher module
- `src/core/watcher.test.ts` - Unit tests
- `src/types/index.ts` - Add watcher-related types

## Implementation

1. Create `WatcherOptions` type with configuration options:
   - `debounceMs`: Debounce interval (default: 500ms)
   - `projectFilter`: Optional project name filter
   - `signal`: Optional AbortSignal for cleanup

2. Create `LogWatcher` class or factory function:
   - `start()`: Begin watching log directories
   - `stop()`: Cleanup watchers and resources
   - `on('prompt', callback)`: Subscribe to new prompt events

3. Implement debouncing:
   - Track last modification time per file
   - Only emit events after debounce period with no changes
   - Handle rapid successive writes gracefully

4. Implement signal handling:
   - Listen for SIGINT/SIGTERM
   - Call `stop()` to cleanup all watchers
   - Allow graceful process exit

5. Track file positions:
   - Remember last read position in each log file
   - Only process new entries since last read

## Acceptance Criteria

- [ ] `src/core/watcher.ts` module created
- [ ] Native `fs.watch` used for file monitoring
- [ ] Debouncing prevents duplicate events from rapid writes
- [ ] SIGINT/SIGTERM triggers graceful cleanup
- [ ] New prompts detected and emitted as events
- [ ] Project filtering works correctly
- [ ] Unit tests cover initialization, events, and cleanup
- [ ] No memory leaks from unclosed watchers

## Test Cases

- Watcher starts and monitors correct directories
- New log entry triggers prompt event after debounce
- Rapid writes only trigger single event
- SIGINT causes graceful shutdown
- Project filter excludes non-matching projects
- Watcher cleanup removes all file handles
- Already-processed prompts are not re-emitted

## References

- IDEA-015: Interactive Watch Mode for Real-Time Prompt Analysis
- `src/core/log-reader.ts` - Existing log parsing logic
- `src/utils/paths.ts` - Claude projects directory constant
- Node.js `fs.watch` documentation
