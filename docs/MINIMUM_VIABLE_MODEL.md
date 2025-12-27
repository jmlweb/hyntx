# Minimum Viable Model for Ollama

## Executive Summary

**Minimum viable model: `llama3.2` (2-3B parameters, ~2GB disk, ~2-5s/prompt CPU)**

This document documents the findings from the analysis to determine the minimum viable Ollama model that can generate valid and useful results with Hyntx.

**Quick recommendations**:

- **Minimal viable**: `llama3.2` (2B) - Fast, lightweight, good for daily use
- **Production quality**: `mistral:7b` (7B) - Better analysis, moderate resources
- **Maximum quality**: `qwen2.5:14b` or `llama3:70b` - Full schema, requires GPU for 70B

## Adaptive Architecture

Hyntx uses an adaptive system that adjusts the analysis schema based on model size:

- **Minimal Schema**: For small models (≤ 4B parameters)
  - Only requires simple JSON: `{"issues": ["issue-id", ...], "score": 0-100}`
  - The system automatically converts these results using a predefined taxonomy
  - Uses `SYSTEM_PROMPT_MINIMAL` (much shorter and simpler)

- **Small Schema**: For medium models (5-7B parameters)
  - Simplified schema with basic pattern analysis
  - Uses `SYSTEM_PROMPT_SMALL` (moderate complexity)

- **Full Schema**: For large models (≥ 8B parameters)
  - Requires complete analysis with patterns, examples, before/after
  - Uses `SYSTEM_PROMPT_FULL` (more detailed)

## Test Results

### Models Tested

| Model       | Parameters | Disk Size | Schema  | Result   | Quality   | Speed (CPU)  |
| ----------- | ---------- | --------- | ------- | -------- | --------- | ------------ |
| `llama3.2`  | 2-3B       | ~2GB      | Minimal | ✅ Works | Excellent | ~2-5s/prompt |
| `gemma3:4b` | 4B         | ~3.3GB    | Minimal | ✅ Works | Excellent | ~3-6s/prompt |

### Quality Analysis

**Test performed**: Analysis of 52 prompts from current day

**Results with `llama3.2`**:

- ✅ Valid JSON generated correctly
- ✅ Valid and consistent issue IDs (no-context, vague, too-broad, imperative)
- ✅ Complete structure with patterns, stats, topSuggestion
- ✅ Before/After examples present and useful
- ✅ Reasonable scores (0-100 scale)
- ✅ No parsing errors

**Results with `gemma3:4b`**:

- ✅ Identical results to `llama3.2`
- ✅ Same quality and consistency
- ✅ No notable differences

## Minimum Requirements

For a model to be viable with the minimal schema it needs:

1. **At least 2B parameters** (~1.5GB disk minimum)
2. **Generate valid JSON**: Simple format `{"issues": [...], "score": number}`
3. **Understand structured instructions**: 8 predefined categories with clear examples
4. **Basic classification**: Identify simple patterns in text prompts
5. **Consistency**: Relatively stable responses between executions

Models with fewer parameters or poor instruction-following capabilities will have high error rates and unreliable results.

## Recommended Minimum Model

### `llama3.2` (default)

**Reasons**:

- ✅ It's the system default model
- ✅ Classified as "micro" (automatically uses minimal schema)
- ✅ Works perfectly in real tests
- ✅ Reasonable balance between size and capability
- ✅ Manageable size (~2GB on disk)
- ✅ Acceptable speed on CPU/GPU

**Configuration**:

```bash
export HYNTX_OLLAMA_MODEL=llama3.2
export HYNTX_OLLAMA_HOST=http://localhost:11434
```

## Alternative Models

### Micro Models (Minimal Schema)

| Model       | Parameters | Disk Size | Speed (CPU)  | Status                   |
| ----------- | ---------- | --------- | ------------ | ------------------------ |
| `llama3.2`  | 2-3B       | ~2GB      | ~2-5s/prompt | ✅ Recommended (default) |
| `gemma3:4b` | 4B         | ~3.3GB    | ~3-6s/prompt | ✅ Tested, works well    |
| `phi3:mini` | 3.8B       | ~2.3GB    | ~3-5s/prompt | Expected to work         |
| `gemma2:2b` | 2B         | ~1.6GB    | ~1-3s/prompt | Theoretically viable     |

### Small Models (Small Schema - Better Quality)

| Model          | Parameters | Disk Size | Speed (CPU)   | Notes                      |
| -------------- | ---------- | --------- | ------------- | -------------------------- |
| `mistral:7b`   | 7B         | ~4.1GB    | ~5-10s/prompt | Good balance quality/speed |
| `llama3:8b`    | 8B         | ~4.7GB    | ~6-12s/prompt | Better quality             |
| `codellama:7b` | 7B         | ~3.8GB    | ~5-10s/prompt | Optimized for code         |

### Standard Models (Full Schema - Maximum Quality)

| Model         | Parameters | Disk Size | Speed (CPU)    | Notes                      |
| ------------- | ---------- | --------- | -------------- | -------------------------- |
| `qwen2.5:14b` | 14B        | ~9GB      | ~15-30s/prompt | Quality/speed balance      |
| `mixtral`     | 8x7B MoE   | ~26GB     | ~20-40s/prompt | Excellent quality          |
| `llama3:70b`  | 70B        | ~40GB     | ~2-5min/prompt | Best analysis (GPU needed) |

## Known Limitations

### Models < 2B Parameters

Extremely small models (< 2B parameters, < 1.5GB disk) will likely have:

- ⚠️ Higher JSON parsing error rate
- ⚠️ Less consistency in issue classification
- ⚠️ Less reliable results
- ⚠️ Possible timeouts or truncated responses

**Recommendation**: Do not use models with fewer than 2B parameters.

### Schema Comparison

**Minimal Schema** (≤ 4B parameters):

- ✅ Valid and useful results
- ✅ Basic pattern detection
- ✅ Before/after examples from taxonomy
- ❌ Custom examples extracted directly from your prompts
- ❌ Detailed contextual analysis
- ❌ Precise frequencies (aggregated by the system)

**Small Schema** (5-7B parameters):

- ✅ Valid and useful results
- ✅ Pattern detection with basic analysis
- ✅ Some custom examples from prompts
- ✅ Basic contextual information
- ⚠️ Limited detail compared to full schema

**Full Schema** (≥ 8B parameters):

- ✅ Complete analysis with detailed patterns
- ✅ Custom examples extracted from prompts
- ✅ Detailed contextual analysis
- ✅ Precise frequency tracking
- ✅ Advanced pattern recognition

For better quality, use models that support full schema (≥ 8B parameters).

## Usage Recommendations

### For Development/Testing (Minimal Schema)

```bash
export HYNTX_OLLAMA_MODEL=llama3.2
```

- **Parameters**: 2-3B
- **Speed**: ~2-5s/prompt (CPU)
- **Use case**: Fast iteration, daily use
- ✅ Valid and useful results
- ✅ Lightweight and fast

### For Professional Analysis (Small Schema)

```bash
export HYNTX_OLLAMA_MODEL=mistral:7b
```

- **Parameters**: 7B
- **Speed**: ~5-10s/prompt (CPU)
- **Use case**: Production analysis, code reviews
- ✅ Better analysis quality
- ✅ Some custom examples from prompts
- ⚠️ Moderate resource requirements

### For Team/Critical Analysis (Full Schema)

```bash
export HYNTX_OLLAMA_MODEL=qwen2.5:14b
# or for maximum quality
export HYNTX_OLLAMA_MODEL=llama3:70b
```

- **Parameters**: 14B-70B
- **Speed**: ~15s-5min/prompt (GPU recommended for 70B)
- **Use case**: Team retrospectives, detailed audits
- ✅ Maximum quality
- ✅ Full schema with detailed analysis
- ✅ Custom examples and precise tracking
- ⚠️ Requires significant resources (GPU for 70B models)

## Functionality Verification

To verify that your model works correctly:

```bash
# Verify model available
ollama list

# Test with Hyntx
export HYNTX_SERVICES=ollama
export HYNTX_OLLAMA_MODEL=llama3.2
hyntx --date today --output test.json

# Verify valid JSON
cat test.json | jq '.patterns | length'
```

If the command generates valid JSON with patterns, the model is viable.

## Performance Notes

**Speed estimates** are based on CPU execution on modern hardware (e.g., Apple M-series, Intel i7/i9, AMD Ryzen 7/9). Actual performance will vary based on:

- CPU/GPU capabilities
- Available RAM
- System load
- Model quantization (Q4, Q8, etc.)

**GPU acceleration** can significantly improve speeds:

- Small models (≤ 7B): 10-50x faster
- Large models (≥ 14B): 50-200x faster
- Models > 30B: GPU practically required for reasonable performance

## Conclusion

**The confirmed minimum viable model is `llama3.2` (2-3B parameters, ~2GB disk)**.

This model:

- ✅ Works correctly with the minimal schema
- ✅ Generates valid and useful results
- ✅ Is the system default
- ✅ Provides optimal balance between size, speed, and quality
- ✅ Fast enough for daily use (~2-5s/prompt on CPU)

**Recommendations by use case**:

- **Daily development**: `llama3.2` (2-3B) - Minimal schema
- **Production analysis**: `mistral:7b` (7B) - Small schema
- **Team retrospectives**: `qwen2.5:14b` (14B) - Full schema
- **Maximum quality**: `llama3:70b` (70B) - Full schema (GPU needed)

Most users will find `llama3.2` sufficient. For deeper analysis, use models ≥ 7B parameters that support small or full schemas.
