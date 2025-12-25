# Improve Small Ollama Model Compatibility

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: None
- **Estimation**: Medium (1-2 days)

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

### Temporary Fixes Applied (Not Committed)

During testing, these workarounds were applied:

1. **Simplified schema**: Reduced from complex nested structure to:

   ```json
   {
     "issues": [{ "name": "...", "example": "...", "fix": "..." }],
     "score": 75,
     "tip": "..."
   }
   ```

2. **Flexible validation**: Made `score` and `tip` optional with defaults

3. **JSON repair function**: Added `tryFixTruncatedJson()` to close unclosed brackets/braces

4. **Reduced batch size**: Changed `PROVIDER_LIMITS.ollama.maxTokensPerBatch` from 30,000 to 3,000 tokens

5. **Added `format: 'json'`**: Ollama API option to force JSON output mode

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
- Clear documentation of model requirements
- Graceful degradation when model output is poor

### Excludes

- Requiring users to install larger models
- Removing support for cloud providers
- Changing the user-facing output format

## Proposed Solutions

### Option A: Adaptive Schema (Recommended)

Detect model size/capability and use appropriate schema:

- Small models (< 7B): Ultra-simple schema, smaller batches, more retries
- Medium models (7B-13B): Simplified schema
- Large models (> 13B) / Cloud: Full schema

### Option B: Multi-Pass Analysis

1. First pass: Get raw issues list (simple format)
2. Second pass: Enrich with details (if model supports it)
3. Aggregate results

### Option C: Structured Output Templates

Use Ollama's template system to constrain output format more strictly.

### Option D: Retry with Feedback

When JSON parsing fails:

1. Parse what we can
2. Send back to model: "Your response was invalid. Fix this JSON: ..."
3. Retry up to N times

## Files to Create/Modify

- `src/providers/ollama.ts` - Add model capability detection, adaptive config
- `src/providers/base.ts` - Multiple schema definitions, robust parsing
- `src/types/index.ts` - Update PROVIDER_LIMITS structure
- `src/core/analyzer.ts` - Adaptive batching strategy
- `docs/MODELS.md` - Document recommended models and limitations

## Implementation

TBD - Depends on chosen solution approach

## Acceptance Criteria

- [ ] Analysis succeeds with llama3.2 (2GB) on 300+ prompts
- [ ] Analysis succeeds with gemma3:4b (3.3GB) on 300+ prompts
- [ ] Graceful error messages when model output is unusable
- [ ] No regression for cloud providers (Anthropic, Google)
- [ ] Tests pass including new model compatibility tests
- [ ] Documentation updated with model recommendations

## Test Cases

- [ ] Small model with 10 prompts - should succeed
- [ ] Small model with 100 prompts - should succeed
- [ ] Small model with 500 prompts - should succeed or fail gracefully
- [ ] Truncated JSON response - should be repaired or handled
- [ ] Wrong schema response - should be detected and retried
- [ ] Empty response - should fail gracefully with clear message
- [ ] Cloud provider - should continue working unchanged

## References

- See `src/providers/base.ts` for current SYSTEM_PROMPT
- See `src/types/index.ts` for PROVIDER_LIMITS
- Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
- Related issue: Local model JSON reliability
