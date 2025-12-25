---
id: IDEA-013
title: Parallel Log File Reading
status: accepted
category: improvement
created_date: 2025-12-25
validated_date: 2025-12-25
effort: low
impact: medium
rejection_reason: null
---

# Parallel Log File Reading

## Description

The log reader currently processes JSONL files sequentially using a `for...of` loop with `await`. When users have many Claude Code projects or large log directories, this creates unnecessary latency. Files can be read in parallel with a concurrency limit to improve performance by 2-5x for large log directories while avoiding I/O saturation.

## Motivation

- **Scalability**: Power users with many projects accumulate hundreds of log files over time
- **I/O Bound Operation**: File reading is I/O bound, not CPU bound; parallelization is safe and effective
- **Quick Win**: Simple change with measurable performance improvement
- **No Breaking Changes**: Internal optimization with no API changes
- **Node.js Strength**: Node.js excels at parallel async I/O operations

## Proposed Solution

Modify `src/core/log-reader.ts` to read files in parallel with chunking:

**Current Implementation (lines 520-524):**

```typescript
for (const file of files) {
  const { prompts, warnings } = await readJsonlFile(file);
  allPrompts.push(...prompts);
  allWarnings.push(...warnings);
}
```

**Proposed Implementation:**

```typescript
const CONCURRENCY_LIMIT = 10;

// Process files in parallel chunks
for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
  const chunk = files.slice(i, i + CONCURRENCY_LIMIT);
  const results = await Promise.all(chunk.map(readJsonlFile));

  for (const { prompts, warnings } of results) {
    allPrompts.push(...prompts);
    allWarnings.push(...warnings);
  }
}
```

Alternative using a utility function:

```typescript
async function processInParallel<T, R>(
  items: readonly T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 10,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
  }
  return results;
}
```

## Acceptance Criteria

- [ ] Log files are read in parallel with configurable concurrency limit
- [ ] Default concurrency limit prevents I/O saturation (suggested: 10)
- [ ] Order of prompts is preserved (chronological sorting happens after reading)
- [ ] All existing tests pass without modification
- [ ] Performance improvement measurable with 20+ log files
- [ ] No increase in memory usage for typical workloads
- [ ] Error handling still works correctly (individual file failures don't break batch)

## Technical Considerations

- **Concurrency Limit**: 10 files is a reasonable default; prevents file descriptor exhaustion
- **Memory Usage**: Parallel reading doesn't increase peak memory since files are still processed into the same arrays
- **Error Isolation**: `Promise.all` will fail fast; consider `Promise.allSettled` if partial results are preferred
- **Ordering**: Files are sorted chronologically after reading, so read order doesn't matter
- **Testing**: Add a benchmark test with many small files to verify improvement

## Validation Notes

**Validated**: 2025-12-25

**Decision**: ACCEPTED

**Reasoning**:

- Low effort change with 2-5x performance improvement for large log directories
- No breaking changes - purely internal optimization
- Node.js excels at parallel async I/O operations
- Simple implementation with chunked Promise.all
- Aligns with maintenance phase focus on performance improvements
- Benefits power users with many projects

**Priority**: P3 (performance optimization, not blocking)

## Related Tasks

- `parallel-log-file-reading.md` - P3, Phase 4 (task file removed after completion)
