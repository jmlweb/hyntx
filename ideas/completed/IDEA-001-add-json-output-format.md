---
id: IDEA-001
title: Add JSON Output Format for Analysis Results
status: completed
category: feature
created_date: 2025-12-24
validated_date: 2025-12-24
completed_date: 2025-12-25
effort: low
impact: high
rejection_reason: null
---

# Add JSON Output Format for Analysis Results

## Description

Currently hyntx only supports terminal output for analysis results. Adding a `--format json` flag would enable automation and scripting scenarios: piping results to `jq`, integrating with CI/CD pipelines, storing results in databases, or building dashboards.

This is complementary to the planned Markdown reporter but serves a different use case (machine-readable vs human-readable file).

## Motivation

- **Automation**: Enable scripting workflows by piping JSON output to tools like `jq`
- **CI/CD Integration**: Allow build pipelines to parse and act on analysis results
- **Data Storage**: Facilitate storing results in databases or log aggregation systems
- **Dashboard Building**: Provide structured data for visualization tools
- **Interoperability**: Standard JSON format works with any programming language

## Proposed Solution

1. Add `--format` CLI flag with options: `terminal` (default), `json`
2. Create `formatJson()` function in `src/core/reporter.ts` following existing reporter pattern
3. Output valid JSON to stdout when `--format json` is specified
4. Suppress spinner and progress output when JSON format is selected (clean stdout)

The JSON output would include:

- Analysis metadata (date, prompt count, provider used)
- Patterns array with all pattern details
- Before/After examples for each pattern
- Summary statistics

## Acceptance Criteria

- [ ] `--format json` flag outputs valid JSON to stdout
- [ ] JSON schema matches `AnalysisResult` type structure
- [ ] No spinner/progress messages pollute stdout in JSON mode
- [ ] Output can be piped to `jq` successfully
- [ ] Existing terminal format remains the default

## Technical Considerations

- Use `stderr` for progress/spinner output when JSON mode is active to keep `stdout` clean
- Consider adding `--quiet` or `-q` flag to suppress all non-essential output
- JSON output should be pretty-printed by default, with `--compact` option for minified output
- Ensure proper error handling returns valid JSON error objects instead of plain text

## Validation Notes

Accepted. High impact + low effort = P1 priority. Enables automation, CI/CD integration, and data processing workflows.

## Related Tasks

- `add-json-output-format.md` - P1, Phase 3 (task file removed after completion)
