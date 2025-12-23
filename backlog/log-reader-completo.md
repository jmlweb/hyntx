# Complete Log Reading with Filters

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: log-reader-basico.md, schema-validator.md
- **Estimation**: 4-5 hours

## Description

Extend log reading functionality to include date filters (single date, date range) and project filter. Also includes the day grouping function.

## Objective

Provide complete filtering and organization capabilities for prompts, enabling specific analysis by date and project.

## Scope

- Includes: Date filters (today, yesterday, YYYY-MM-DD, ranges), project filter, day grouping, timestamp validation, date error handling
- Excludes: Basic file reading (already implemented), schema validation (already implemented)

## Files to Create/Modify

- `src/core/log-reader.ts` - Extend with filtering and grouping functions

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `ExtractedPrompt`
- `DayGroup`
- `LogReadResult`

### Main Functions/Classes

**src/core/log-reader.ts:**

- `parseDate()` - Parses date strings (today, yesterday, YYYY-MM-DD)
- `readLogs()` - Complete function with filtering options
- `groupByDay()` - Groups prompts by day

### Integrations

- Uses `date-fns` extensively for date manipulation
- Integrates with `schema-validator.ts` for validation
- Uses basic functions from `log-reader.ts` (already implemented)

## Acceptance Criteria

- [ ] Correctly parses 'today', 'yesterday' and ISO dates (YYYY-MM-DD)
- [ ] Validates date ranges (--from must be before --to)
- [ ] Correctly filters prompts by date range
- [ ] Filters prompts by project name (partial search)
- [ ] Correctly groups prompts by day
- [ ] Handles invalid timestamps gracefully (adds warning, continues)
- [ ] Returns warnings for schema issues
- [ ] Sorts prompts chronologically within each group
- [ ] Correctly extracts project names from directory hash

## Test Cases

- Filtering by single date (today, yesterday, specific date)
- Filtering by date range
- Filtering by project
- Combination of filters (date + project)
- Day grouping with multiple projects
- Handling invalid timestamps
- Validation of invalid date ranges (should throw error)

## References

- Section 11.3 of `docs/SPECS.md` - Implementation (complete)
