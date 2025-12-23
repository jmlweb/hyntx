# Terminal Reporter

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: tipos-base.md
- **Estimation**: 3-4 hours

## Description

Implement the report formatter for terminal output, including Before/After example visualization with colors and readable format.

## Objective

Provide an attractive and readable terminal output that clearly displays analysis results, including concrete Before/After examples.

## Scope

- Includes: Statistics formatting, pattern visualization, Before/After display, colors and emojis, readable format
- Excludes: Markdown format (done in reporter-markdown.md), file writing (done by CLI)

## Files to Create/Modify

- `src/core/reporter.ts` - `printReport()` function and helpers

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `AnalysisResult`

### Main Functions/Classes

**src/core/reporter.ts:**

- `severityIcon()` - Returns emoji according to severity (🔴🟡🟢)
- `scoreColor()` - Returns colored text according to score
- `printReport()` - Main function that prints the complete report

### Integrations

- Uses `chalk` for terminal colors
- Receives `AnalysisResult` from analyzer
- Used by CLI to display results

## Acceptance Criteria

- [ ] Shows header with formatted date
- [ ] Shows statistics (prompts, projects, score)
- [ ] Score is colored according to value (green ≥8, yellow ≥6, red <6)
- [ ] Shows patterns with severity icons
- [ ] Shows frequency of each pattern as percentage
- [ ] Shows prompt examples (truncated if long)
- [ ] Shows suggestions for each pattern
- [ ] Shows Before/After examples when available
- [ ] Before is shown in red, After in green
- [ ] Appropriately truncates long text
- [ ] Shows message when there are no patterns
- [ ] Shows top suggestion at the end
- [ ] Format is readable and well structured

## Test Cases

- Report with multiple patterns
- Report without patterns (all excellent)
- Report with Before/After examples
- Report without Before/After examples
- Report with very long text (should truncate)
- Different score values (should color correctly)
- Different severities (should show correct icons)

## References

- Section 15 of `docs/SPECS.md` - Reporter (`printReport()` function)
