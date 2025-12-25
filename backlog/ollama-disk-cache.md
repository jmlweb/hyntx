# Implement Disk Cache for Analysis Results

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: None
- **Estimation**: Small (0.5 days)
- **Parent**: improve-small-model-compatibility.md

## Description

Implement a disk-based cache system to persist batch analysis results. This prevents losing work when processing fails mid-way and enables faster re-analysis of unchanged prompts.

## Objective

Persist intermediate batch results to disk so that:

1. Failed runs can resume from last successful batch
2. Repeated analysis of same prompts is instant
3. Debugging is easier (inspect cached responses)

## Implementation

### Cache Structure

```text
.hyntx-cache/
├── analysis/
│   ├── {batch-hash-1}.json
│   ├── {batch-hash-2}.json
│   └── ...
└── meta.json  # Model info, prompt hash, TTL config
```

### Cache Entry Schema

```typescript
interface CachedBatchResult {
  batchHash: string; // SHA256(sorted prompts)
  modelId: string; // e.g., "llama3.2:latest"
  systemPromptHash: string; // SHA256(SYSTEM_PROMPT)
  timestamp: number; // Unix timestamp
  ttlDays: number; // Default 7
  result: AnalysisResult;
}
```

### Cache Key Generation

```typescript
function generateCacheKey(prompts: string[], modelId: string): string {
  const sortedPrompts = [...prompts].sort().join('\n');
  return crypto
    .createHash('sha256')
    .update(sortedPrompts + modelId)
    .digest('hex')
    .slice(0, 16);
}
```

### Invalidation Rules

- Model change → invalidate all entries for that model
- SYSTEM_PROMPT change → invalidate all entries
- TTL expired → invalidate on read
- Manual: `hyntx --clear-cache`

## Files to Create/Modify

### New Files

- `src/cache/analysis-cache.ts` - Main cache implementation
- `src/cache/index.ts` - Public exports

### Modified Files

- `src/core/analyzer.ts` - Integrate cache lookup/write
- `src/cli/commands.ts` - Add `--clear-cache` and `--no-cache` flags
- `src/types/index.ts` - Add cache-related types

## Acceptance Criteria

- [ ] Cache hit returns stored result without API call
- [ ] Cache miss triggers fresh analysis and stores result
- [ ] Cache invalidates when model changes
- [ ] Cache invalidates when SYSTEM_PROMPT changes
- [ ] TTL expiration works correctly
- [ ] `--clear-cache` removes all cached data
- [ ] `--no-cache` bypasses cache for current run
- [ ] Cache directory is gitignored

## Test Cases

- [ ] First run: cache miss, result stored
- [ ] Second run (same prompts): cache hit, no API call
- [ ] Different model: cache miss
- [ ] Expired TTL: cache miss, old entry removed
- [ ] `--clear-cache`: all entries removed
- [ ] `--no-cache`: fresh analysis, cache not updated
