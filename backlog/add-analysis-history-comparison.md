# Add Lightweight Analysis History and Comparison

## Metadata

- **Priority**: P1
- **Phase**: 4
- **Dependencies**: None (builds on existing JSON output format)
- **Estimation**: 4-6 hours
- **Source**: IDEA-010 - Add Lightweight Analysis History and Comparison

## Description

Implement a lightweight history system that automatically stores analysis results locally and enables comparison features. Users can track improvement over time, compare results across different dates, and see if their prompt quality is improving. This builds on the existing JSON output format to store results in a structured way without requiring a database.

## Objective

Enable users to track their progress as prompt engineers over time by automatically storing analysis results and providing comparison tools. This provides immediate value while keeping the implementation simple and privacy-first.

## Scope

- Includes:
  - Automatic history storage in `~/.hyntx/history/` directory
  - History management module (`src/core/history.ts`)
  - CLI commands: `--compare`, `--compare-week`, `--compare-month`, `--history`, `--history-summary`
  - Comparison reporter for side-by-side results
  - `--no-history` flag to disable automatic storage
  - Atomic file writes to prevent corruption
- Excludes:
  - Database storage (uses simple JSON files)
  - Advanced trend analysis (future enhancement)
  - Cloud sync or sharing features
  - Automatic cleanup of old entries (manual for now)

## Files to Create/Modify

- `src/core/history.ts` (create)
- `src/core/history.test.ts` (create)
- `src/index.ts` (modify - add history commands and auto-save)
- `src/core/reporter.ts` (modify - add comparison reporter)
- `src/types/index.ts` (modify - add ComparisonResult type if needed)

## Implementation

1. **Create history module** (`src/core/history.ts`):
   - `saveAnalysisResult(result: AnalysisResult): Promise<void>` - Save result to `~/.hyntx/history/{date}.json`
   - `loadAnalysisResult(date: string): Promise<AnalysisResult | null>` - Load result for specific date
   - `listAvailableDates(): Promise<string[]>` - List all available history entries
   - `compareResults(result1: AnalysisResult, result2: AnalysisResult): ComparisonResult` - Compare two results
   - Use atomic writes (temp file then rename) to prevent corruption
   - Create history directory automatically on first save

2. **Add CLI commands**:
   - `--compare <date1> <date2>`: Compare two specific dates
   - `--compare-week`: Compare this week vs last week
   - `--compare-month`: Compare this month vs last month
   - `--history`: List available history entries with dates and summaries
   - `--history-summary`: Show summary statistics across all stored results
   - `--no-history`: Disable automatic storage

3. **Automatic storage integration**:
   - Save analysis results after successful analysis (not on dry-run)
   - Integrate into main CLI flow in `src/index.ts`
   - Respect `--no-history` flag

4. **Comparison output**:
   - Create comparison reporter in `src/core/reporter.ts`
   - Show side-by-side comparison with:
     - Score changes (e.g., "6.5 → 7.8 (+1.3)")
     - Pattern frequency changes
     - New patterns that appeared
     - Patterns that disappeared
   - Visual indicators (↑↓) for improvements and regressions
   - Before/After examples for significant changes

5. **Error handling**:
   - Gracefully handle missing history files
   - Handle corrupted JSON files
   - Clear error messages when comparing non-existent dates
   - Handle date parsing errors

## Acceptance Criteria

- [ ] Analysis results are automatically saved to `~/.hyntx/history/{date}.json` after successful analysis
- [ ] `--compare <date1> <date2>` command compares two dates and shows differences
- [ ] `--compare-week` and `--compare-month` commands work correctly
- [ ] `--history` lists all available history entries with dates
- [ ] Comparison output shows score changes, pattern frequency changes, and visual indicators
- [ ] History files use the same JSON structure as `--format json` output
- [ ] `--no-history` flag prevents saving results
- [ ] Clear error messages when comparing non-existent dates
- [ ] Tests cover history storage, loading, and comparison logic
- [ ] Atomic writes prevent file corruption

## Test Cases

- Test automatic saving after successful analysis
- Test `--no-history` flag prevents saving
- Test loading existing history entries
- Test comparison between two dates
- Test `--compare-week` calculates correct date ranges
- Test `--compare-month` calculates correct date ranges
- Test `--history` lists all available entries
- Test error handling for missing files
- Test error handling for corrupted JSON
- Test atomic write behavior (temp file then rename)
- Test directory creation on first save

## References

- IDEA-010 - Full idea specification with examples
- `src/core/reporter.ts` - Existing reporter patterns
- `src/index.ts` - CLI entry point for integration
- FUTURE_PLANS.md - Historical Trend Analysis (this is a simpler precursor)
