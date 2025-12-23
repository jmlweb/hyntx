# Basic JSONL Log Reading

## Metadata

- **Priority**: P0
- **Phase**: 1
- **Dependencies**: tipos-base.md, schema-validator.md, utils-completos.md (partial - paths.ts)
- **Estimation**: 3-4 hours

## Description

Implement basic functionality to read and parse Claude Code JSONL files. This is the basic version that reads logs without date or project filters.

## Objective

Establish the fundamental capability to read and extract prompts from Claude Code log files, allowing the system to access the data needed for analysis.

## Scope

- Includes: JSONL file reading, message parsing, prompt content extraction, log location detection
- Excludes: Date/project filters (implemented in log-reader-completo.md), schema validation (done in schema-validator.md but used here)

## Files to Create/Modify

- `src/core/log-reader.ts` - Basic reading functions (partial)
- `src/utils/paths.ts` - System path constants

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `ClaudeMessage`
- `ExtractedPrompt`
- `LogReadResult`

### Main Functions/Classes

**src/core/log-reader.ts:**

- `claudeProjectsExist()` - Verifies if Claude projects directory exists
- Basic functions to read and parse JSONL (without date filters)

**src/utils/paths.ts:**

- `CLAUDE_PROJECTS_DIR` - Constant with path to `~/.claude/projects`

### Integrations

- Uses `glob` to find `.jsonl` files
- Uses `date-fns` for timestamp parsing (basic)
- Integrates with `schema-validator.ts` for schema validation
- Reads files from the file system

## Acceptance Criteria

- [ ] Correctly detects log location in `~/.claude/projects/`
- [ ] Reads all `.jsonl` files in project directories
- [ ] Correctly parses JSONL format (one line = one message)
- [ ] Extracts only `user` type messages
- [ ] Handles content as string or array of blocks
- [ ] Correctly extracts message content
- [ ] Handles JSON parse errors gracefully (continues with next line)
- [ ] Returns prompts sorted chronologically
- [ ] Includes metadata: timestamp, sessionId, projectName

## Test Cases

- Reading logs with valid format
- Reading logs with malformed lines (should continue)
- Reading logs with string content
- Reading logs with array of blocks content
- Reading when projects directory doesn't exist
- Reading multiple JSONL files in different projects

## References

- Section 11.1 of `docs/SPECS.md` - Location
- Section 11.2 of `docs/SPECS.md` - JSONL Structure
- Initial part of section 11.3 of `docs/SPECS.md` - Implementation (without filters)
