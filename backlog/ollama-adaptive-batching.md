# Adaptive Micro-Batching for Small Models

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: ollama-disk-cache.md
- **Estimation**: Small-Medium (0.5-1 day)
- **Parent**: improve-small-model-compatibility.md

## Description

Implement adaptive batch sizing based on detected model capabilities. Small models (< 7B parameters) need much smaller batches to produce valid JSON output.

## Objective

Automatically detect model size and adjust batch strategy to maximize success rate while minimizing API calls.

## Implementation

### Batch Strategies

```typescript
const BATCH_STRATEGIES = {
  micro: {
    maxTokensPerBatch: 500,
    maxPromptsPerBatch: 3,
    description: 'For models < 4GB',
  },
  small: {
    maxTokensPerBatch: 1500,
    maxPromptsPerBatch: 10,
    description: 'For models 4-7GB',
  },
  standard: {
    maxTokensPerBatch: 3000,
    maxPromptsPerBatch: 50,
    description: 'For models > 7GB',
  },
} as const;
```

### Model Detection

```typescript
const MODEL_STRATEGY_MAP: Record<string, keyof typeof BATCH_STRATEGIES> = {
  // Micro (< 4GB)
  'llama3.2': 'micro',
  'phi3:mini': 'micro',
  'gemma3:4b': 'micro',
  'gemma2:2b': 'micro',

  // Small (4-7GB)
  'mistral:7b': 'small',
  'llama3:8b': 'small',
  'codellama:7b': 'small',

  // Standard (> 7GB)
  'llama3:70b': 'standard',
  mixtral: 'standard',
  'qwen2.5:14b': 'standard',
};

function detectStrategy(modelName: string): BatchStrategy {
  // Check exact match first
  if (MODEL_STRATEGY_MAP[modelName]) {
    return BATCH_STRATEGIES[MODEL_STRATEGY_MAP[modelName]];
  }

  // Check partial match (e.g., "llama3.2:latest" matches "llama3.2")
  for (const [pattern, strategy] of Object.entries(MODEL_STRATEGY_MAP)) {
    if (modelName.includes(pattern)) {
      return BATCH_STRATEGIES[strategy];
    }
  }

  // Default to micro for unknown models (safest)
  return BATCH_STRATEGIES.micro;
}
```

### Fallback on Failure

When a batch fails, automatically retry with smaller batch:

```typescript
async function analyzeWithFallback(batch: Batch): Promise<AnalysisResult[]> {
  try {
    return [await provider.analyze(batch.prompts, date)];
  } catch (error) {
    if (shouldFallback(error)) {
      // Split batch in half and retry
      if (batch.prompts.length > 1) {
        const mid = Math.ceil(batch.prompts.length / 2);
        const left = await analyzeWithFallback({
          prompts: batch.prompts.slice(0, mid),
        });
        const right = await analyzeWithFallback({
          prompts: batch.prompts.slice(mid),
        });
        return [...left, ...right];
      }
      // Single prompt failed - skip it
      logger.warn(`Skipped prompt: ${batch.prompts[0]?.slice(0, 50)}...`);
      return [];
    }
    throw error;
  }
}
```

## Files to Create/Modify

### Modified Files

- `src/types/index.ts` - Add `BatchStrategy` type, update `PROVIDER_LIMITS`
- `src/providers/ollama.ts` - Add model detection logic
- `src/core/analyzer.ts` - Use detected strategy, add fallback logic

## Acceptance Criteria

- [ ] Micro strategy selected for known small models
- [ ] Standard strategy selected for known large models
- [ ] Unknown models default to micro (safe)
- [ ] Batch failure triggers automatic split-and-retry
- [ ] Single-prompt failures are skipped gracefully
- [ ] Logs indicate which strategy was selected

## Test Cases

- [ ] `llama3.2` → micro strategy
- [ ] `llama3.2:latest` → micro strategy (partial match)
- [ ] `mixtral:8x7b` → standard strategy
- [ ] `unknown-model` → micro strategy (default)
- [ ] Batch of 10 fails → splits to 5+5, retries
- [ ] Single prompt fails → skipped, no crash
