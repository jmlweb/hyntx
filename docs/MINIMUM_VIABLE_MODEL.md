# Minimum Viable Model for Ollama

## Executive Summary

**Minimum viable model: `gemma3:4b` (2-3B parameters, ~2GB disk, ~2-5s/prompt CPU)**

This document documents the findings from the analysis to determine the minimum viable Ollama model that can generate valid and useful results with Hyntx.

**Quick recommendations**:

- **Minimal viable**: `gemma3:4b` (2B) - Fast, lightweight, good for daily use
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
| `gemma3:4b` | 2-3B       | ~2GB      | Minimal | ✅ Works | Excellent | ~2-5s/prompt |
| `gemma3:4b` | 4B         | ~3.3GB    | Minimal | ✅ Works | Excellent | ~3-6s/prompt |

### Quality Analysis

**Test performed**: Analysis of 52 prompts from current day

**Results with `gemma3:4b`**:

- ✅ Valid JSON generated correctly
- ✅ Valid and consistent issue IDs (no-context, vague, too-broad, imperative)
- ✅ Complete structure with patterns, stats, topSuggestion
- ✅ Before/After examples present and useful
- ✅ Reasonable scores (0-100 scale)
- ✅ No parsing errors

**Results with `gemma3:4b`**:

- ✅ Identical results to `gemma3:4b`
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

### `gemma3:4b` (default)

**Reasons**:

- ✅ It's the system default model
- ✅ Classified as "micro" (automatically uses minimal schema)
- ✅ Works perfectly in real tests
- ✅ Reasonable balance between size and capability
- ✅ Manageable size (~2GB on disk)
- ✅ Acceptable speed on CPU/GPU

**Configuration**:

```bash
export HYNTX_OLLAMA_MODEL=gemma3:4b
export HYNTX_OLLAMA_HOST=http://localhost:11434
```

## Recommended Balanced Model

### `mistral:7b` (Best Quality/Performance Balance)

**For most users looking for the best balance between quality and resources, `mistral:7b` is the recommended choice.**

**Why it's the balanced choice**:

- ✅ **Better quality**: Uses the "Small Schema" (more detailed than Minimal Schema used by `gemma3:4b`)
  - Better analysis quality with pattern detection and basic analysis
  - Some custom examples extracted from your prompts
  - Basic contextual information included
- ✅ **Manageable resources**: ~4GB disk space, ~5-10s/prompt on CPU (without GPU)
- ✅ **Performance**: Good balance between quality and speed
  - Recommended for production analysis and code reviews
  - Works well on modern hardware (8GB+ RAM recommended)
  - Compatible with Intel i7/i9, AMD Ryzen 7/9, and Apple M-series CPUs

**Configuration**:

```bash
# Install the model
ollama pull mistral:7b

# Configure Hyntx to use it
export HYNTX_OLLAMA_MODEL=mistral:7b
```

**When to use `mistral:7b`**:

- You want better analysis quality than `gemma3:4b` but don't need maximum quality
- You have modern hardware (8GB+ RAM, modern CPU)
- You're doing production analysis or code reviews
- You want custom examples from your prompts (not just taxonomy-based examples)

**Hardware considerations**:

- **Minimum**: 8GB RAM, modern multi-core CPU
- **Recommended**: 16GB+ RAM for better performance
- **GPU**: Optional but provides 10-50x speed improvement

## Alternative Models

### Micro Models (Minimal Schema)

| Model       | Parameters | Disk Size | Speed (CPU)  | Status                   |
| ----------- | ---------- | --------- | ------------ | ------------------------ |
| `gemma3:4b` | 2-3B       | ~2GB      | ~2-5s/prompt | ✅ Recommended (default) |
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
export HYNTX_OLLAMA_MODEL=gemma3:4b
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
export HYNTX_OLLAMA_MODEL=gemma3:4b
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

**The confirmed minimum viable model is `gemma3:4b` (2-3B parameters, ~2GB disk)**.

This model:

- ✅ Works correctly with the minimal schema
- ✅ Generates valid and useful results
- ✅ Is the system default
- ✅ Provides optimal balance between size, speed, and quality
- ✅ Fast enough for daily use (~2-5s/prompt on CPU)

**Recommendations by use case**:

- **Daily development**: `gemma3:4b` (2-3B) - Minimal schema
- **Production analysis**: `mistral:7b` (7B) - Small schema
- **Team retrospectives**: `qwen2.5:14b` (14B) - Full schema
- **Maximum quality**: `llama3:70b` (70B) - Full schema (GPU needed)

Most users will find `gemma3:4b` sufficient. For deeper analysis, use models ≥ 7B parameters that support small or full schemas.

## Benchmark Results (2026-01-27)

### Test Configuration

- **Prompts analyzed**: 9 prompts from hyntx project
- **Hardware**: MacBook (Apple Silicon arm64)
- **Date of logs**: 2026-01-02

### Results by Model

| Model        | Time   | Score | Patterns | Status                    |
| ------------ | ------ | ----- | -------- | ------------------------- |
| gemma3:4b    | 44s ⚡ | 6/10  | 5        | ✅ **Best choice**        |
| codellama:7b | 82s    | 8/10  | 1        | ❌ Returns placeholders   |
| mistral:7b   | 89s    | 4/10  | 5        | ✅ Good                   |
| gemma3:4b    | 207s   | 6/10  | 5        | ⚠️ Slow, had counting bug |

### Key Findings

1. **gemma3:4b is the recommended default** - 4x faster than gemma3:4b with better results
2. **codellama:7b is NOT recommended** - Returns placeholder text instead of real analysis
3. **gemma3:4b has bugs** - Reported 44 prompts when only 9 were analyzed (fixed in code)
4. **mistral:7b is reliable** - Good quality but slower than gemma3:4b

### Recommendation Update

Based on these benchmarks, the recommended models are:

1. **Daily use**: `gemma3:4b` (fast, accurate)
2. **Fallback**: `mistral:7b` (slower but reliable)
3. **Avoid**: `codellama:7b` (returns placeholder text)
