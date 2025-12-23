# Markdown Format Reporter

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: tipos-base.md, reporter-terminal.md
- **Estimation**: 2-3 hours

## Description

Implement the report formatting function in Markdown format to save results to files, complementing terminal output.

## Objective

Allow users to save analysis reports in Markdown format for future reference or sharing with others.

## Scope

- Includes: Complete Markdown formatting, tables, lists, Before/After in markdown format
- Excludes: File writing (done by CLI), terminal formatting (already in reporter-terminal.md)

## Files to Create/Modify

- `src/core/reporter.ts` - `formatMarkdown()` function

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `AnalysisResult`

### Main Functions/Classes

**src/core/reporter.ts:**

- `formatMarkdown()` - Function that formats AnalysisResult as Markdown

### Integrations

- Used by CLI when `--output report.md` is specified
- Complements `printReport()` for terminal

## Acceptance Criteria

- [ ] Generates valid and well-formatted Markdown
- [ ] Includes header with date
- [ ] Includes statistics table
- [ ] Formats patterns with severity icons
- [ ] Includes prompt examples
- [ ] Includes suggestions for each pattern
- [ ] Formats Before/After in blockquote format
- [ ] Includes top suggestion at the end
- [ ] Correctly handles case without patterns
- [ ] Markdown is readable and well structured

## Test Cases

- Formatting with multiple patterns
- Formatting without patterns
- Formatting with Before/After examples
- Formatting without Before/After examples
- Verify that Markdown is valid (can be parsed)
- Verify that it looks good in Markdown viewers

## References

- Section 15 of `docs/SPECS.md` - Reporter (`formatMarkdown()` function)
