# Feasibility Analysis: Individual Prompt Analysis with Simple Categorization

## Executive Summary

**Status**: ✅ **VIABLE** with recommended modifications

This document analyzes the feasibility of refactoring Hyntx's analysis system to process prompts individually (one prompt per API call) instead of batching multiple prompts together. The proposed approach aims to:

1. Reduce context size per call (better for current 3k token batching limit)
2. Improve analysis accuracy by avoiding context loss
3. Enable incremental processing with file-based result storage
4. Simplify parallelization and caching

**Note**: The 3k token limit refers to the configured batching size in the analysis system, not the models' native context windows. Modern Ollama models support much larger contexts (see [MINIMUM_VIABLE_MODEL.md](MINIMUM_VIABLE_MODEL.md)).

## Current Architecture

### Batch-Based Analysis

**Current Flow**:

```
Prompts → Sanitize → Batch (by token limits) → Analyze Batch → Merge Results → Report
```

**Key Characteristics**:

- Ollama batching limit: 3,000 tokens per batch (with 2,000 reserved for system overhead = 1,000 effective)
  - **Note**: This is a configured batching limit for the analysis system, not the model's native context window. Modern Ollama models support much larger contexts (e.g., llama3.2: 128k, mistral:7b: 32k). See [MINIMUM_VIABLE_MODEL.md](MINIMUM_VIABLE_MODEL.md) for model-specific capabilities.
- Batches multiple prompts together (typically 1-5 prompts depending on size)
- Uses complex system prompt with full schema requirements
- Results merged using Map-Reduce pattern
- Cache key: hash of entire batch

**Current Limitations**:

1. **Context Loss**: When batching, prompts lose individual context. Example: "fix this" without previous conversation context
2. **Token Constraints**: Ollama's 3k limit forces very small batches (often 1-2 prompts)
3. **Cache Inefficiency**: Entire batch must be re-analyzed if one prompt changes
4. **Complex Merging**: Map-Reduce logic needed to combine batch results
5. **Error Propagation**: One bad prompt can affect entire batch

## Proposed Architecture

### Individual Analysis with Categorization

**Proposed Flow**:

```
Prompts → Analyze Individual → Save to Files → Post-Process → Group by Category → Generate Report
```

**Key Characteristics**:

- 1 prompt = 1 API call
- Simple categorization: `correct` | `problems` (with category)
- Results saved to individual files: `~/.hyntx/individual-results/<date>/<hash>.json`
- Post-processing groups problems by category
- Final report generated from grouped results

**Response Schema**:

```json
{
  "status": "correct" | "problems",
  "problems": ["issue 1", "issue 2"],
  "category": "vague-request" | "missing-context" | "too-broad" | "unclear-goal" | "other",
  "example": "the original prompt text",
  "suggestion": "how to improve this prompt"
}
```

## Technical Feasibility Analysis

### ✅ Advantages

#### 1. **Context Preservation**

- **Current**: Prompts analyzed in batches lose individual context
- **Proposed**: Each prompt analyzed independently with full context
- **Impact**: Higher accuracy, especially for follow-up prompts

#### 2. **Token Efficiency**

- **Current**: System prompt (~2,000 tokens) + multiple prompts + overhead
- **Proposed**: Simplified system prompt (~500 tokens) + single prompt
- **Savings**: ~60-70% reduction in tokens per call
- **Example**:
  - Current: 2,000 (system) + 500 (prompt) = 2,500 tokens
  - Proposed: 500 (system) + 500 (prompt) = 1,000 tokens

#### 3. **Better for Small Context Batching**

- **Current**: 3k batching limit forces tiny batches (1-2 prompts)
- **Proposed**: 1k per call leaves room for growth
- **Benefit**: More reliable, less truncation risk
- **Note**: While modern Ollama models support much larger contexts (llama3.2: 128k), the current batching configuration uses conservative limits for compatibility

#### 4. **Granular Caching**

- **Current**: Cache entire batch (if one prompt changes, entire batch re-analyzed)
- **Proposed**: Cache individual prompts (only changed prompts re-analyzed)
- **Impact**: Better cache hit rates, incremental analysis support

#### 5. **Parallelization**

- **Current**: Sequential batch processing
- **Proposed**: Parallel individual processing (5-10 concurrent)
- **Speed**: ~5-10x faster for large prompt sets

#### 6. **Resumability**

- **Current**: Must restart entire analysis if interrupted
- **Proposed**: Results saved to files, can resume from saved state
- **Benefit**: Better UX for large analyses

#### 7. **Simpler Error Handling**

- **Current**: One bad prompt can fail entire batch
- **Proposed**: Individual failures don't affect others
- **Resilience**: Higher success rate

### ⚠️ Challenges & Mitigations

#### 1. **More API Calls**

**Challenge**: N prompts = N API calls (vs current: N/batch_size)

**Impact Analysis**:

- **Current**: 50 prompts / 2 per batch = 25 calls
- **Proposed**: 50 prompts = 50 calls
- **Overhead**: 2x more calls, but each call is faster and simpler

**Mitigation**:

- Parallel processing (5-10 concurrent) reduces wall-clock time
- Individual calls are faster (smaller context = faster processing)
- Better caching reduces redundant calls
- **Net Result**: Similar or better total time despite more calls

**Verdict**: ✅ Acceptable trade-off

#### 2. **Post-Processing Complexity**

**Challenge**: Need to aggregate individual results into final report

**Complexity Analysis**:

- Load all result files
- Group by category
- Calculate frequencies
- Generate patterns with examples
- Create before/after pairs

**Mitigation**:

- Post-processing is pure computation (no API calls)
- Can reuse existing aggregation logic from `mergeBatchResults()`
- File-based storage enables incremental processing
- **Complexity**: Medium (similar to current merge logic)

**Verdict**: ✅ Manageable

#### 3. **Storage Overhead**

**Challenge**: Individual files vs single batch result

**Storage Analysis**:

- **Current**: 1 file per analysis date (~10-50 KB)
- **Proposed**: N files per date (~1-2 KB each)
- **Example**: 50 prompts = 50 files (~50-100 KB total)

**Mitigation**:

- Storage is cheap (disk space)
- Enables incremental analysis (major benefit)
- Can compress old results
- **Overhead**: Negligible (< 1 MB for typical usage)

**Verdict**: ✅ Acceptable

#### 4. **Category Accuracy**

**Challenge**: Simple categorization might miss edge cases

**Analysis**:

- Categories: `vague-request`, `missing-context`, `too-broad`, `unclear-goal`, `other`
- Ollama can reliably categorize (tested with `llama3.2`)
- Fallback to `other` for ambiguous cases
- Post-processing can refine categories

**Mitigation**:

- Start with simple categories
- Iterate based on real-world data
- Use `other` as safety net
- **Accuracy**: Expected 80-90% correct categorization

**Verdict**: ✅ Acceptable

#### 5. **Schema Simplicity**

**Challenge**: Simpler schema might lose some nuance

**Analysis**:

- Current: Complex patterns with frequency, severity, examples
- Proposed: Simple status + category + suggestion
- Post-processing reconstructs patterns from grouped results

**Mitigation**:

- Post-processing can calculate frequency (how many prompts per category)
- Severity can be inferred from category
- Examples collected from all prompts in category
- **Trade-off**: Simpler analysis, richer post-processing

**Verdict**: ✅ Acceptable trade-off

## Performance Comparison

### Scenario: 50 Prompts Analysis

#### Current Approach (Batch)

```
- Batches: 25 (2 prompts per batch, 1k tokens each)
- API Calls: 25
- Time per call: ~3-5 seconds (larger context)
- Total time: ~75-125 seconds (sequential)
- Cache efficiency: Low (batch changes invalidate cache)
```

#### Proposed Approach (Individual)

```
- Batches: 0 (individual analysis)
- API Calls: 50
- Time per call: ~1-2 seconds (smaller context)
- Concurrent: 5-10 parallel
- Total time: ~10-20 seconds (parallel)
- Cache efficiency: High (individual prompts cached)
```

**Result**: ✅ **2-6x faster** despite more calls

## Implementation Complexity

### Effort Estimation

| Task                          | Complexity | Effort          |
| ----------------------------- | ---------- | --------------- |
| Create individual schema      | Low        | 2-4 hours       |
| Implement individual analysis | Medium     | 8-12 hours      |
| Create result storage module  | Low        | 4-6 hours       |
| Implement post-processor      | Medium     | 8-12 hours      |
| Update providers              | Low        | 2-4 hours       |
| Update cache strategy         | Medium     | 4-6 hours       |
| Add CLI flag                  | Low        | 1-2 hours       |
| Testing                       | Medium     | 8-12 hours      |
| **Total**                     | **Medium** | **37-58 hours** |

### Risk Assessment

| Risk                       | Probability | Impact | Mitigation                                    |
| -------------------------- | ----------- | ------ | --------------------------------------------- |
| Post-processing bugs       | Medium      | High   | Extensive testing, reuse existing merge logic |
| Category misclassification | Medium      | Medium | Start simple, iterate based on data           |
| Storage issues             | Low         | Low    | Use atomic writes, handle errors gracefully   |
| Performance regression     | Low         | Medium | Benchmark before/after, parallel processing   |
| Breaking changes           | Low         | High   | Feature flag, keep batch mode as fallback     |

## Migration Strategy

### Phase 1: Parallel Implementation (Recommended)

1. Implement individual analysis alongside batch mode
2. Add `--analysis-mode=individual|batch` flag
3. Default to `individual` for Ollama, `batch` for cloud providers
4. Test both modes in parallel

### Phase 2: Validation

1. Run both modes on same datasets
2. Compare results quality
3. Measure performance differences
4. Collect user feedback

### Phase 3: Gradual Migration

1. Make individual mode default for all providers
2. Keep batch mode as fallback
3. Monitor for issues
4. Eventually deprecate batch mode

## Recommendations

### ✅ **Proceed with Implementation**

**Rationale**:

1. **Clear Benefits**: Better context preservation, faster processing, better caching
2. **Manageable Challenges**: All identified challenges have viable mitigations
3. **Low Risk**: Can implement alongside existing system, gradual migration
4. **Better UX**: Resumable analysis, incremental processing, faster results

### Implementation Priorities

1. **High Priority**:
   - Individual analysis function
   - Simple categorization schema
   - Result storage module
   - Post-processor

2. **Medium Priority**:
   - Cache strategy update
   - CLI flag
   - Parallel processing

3. **Low Priority**:
   - Advanced categorization
   - Result compression
   - Analytics/metrics

### Success Criteria

- ✅ Individual analysis produces accurate categorizations
- ✅ Post-processing generates equivalent or better reports
- ✅ Performance is equal or better than batch mode
- ✅ Cache hit rate improves (>80% for repeated analyses)
- ✅ No regression in result quality

## Conclusion

The proposed individual prompt analysis approach is **technically viable** and offers significant advantages over the current batch-based system:

- **Better accuracy** through context preservation
- **Better performance** through parallelization and caching
- **Better UX** through resumability and incremental processing
- **Better fit** for Ollama's token constraints

The challenges are manageable and have clear mitigation strategies. The implementation effort is moderate (~40-60 hours) and can be done incrementally without breaking existing functionality.

**Recommendation**: ✅ **Proceed with implementation** using the phased migration strategy outlined above.

---

**Document Version**: 1.0  
**Date**: 2025-01-20  
**Author**: Technical Analysis  
**Status**: Approved for Implementation
