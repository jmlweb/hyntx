# Improve Small Ollama Model Compatibility

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: None
- **Estimation**: Medium-Large (2-3 days)
- **Status**: Epic (split into subtasks)

## Subtasks

This epic has been split into smaller, implementable tasks:

| Task                                                           | Priority | Estimation | Dependencies      |
| -------------------------------------------------------------- | -------- | ---------- | ----------------- |
| [ollama-disk-cache.md](./ollama-disk-cache.md)                 | P1       | 0.5 days   | None              |
| [ollama-adaptive-batching.md](./ollama-adaptive-batching.md)   | P1       | 0.5-1 day  | disk-cache        |
| [ollama-progressive-schema.md](./ollama-progressive-schema.md) | P2       | 1 day      | adaptive-batching |

## Description

Small Ollama models (2-4GB like llama3.2, gemma3:4b) fail to consistently follow JSON format instructions when analyzing prompts. This severely limits the tool's usability for users who want to run analysis locally without cloud API costs.

### Current Problem

Models in the 2-4GB range exhibit the following issues:

1. **Inconsistent JSON output**: Instead of following the requested schema, models often return:
   - Narrative text with embedded JSON
   - Completely different JSON structures (e.g., summarizing prompts instead of analyzing them)
   - Empty objects `{}`
   - Arrays instead of objects

2. **Truncated responses**: When processing many prompts, responses get cut off mid-JSON, resulting in parse errors

3. **Missing required fields**: Even when JSON structure is correct, fields like `score` or `tip` are often omitted

4. **Batch size sensitivity**: Works reasonably with ~50 prompts but fails consistently with 300+

### Root Cause Analysis

Small models have limited instruction-following capability. The original SYSTEM_PROMPT was too complex:

- Multiple nested object structures
- Specific field requirements (id, name, frequency, severity, examples, suggestion, beforeAfter)
- Long guidelines text competing with actual task

## Objective

Make hyntx work reliably with small local Ollama models (2-4GB) while maintaining quality output for users who can't or don't want to use cloud APIs.

## Scope

### Includes

- Robust JSON parsing with error recovery
- Adaptive schema based on model capability
- Better batching strategy for small models
- Disk cache for intermediate results
- Clear documentation of model requirements
- Graceful degradation when model output is poor

### Excludes

- Requiring users to install larger models
- Removing support for cloud providers
- Changing the user-facing output format

## Proposed Solutions

### Solution 1: Disk Cache for Intermediate Results

**Priority: High | Complexity: Medium**

Persist batch results to disk to avoid reprocessing on failures.

#### Implementation

```typescript
// Location: .hyntx-cache/analysis/
interface CachedBatchResult {
  batchHash: string; // Hash of prompts in batch
  modelId: string; // e.g., "llama3.2:latest"
  systemPromptHash: string; // To invalidate on prompt changes
  timestamp: number;
  result: AnalysisResult;
}

// Cache key: SHA256(sorted prompts + modelId + systemPromptHash)
```

#### Benefits

- **Resiliency**: If batch 8/10 fails, batches 1-7 are preserved
- **Watch mode**: Reuse analysis for unchanged prompts
- **Debugging**: Inspect what each batch returned
- **Cost savings**: Don't re-analyze identical prompts

#### Cache Invalidation

- Model change → invalidate all
- SYSTEM_PROMPT change → invalidate all
- TTL expiration (configurable, default 7 days)
- Manual: `hyntx --clear-cache`

### Solution 2: Adaptive Micro-Batching

**Priority: High | Complexity: Medium**

Detect model size and adjust batch strategy dynamically.

#### Implementation

```typescript
const BATCH_STRATEGIES = {
  micro: {
    maxTokensPerBatch: 500,
    maxPromptsPerBatch: 3,
    targetModels: ['llama3.2', 'phi3:mini', 'gemma3:4b'],
  },
  small: {
    maxTokensPerBatch: 1500,
    maxPromptsPerBatch: 10,
    targetModels: ['mistral:7b', 'llama3:8b'],
  },
  standard: {
    maxTokensPerBatch: 3000,
    maxPromptsPerBatch: 50,
    targetModels: ['llama3:70b', 'mixtral'],
  },
} as const;

function detectBatchStrategy(modelName: string): BatchStrategy {
  // Match model name against known patterns
  // Fall back to 'micro' for unknown models (safer)
}
```

#### Streaming for Early Truncation Detection

Use Ollama's streaming API to detect problems early:

```typescript
const response = await fetch(`${host}/api/generate`, {
  body: JSON.stringify({
    model,
    prompt,
    stream: true, // Enable streaming
    // ...
  }),
});

let accumulated = '';
for await (const chunk of response.body) {
  accumulated += chunk.response;

  // Early detection: if we see truncation patterns, abort and retry
  if (looksLikeTruncatedJson(accumulated)) {
    controller.abort();
    return retryWithSmallerBatch();
  }
}
```

### Solution 3: Multi-Pass Progressive Schema

**Priority: High | Complexity: Medium**

Divide cognitive load across multiple simpler requests.

#### Pass 1: Issue Identification (Ultra-Simple)

```json
{
  "issues": ["vague", "no-context", "too-broad"],
  "score": 65
}
```

#### Pass 2: Issue Enrichment (Optional)

Only if Pass 1 succeeds and model shows capability:

```json
{
  "issue": "vague",
  "example": "Help me with my code",
  "fix": "Specify the programming language and what aspect needs help"
}
```

#### Aggregation in Code

The model only identifies issues; Node.js handles:

- Counting frequencies
- Calculating averages
- Grouping similar issues
- Generating final report

This removes aggregation burden from the model.

### Solution 4: Capability Probe

**Priority: Medium | Complexity: Low**

Test model capability before processing full workload.

```typescript
async function probeModelCapability(
  provider: OllamaProvider,
): Promise<ModelCapability> {
  const testPrompt = 'Analyze this prompt: "Help me with code"';

  try {
    const result = await provider.analyze([testPrompt], '2025-01-01');

    // Check response quality
    if (hasValidStructure(result) && hasRequiredFields(result)) {
      return 'full'; // Can handle complex schema
    } else if (isValidJson(result)) {
      return 'simple'; // Use simplified schema
    }
  } catch {
    return 'minimal'; // Use ultra-minimal schema
  }

  return 'minimal';
}
```

### Solution 5: Fallback to Prompt-by-Prompt

**Priority: High | Complexity: Low**

When batch processing fails, fall back to individual processing.

```typescript
async function analyzeWithFallback(
  provider: AnalysisProvider,
  batch: Batch,
  date: string,
): Promise<AnalysisResult[]> {
  try {
    // Try batch first
    return [await provider.analyze(batch.prompts, date)];
  } catch (error) {
    if (isBatchSizeError(error) || isJsonParseError(error)) {
      logger.warn('Batch failed, falling back to individual processing');

      // Process one by one
      const results: AnalysisResult[] = [];
      for (const prompt of batch.prompts) {
        try {
          results.push(await provider.analyze([prompt], date));
        } catch {
          // Skip failed individual prompts, log warning
          logger.warn(`Skipped prompt: ${prompt.slice(0, 50)}...`);
        }
      }
      return results;
    }
    throw error;
  }
}
```

### Solution 6: Retry with Feedback Loop

**Priority: Medium | Complexity: Medium**

When JSON parsing fails, ask model to fix its response.

```typescript
async function analyzeWithRetry(prompt: string): Promise<AnalysisResult> {
  const firstAttempt = await callModel(prompt);

  if (isValidJson(firstAttempt)) {
    return parseResponse(firstAttempt);
  }

  // Ask model to fix
  const fixPrompt = `Your previous response was invalid JSON.
Here's what you returned:
${firstAttempt.slice(0, 500)}

Please respond with ONLY valid JSON matching this schema:
{"issues": [...], "score": number}`;

  const secondAttempt = await callModel(fixPrompt);
  return parseResponse(secondAttempt);
}
```

## Implementation Plan

### Phase 1: Foundation (Day 1)

1. **Implement disk cache system**
   - Create `src/cache/analysis-cache.ts`
   - Add cache read/write/invalidate functions
   - Integrate with `analyzePrompts()` in analyzer.ts
   - Add `--clear-cache` CLI flag

2. **Add capability probe**
   - Create `src/providers/probe.ts`
   - Run probe on first Ollama use
   - Store capability result in cache

### Phase 2: Adaptive Processing (Day 2)

3. **Implement micro-batching**
   - Update `PROVIDER_LIMITS` structure to support strategies
   - Add model detection in `OllamaProvider`
   - Implement streaming with early abort

4. **Add fallback mechanism**
   - Wrap batch processing with fallback logic
   - Add retry counter per batch
   - Log fallback events for debugging

### Phase 3: Schema Simplification (Day 3)

5. **Multi-pass progressive schema**
   - Create simplified schema variants
   - Implement pass orchestration
   - Move aggregation logic to Node.js

6. **Testing and documentation**
   - Test with llama3.2, gemma3:4b, codellama:7b
   - Document model recommendations
   - Update README with compatibility notes

## Files to Create/Modify

### New Files

- `src/cache/analysis-cache.ts` - Disk cache implementation
- `src/providers/probe.ts` - Model capability detection
- `src/providers/schemas.ts` - Schema variants (full, simple, minimal)
- `docs/MODELS.md` - Model compatibility documentation

### Modified Files

- `src/providers/ollama.ts` - Add streaming, capability detection
- `src/providers/base.ts` - Multiple schema definitions
- `src/types/index.ts` - Update types for cache and strategies
- `src/core/analyzer.ts` - Integrate cache, fallback, multi-pass
- `src/cli/commands.ts` - Add `--clear-cache` flag

## Acceptance Criteria

- [ ] Analysis succeeds with llama3.2 (2GB) on 300+ prompts
- [ ] Analysis succeeds with gemma3:4b (3.3GB) on 300+ prompts
- [ ] Cache persists between runs and speeds up repeated analysis
- [ ] Graceful fallback when batch processing fails
- [ ] Clear error messages when model output is unusable
- [ ] No regression for cloud providers (Anthropic, Google)
- [ ] Tests pass including new model compatibility tests
- [ ] Documentation updated with model recommendations

## Test Cases

### Cache Tests

- [ ] Cache hit returns stored result without API call
- [ ] Cache miss triggers fresh analysis
- [ ] Cache invalidates on model change
- [ ] Cache invalidates on SYSTEM_PROMPT change
- [ ] `--clear-cache` removes all cached data

### Batching Tests

- [ ] Micro-batch strategy selected for small models
- [ ] Standard strategy selected for large models
- [ ] Unknown models default to micro (safe)

### Fallback Tests

- [ ] Batch failure triggers prompt-by-prompt processing
- [ ] Individual prompt failures are skipped gracefully
- [ ] Partial results are merged correctly

### Integration Tests

- [ ] Small model with 10 prompts - should succeed
- [ ] Small model with 100 prompts - should succeed
- [ ] Small model with 500 prompts - should succeed or degrade gracefully
- [ ] Truncated JSON response - should be detected and retried
- [ ] Wrong schema response - should trigger simplified schema
- [ ] Cloud provider - should continue working unchanged

## References

- See `src/providers/base.ts` for current SYSTEM_PROMPT
- See `src/types/index.ts` for PROVIDER_LIMITS
- Ollama API docs: <https://github.com/ollama/ollama/blob/main/docs/api.md>
- Ollama streaming: <https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-completion>
