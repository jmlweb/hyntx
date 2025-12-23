# Analyzer with Map-Reduce Batching

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: tipos-base.md, provider-base-ollama.md
- **Estimation**: 5-6 hours

## Description

Implement the analysis system with intelligent batching that handles context window limitations using a Map-Reduce approach. Divides large prompts into batches, analyzes each batch, and merges results.

## Objective

Enable analysis of large volumes of prompts by overcoming model context limitations, maintaining coherent and complete results.

## Scope

- Includes: Token estimation, intelligent batching, prioritization strategies, result merging (Map-Reduce), handling prompts that exceed the limit
- Excludes: Individual analysis (done by provider), provider limits (defined in base.ts)

## Files to Create/Modify

- `src/core/analyzer.ts` - Batching and orchestrated analysis functions

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `AnalysisResult`
- `AnalysisPattern`
- `AnalysisProvider`
- `ProviderLimits`

### Main Functions/Classes

**src/core/analyzer.ts:**

- `estimateTokens()` - Estimates tokens from characters (1 token ≈ 4 chars)
- `batchPrompts()` - Divides prompts into batches according to provider limits
- `mergeBatchResults()` - Merges results from multiple batches (reduce phase)
- `analyzePrompts()` - Main function that orchestrates analysis with automatic batching

### Integrations

- Uses `PROVIDER_LIMITS` from `src/providers/base.ts`
- Calls `provider.analyze()` for each batch
- Supports progress callback for UI

## Acceptance Criteria

- [ ] Correctly estimates tokens (1 token ≈ 4 characters)
- [ ] Creates batches that respect `maxTokensPerBatch`
- [ ] Handles prompts that exceed limit individually (batch of 1)
- [ ] Respects prioritization strategy (longest-first vs chronological)
- [ ] Correctly merges results (deduplicates patterns by ID)
- [ ] Averages frequencies of duplicate patterns
- [ ] Takes highest severity for duplicate patterns
- [ ] Limits to maximum 5 patterns in final result
- [ ] Limits to maximum 3 examples per pattern
- [ ] Correctly calculates aggregated statistics
- [ ] Supports progress callback for UI
- [ ] Efficiently handles single batch case (no overhead)

## Test Cases

- Batching with small prompts (1 batch)
- Batching with large prompts (multiple batches)
- Prompt that exceeds individual limit
- Longest-first vs chronological prioritization
- Merging results with duplicate patterns
- Merging results without duplicates
- Aggregated statistics calculation
- Progress callback works correctly

## References

- Section 13 of `docs/SPECS.md` - Analyzer with Batching
