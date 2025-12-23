# Terminal Reporter

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: tipos-base.md
- **Estimation**: 3-4 hours

## Description

Implement the report formatter for terminal output with visually attractive UI including ASCII art, boxes, tables, progress indicators, and Before/After example visualization.

## Objective

Provide an attractive, modern, and visually engaging terminal output that clearly displays analysis results with professional formatting, including concrete Before/After examples. The UI should be both functional and aesthetically pleasing.

## Scope

- Includes: ASCII art headers (optional), boxed sections, tables for structured data, progress bars, spinners, colors, emojis, Before/After display, animations during loading
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

**Terminal UI Libraries:**

- `chalk` - Colors and text styling (bold, underline, colors)
- `ora` - Elegant animated spinners for loading states
- `boxen` - Boxed sections with borders for visual separation
- `cli-table3` - Formatted tables for structured data
- `cli-progress` - Progress bars for long-running operations
- `figlet` - ASCII art generators for headers/logos (optional)

**Data Flow:**

- Receives `AnalysisResult` from analyzer
- Used by CLI to display results

## Acceptance Criteria

### Visual Elements

- [ ] Optional ASCII art header/logo (can be disabled with `--no-art`)
- [ ] Boxed sections using `boxen` for visual separation
- [ ] Statistics displayed in formatted table using `cli-table3`
- [ ] Progress bars shown during long operations (log reading, batch analysis)
- [ ] Spinners shown during short operations (provider connection, setup)

### Content Display

- [ ] Shows header with formatted date (with optional ASCII art)
- [ ] Shows statistics in table format (prompts, projects, score)
- [ ] Score is colored according to value (green ≥8, yellow ≥6, red <6)
- [ ] Shows patterns in boxed sections with severity icons
- [ ] Shows frequency of each pattern as percentage
- [ ] Shows prompt examples (truncated if long)
- [ ] Shows suggestions for each pattern
- [ ] Shows Before/After examples when available
- [ ] Before is shown in red, After in green
- [ ] Before/After displayed in visually distinct boxes or side-by-side
- [ ] Appropriately truncates long text
- [ ] Shows message when there are no patterns
- [ ] Shows top suggestion at the end in highlighted box
- [ ] Format is readable, well structured, and visually appealing

### Animations & Loading States

- [ ] Progress bar during log reading (if >100 files)
- [ ] Progress bar during batch analysis (shows batch X of Y)
- [ ] Spinner during provider connection attempts
- [ ] Smooth transitions between states

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
