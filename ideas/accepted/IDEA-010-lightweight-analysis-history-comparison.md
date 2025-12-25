---
id: IDEA-010
title: Add Lightweight Analysis History and Comparison
status: accepted
category: feature
created_date: 2025-01-27
validated_date: 2025-12-25
effort: medium
impact: high
rejection_reason: null
---

# Add Lightweight Analysis History and Comparison

## Description

Currently, Hyntx analyzes prompts but doesn't provide a way to track improvement over time. Users can save individual reports to files manually, but there's no built-in mechanism to compare results across different dates or see if their prompt quality is improving. This idea proposes a lightweight history system that stores analysis results locally and enables simple comparison features.

This builds on the existing JSON output format (IDEA-001) to store results in a structured way without requiring a database, providing immediate value while keeping the implementation simple and privacy-first.

## Motivation

- **Track Improvement**: Users need to see if they're improving as prompt engineers over time
- **Compare Periods**: Ability to compare results from different weeks/months to identify patterns
- **Motivation**: Visual progress helps maintain the habit of prompt analysis
- **Baseline Comparison**: Compare current results against a baseline period to measure progress
- **Pattern Trends**: Identify which anti-patterns are decreasing (improvement) or increasing (regression)
- **Low-Friction**: Automatic storage without manual file management

## Proposed Solution

1. **Automatic History Storage**:
   - Store analysis results in `~/.hyntx/history/` directory as JSON files
   - File naming: `{date}.json` (e.g., `2025-01-27.json`)
   - Store complete `AnalysisResult` structure (already available as JSON)
   - Only store when analysis completes successfully (not on dry-run)

2. **New CLI Commands**:
   - `hyntx --compare <date1> <date2>`: Compare two specific dates side-by-side
   - `hyntx --compare-week`: Compare this week vs last week
   - `hyntx --compare-month`: Compare this month vs last month
   - `hyntx --history`: List available history entries
   - `hyntx --history-summary`: Show summary statistics across all stored results

3. **Comparison Output Format**:
   - Side-by-side comparison showing:
     - Score changes (e.g., "6.5 → 7.8 (+1.3)")
     - Pattern frequency changes (e.g., "Missing Context: 60% → 45% (-15%)")
     - New patterns that appeared
     - Patterns that disappeared
   - Visual indicators (↑↓) for improvements and regressions
   - Before/After examples for patterns that changed significantly

4. **Implementation Details**:
   - Create `src/core/history.ts` module for history management:
     - `saveAnalysisResult(result: AnalysisResult): Promise<void>`
     - `loadAnalysisResult(date: string): Promise<AnalysisResult | null>`
     - `listAvailableDates(): Promise<string[]>`
     - `compareResults(result1: AnalysisResult, result2: AnalysisResult): ComparisonResult`
   - Integrate automatic saving in main CLI flow after successful analysis
   - Add comparison commands to CLI argument parsing
   - Create comparison reporter similar to existing reporters

5. **Privacy and Storage**:
   - All data stored locally (privacy-first)
   - History directory created automatically on first save
   - Optional: Add `--no-history` flag to disable automatic storage
   - Optional: Add `hyntx --history-clear` to remove all stored results

## Acceptance Criteria

- [ ] Analysis results are automatically saved to `~/.hyntx/history/{date}.json` after successful analysis
- [ ] `--compare <date1> <date2>` command compares two dates and shows differences
- [ ] `--compare-week` and `--compare-month` commands work correctly
- [ ] `--history` lists all available history entries with dates
- [ ] Comparison output shows score changes, pattern frequency changes, and visual indicators
- [ ] History files use the same JSON structure as `--format json` output
- [ ] `--no-history` flag prevents saving results (for privacy-conscious users)
- [ ] Clear error messages when comparing non-existent dates
- [ ] Tests cover history storage, loading, and comparison logic

## Technical Considerations

- **File Storage**: Simple JSON files (no database dependency)
- **Storage Location**: `~/.hyntx/history/` (follows existing pattern of `~/.hyntx-last-run`)
- **File Format**: Reuse existing `AnalysisResult` type structure
- **Performance**: Loading should be fast (single JSON file per date)
- **Storage Size**: Consider adding cleanup for old entries (optional: keep last 90 days)
- **Atomic Writes**: Use temporary files when writing to prevent corruption (similar to existing file output)
- **Date Handling**: Use ISO date format (YYYY-MM-DD) for consistency
- **Error Handling**: Gracefully handle missing files or corrupted JSON
- **Backward Compatibility**: Works with existing `--format json` output structure

## Benefits

- **Immediate Value**: Users can track their progress without manual file management
- **Privacy-First**: All data stored locally, no external dependencies
- **Low Complexity**: Builds on existing JSON infrastructure (IDEA-001)
- **Extensible**: Can be extended later with full trend analysis (as mentioned in FUTURE_PLANS.md)
- **User Motivation**: Visual progress helps maintain the analysis habit
- **Actionable Insights**: Identifies which patterns are improving or worsening

## Comparison with FUTURE_PLANS.md

FUTURE_PLANS.md mentions "Historical Trend Analysis" as a future enhancement that would require:

- Local database for storage
- Weekly/monthly trend reports
- Pattern frequency changes over time
- Export historical data

This idea provides a **lighter-weight version** that:

- Uses simple JSON files instead of a database
- Enables comparison features now rather than waiting
- Can be extended later to full trend analysis if needed
- Provides 80% of the value with 20% of the complexity

## Related Ideas and Features

- **IDEA-001** (JSON Output Format): This idea builds on JSON output for storage
- **FUTURE_PLANS.md**: Historical Trend Analysis (this is a simpler precursor)
- **Existing**: `--output` flag for manual file saving (this automates and enables comparison)

## Related Tasks

- [add-analysis-history-comparison.md](../../backlog/add-analysis-history-comparison.md) - P1, Phase 4

**Backlog tasks created**: 2025-12-25 via `/feed-backlog`

## Example Usage

```bash
# Automatic storage happens after analysis
hyntx --date 2025-01-27
# Result automatically saved to ~/.hyntx/history/2025-01-27.json

# Compare two specific dates
hyntx --compare 2025-01-20 2025-01-27

# Compare this week vs last week
hyntx --compare-week

# List available history
hyntx --history
# Output:
# Available analysis history:
#   2025-01-15 (15 prompts, score: 6.2)
#   2025-01-20 (12 prompts, score: 6.8)
#   2025-01-27 (18 prompts, score: 7.5)

# Disable history storage for privacy
hyntx --date 2025-01-27 --no-history
```

## Example Comparison Output

```text
📊 Comparison: 2025-01-20 vs 2025-01-27
═══════════════════════════════════════════════

📈 Overall Improvement
   Score: 6.8 → 7.5 (+0.7) ⬆️
   Prompts: 12 → 18 (+6)

🎯 Pattern Changes

   Missing Context: 60% → 45% (-15%) ⬇️ Improved!
   • Frequency decreased significantly
   • 3 examples from 2025-01-27 show improvement

   Vague Instructions: 40% → 35% (-5%) ⬇️ Improved!
   • Small improvement, continue working on this

   Missing Error Handling: 0% → 15% (+15%) ⬆️ New Pattern
   • New pattern detected in recent analysis
   • Focus on adding error handling to prompts

═══════════════════════════════════════════════
💡 Summary: Overall improvement! Focus on error handling.
```
