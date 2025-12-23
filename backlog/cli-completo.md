# Complete CLI with All Options

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: cli-entry-basico.md, reminder-system.md, reporter-markdown.md, provider-factory.md, log-reader-completo.md
- **Estimation**: 4-5 hours

## Description

Extend the basic CLI to include all advanced options: date ranges, project filter, file output, verbose mode, dry-run, and reminder system.

## Objective

Provide a complete and robust CLI with all specified functionalities, enabling flexible and detailed analysis.

## Scope

- Includes: All CLI options (--from, --to, --project, --output, --verbose, --dry-run, --check-reminder), multiple day handling, file writing, dry-run mode
- Excludes: Already implemented basic functionality

## Files to Create/Modify

- `src/index.ts` - Extend with all advanced options

## Implementation

### TypeScript Types

Uses all system types.

### Main Functions/Classes

**src/index.ts:**

- Extend `main()` with all options:
  - `--from` / `--to` - Date ranges
  - `--project` - Project filter
  - `--output` - Save to file (Markdown or JSON)
  - `--verbose` - Debug mode
  - `--dry-run` - Preview without sending to AI
  - `--check-reminder` - Check reminders

### Integrations

- Integrates `reminder.ts` for `--check-reminder`
- Integrates `formatMarkdown()` for `--output .md`
- Integrates `readLogs()` options for filters
- Handles multiple days in date ranges
- Writes JSON and Markdown files

## Acceptance Criteria

- [ ] Correctly parses all options
- [ ] --from and --to work for date ranges
- [ ] --project filters by project name
- [ ] --output saves in Markdown correctly
- [ ] --output saves in JSON correctly
- [ ] --output handles multiple days (append for MD, separate files for JSON)
- [ ] --verbose shows debug information
- [ ] --dry-run shows preview without sending to AI
- [ ] --check-reminder verifies and shows reminders
- [ ] Handles file write errors gracefully
- [ ] Shows schema warnings when appropriate
- [ ] Shows redacted secrets counter in verbose

## Test Cases

- Analysis with date range (multiple days)
- Analysis with project filter
- Saving to Markdown (single day and multiple days)
- Saving to JSON (single day and multiple days)
- Verbose mode shows additional information
- Dry-run mode shows correct preview
- Check-reminder works correctly
- File write error handling

## References

- Section 16 of `docs/SPECS.md` - Entry Point (complete version)
- Section 5 of `docs/SPECS.md` - CLI Interface
