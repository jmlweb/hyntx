# Parallel Log File Reading

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: None
- **Estimation**: 1 hour
- **Source**: IDEA-013 - Parallel Log File Reading

## Description

Optimize the log reader to process JSONL files in parallel with a concurrency limit. Currently, files are read sequentially using a `for...of` loop with `await`, which creates unnecessary latency for users with many Claude Code projects. Parallelization can improve performance by 2-5x for large log directories.

## Objective

Improve performance for power users with many projects by parallelizing I/O-bound file reading operations.

## Scope

- Includes:
  - Modify `src/core/log-reader.ts` to use parallel file reading
  - Implement concurrency limit to prevent I/O saturation
  - Maintain existing behavior and error handling
- Excludes:
  - API changes
  - Changes to prompt sorting logic
  - Changes to file filtering logic

## Files to Create/Modify

- `src/core/log-reader.ts` - Main log reading module

## Implementation

1. **Locate the sequential loop** in `readLogs` function:

   ```typescript
   for (const file of files) {
     const { prompts, warnings } = await readJsonlFile(file);
     allPrompts.push(...prompts);
     allWarnings.push(...warnings);
   }
   ```

2. **Replace with chunked parallel processing**:

   ```typescript
   const CONCURRENCY_LIMIT = 10;

   for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
     const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
     const results = await Promise.all(chunk.map(readJsonlFile));

     for (const { prompts, warnings } of results) {
       allPrompts.push(...prompts);
       allWarnings.push(...warnings);
     }
   }
   ```

3. **Verify existing tests pass** without modification

4. **Optional**: Add a benchmark test with many small files

## Acceptance Criteria

- [ ] Log files are read in parallel with concurrency limit of 10
- [ ] Order of prompts is preserved (chronological sorting happens after reading)
- [ ] All existing tests pass without modification
- [ ] Performance improvement measurable with 20+ log files
- [ ] No increase in memory usage for typical workloads
- [ ] Error handling still works correctly

## Test Cases

- Existing log-reader tests should pass unchanged
- Manual test with large log directory to verify performance improvement
- Verify error in one file doesn't break entire batch (if using Promise.allSettled)

## References

- IDEA-013 - Full idea specification
- `src/core/log-reader.ts` - Current implementation
