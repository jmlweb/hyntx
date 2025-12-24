# Add JSON Output Format

## Metadata

- **Priority**: P1
- **Phase**: 3
- **Dependencies**: reporter-terminal.md, cli-entry-basico.md
- **Estimation**: TBD
- **Source**: IDEA-001 - Add JSON Output Format for Analysis Results

## Description

Implement a `--format json` flag for the CLI that outputs analysis results as valid JSON to stdout. This enables automation and scripting scenarios: piping results to `jq`, integrating with CI/CD pipelines, storing results in databases, or building dashboards.

When JSON format is selected:

- Output valid JSON to stdout matching the `AnalysisResult` type structure
- Suppress spinner and progress messages (redirect to stderr or disable)
- Support `--compact` flag for minified output (default is pretty-printed)
- Return JSON error objects instead of plain text on failures

## Objective

Enable machine-readable output for automation, CI/CD integration, and data processing workflows.

## Scope

- Includes:
  - Add `--format` CLI flag with options: `terminal` (default), `json`
  - Create `formatJson()` function in reporter module
  - Redirect or suppress spinner/progress when JSON mode is active
  - Add `--compact` flag for minified JSON output
  - Proper error handling returning JSON error objects
- Excludes:
  - Other output formats (CSV, YAML, etc.)
  - JSON schema documentation (can be added later)

## Files to Create/Modify

- `src/index.ts` - Add `--format` and `--compact` CLI flags
- `src/core/reporter.ts` - Add `formatJson()` function
- `tests/reporter.test.ts` - Add tests for JSON formatting

## Implementation

1. Add CLI flags:
   - `--format <type>` with choices `terminal`, `json`
   - `--compact` boolean flag for minified JSON

2. Create `formatJson(result: AnalysisResult, compact?: boolean): string`:
   - Use `JSON.stringify` with proper formatting
   - Include all analysis metadata, patterns, and examples

3. Modify CLI flow:
   - When `--format json`, use stderr for progress/spinner output
   - Output final JSON to stdout only
   - On error, output JSON error object: `{"error": "message", "code": "ERROR_CODE"}`

4. JSON structure should include:
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
- [ ] `--compact` flag produces minified JSON
- [ ] Errors return valid JSON error objects
- [ ] Tests verify JSON output validity and structure

## Test Cases

- Test JSON output structure matches AnalysisResult
- Test JSON is valid and parseable
- Test `--compact` produces minified output
- Test error cases return JSON error objects
- Test stdout is clean (no spinner/progress pollution)

## References

- See ROADMAP.md for context
- See IDEA-001 for original proposal
