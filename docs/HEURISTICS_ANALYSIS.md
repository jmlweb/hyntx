# Heuristics Analysis Report

**Date:** 2026-01-30
**Author:** HAL (assisted analysis)

## Overview

This document analyzes the `extractRealExamples()` function in `src/core/aggregator.ts` and the category mapping in `src/providers/base.ts`.

## Current Architecture

### Analysis Pipeline

```
Prompts → AI Provider → Minimal/Individual Result → Aggregator → Full AnalysisResult → Semantic Validator
```

### Key Components

1. **ISSUE_TAXONOMY** (`schemas.ts`): 8 predefined issue types
   - `vague`, `no-context`, `too-broad`, `no-goal`, `imperative`
   - `missing-technical-details`, `unclear-priorities`, `insufficient-constraints`

2. **extractRealExamples()** (`aggregator.ts`): Heuristic matcher for fallback examples
   - Only used when AI doesn't provide examples (minimal mode)
   - Uses boolean matching with specific patterns per issue type

3. **Individual Mode**: AI returns per-prompt results with real examples
   - `parseBatchIndividualResponse()` in `base.ts`
   - Examples come directly from AI categorization

## Findings

### extractRealExamples() Heuristics

The current implementation uses strict boolean matching:

| Issue Type | Current Heuristic                                                         |
| ---------- | ------------------------------------------------------------------------- |
| vague      | < 50 chars, ≤ 5 words, generic verbs, no file extensions                  |
| no-context | Has pronouns (this/it/that), no files, no function/component/method/class |
| too-broad  | > 100 chars, ≥ 2 "and", has also/then/build/create                        |
| no-goal    | < 30 chars, ≤ 4 words, no action verbs, no question mark                  |
| imperative | < 20 chars, ≤ 3 words, starts with verb                                   |

### Category Mapping Inconsistency

`base.ts` uses different category IDs than `schemas.ts`:

| base.ts (individual mode) | schemas.ts (taxonomy) |
| ------------------------- | --------------------- |
| `vague-request`           | `vague`               |
| `missing-context`         | `no-context`          |
| `unclear-goal`            | `no-goal`             |

## Recommendations

### 1. Unify Category IDs

Add mapping in `base.ts`:

```typescript
const CATEGORY_TO_TAXONOMY_ID: Record<string, string> = {
  'vague-request': 'vague',
  'missing-context': 'no-context',
  'unclear-goal': 'no-goal',
  // ... etc
};
```

### 2. Improve Heuristics (Future Work)

Consider scoring-based matching instead of boolean:

- Calculate match score (0-1) per prompt per issue
- Select highest-scoring examples
- More nuanced matching for edge cases

### 3. Individual Mode Already Works Well

The individual/batch-individual schema already extracts real examples from AI responses. The heuristics in `extractRealExamples()` are only a fallback for minimal mode.

## Test Coverage

- `aggregator.test.ts`: 50 tests, all passing
- Tests cover all issue types and edge cases
- Gold standard in `benchmark/gold-standard.ts`: 50 prompts across 4 tiers

## Conclusion

The current architecture is solid. The main improvement opportunity is unifying category mappings between individual mode and the taxonomy. The heuristics work correctly for their intended purpose as a fallback.
