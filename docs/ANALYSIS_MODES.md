# Analysis Modes: Batch vs Individual

## Introduction

Hyntx offers two distinct analysis modes that balance speed and accuracy based on your needs. Understanding when to use each mode can significantly improve your workflow and the quality of insights you receive.

**Analysis modes control how prompts are processed:**

- **Batch Mode**: Processes multiple prompts together in a single API call for maximum speed
- **Individual Mode**: Processes each prompt separately for enhanced accuracy and nuanced categorization

Both modes use the same underlying AI models and pattern detection logic, but differ in how they approach the analysis task.

## Mode Comparison

| Feature               | Batch Mode                  | Individual Mode                |
| --------------------- | --------------------------- | ------------------------------ |
| **Speed**             | ~300-400ms per prompt       | ~1,000-1,500ms per prompt      |
| **Relative Speed**    | 3-4x faster                 | Baseline                       |
| **Accuracy**          | Good categorization         | Better, more nuanced detection |
| **Best For**          | Daily analysis, monitoring  | Deep analysis, learning        |
| **Prompt Processing** | 3 prompts per API call      | 1 prompt per API call          |
| **API Calls**         | Fewer (more efficient)      | More (one per prompt)          |
| **Pattern Detection** | Batch patterns across group | Individual patterns per prompt |
| **Memory Usage**      | Lower                       | Higher                         |
| **Cache Efficiency**  | Higher                      | Standard                       |
| **Recommendation**    | Default for most use cases  | Quality-focused reviews        |

## Performance Benchmarks

### Real-World Performance (llama3.2)

Based on testing with 20 real user prompts from production logs:

#### Batch Mode

```text
Total Time: 8,100ms
Avg per Prompt: 405ms
Patterns Detected: 4
Categories: 3 unique
Overall Score: 6.5/10
```

#### Individual Mode

```text
Total Time: 26,900ms
Avg per Prompt: 1,345ms
Patterns Detected: 4
Categories: 4 unique
Overall Score: 5.8/10
```

#### Comparison Summary

- **Speedup**: 3.32x faster (batch mode)
- **Accuracy**: +1 category detected (individual mode)
- **Quality**: Similar pattern detection overall

### Performance by Model Size

Performance varies based on the Ollama model you're using:

| Model Size | Model Examples           | Batch Mode     | Individual Mode |
| ---------- | ------------------------ | -------------- | --------------- |
| Micro      | llama3.2, phi3:mini      | ~300-400ms     | ~1,200-1,500ms  |
| Small      | mistral:7b, llama3:8b    | ~500-700ms     | ~1,800-2,200ms  |
| Standard   | llama3:70b, mixtral:8x7b | ~1,000-1,500ms | ~3,000-4,000ms  |

**Note**: Times are per-prompt averages. Actual performance depends on hardware, model quantization, and prompt complexity.

## When to Use Each Mode

### Use Batch Mode When...

- **Daily monitoring**: Checking prompt quality as part of your regular workflow
- **Quick feedback**: You want fast insights without waiting
- **Large datasets**: Analyzing many prompts at once (10+ prompts)
- **CI/CD integration**: Running analysis in automated pipelines
- **Iterative improvements**: Making frequent small adjustments based on feedback
- **General quality checks**: Ensuring prompts meet basic standards

**Example scenarios:**

```bash
# End-of-day review of all prompts
hyntx --date today

# Weekly analysis across a project
hyntx --from 2025-01-20 --to 2025-01-27 --project backend-api

# Watch mode for real-time monitoring
hyntx --watch --project my-app
```

### Use Individual Mode When...

- **Deep analysis**: You need detailed, nuanced feedback on each prompt
- **Learning sessions**: Studying prompt engineering patterns and best practices
- **Critical prompts**: Analyzing high-stakes or complex prompts
- **Quality audits**: Conducting thorough reviews of prompt quality
- **Teaching/training**: Demonstrating prompt engineering concepts with detailed examples
- **Debugging**: Investigating why specific prompts aren't working well

**Example scenarios:**

```bash
# Deep analysis of today's most important prompts
hyntx --analysis-mode individual --date today --project critical-feature

# Detailed review of a specific session
hyntx -m individual --date 2025-01-20

# Learning mode - study patterns in depth
hyntx -m individual --from 2025-01-15 --to 2025-01-20
```

## Technical Details

### How Batch Mode Works

1. **Batching**: Groups up to 3 prompts together based on token limits
2. **Single API Call**: Sends all prompts in one request to the AI model
3. **Batch Schema**: Uses minimal schema optimized for fast processing
4. **Aggregation**: Combines results across the batch into unified patterns

**Advantages:**

- Fewer API calls = faster overall processing
- Lower network overhead
- Better for rate-limited APIs

**Trade-offs:**

- Less context per individual prompt
- May miss nuanced issues specific to single prompts

### How Individual Mode Works

1. **Sequential Processing**: Analyzes each prompt separately
2. **Multiple API Calls**: One request per prompt to the AI model
3. **Individual Schema**: Uses detailed schema with per-prompt categorization
4. **Fine-grained Analysis**: Captures subtle patterns and issues

**Advantages:**

- More context for each prompt
- Better categorization accuracy
- Detailed per-prompt feedback

**Trade-offs:**

- Slower overall processing
- More API calls and network overhead
- Higher resource usage

## Configuration and Usage

### Command-Line Interface

```bash
# Use batch mode (default)
hyntx
hyntx --analysis-mode batch

# Use individual mode
hyntx --analysis-mode individual
hyntx -m individual  # Short form

# Combine with other flags
hyntx -m individual --date yesterday --project backend
hyntx -m batch --watch --quiet
```

### Environment Configuration

Set default mode in `.hyntxrc.json`:

```json
{
  "analysisMode": "batch"
}
```

**Note**: CLI flags override configuration file settings.

### Programmatic Usage

```typescript
import { analyzePrompts } from 'hyntx/api';
import { OllamaProvider } from 'hyntx';

// Batch mode
const batchProvider = new OllamaProvider({
  host: 'http://localhost:11434',
  model: 'llama3.2',
  schemaOverride: 'batch',
});

// Individual mode
const individualProvider = new OllamaProvider({
  host: 'http://localhost:11434',
  model: 'llama3.2',
  schemaOverride: 'individual',
});

const result = await analyzePrompts({
  provider: individualProvider,
  prompts: ['Your prompt here'],
  date: '2025-01-20',
});
```

## Examples: Side-by-Side Comparison

### Example 1: Vague Request

**Prompt**: "fix the bug"

#### Batch Mode Output

```text
Pattern: Vague Request
Severity: high
Frequency: 1

Suggestion:
Provide specific details about the bug, including error messages,
affected functionality, and steps to reproduce.
```

#### Individual Mode Output

```text
Pattern: Vague Request (vague-request)
Severity: high
Status: needs-improvement

Problems:
- No bug description provided
- Missing context about what's broken
- No error information included

Categories: vague-request, missing-context

Suggestion:
Instead of "fix the bug", try:
"Fix authentication bug where users get 401 errors after password reset.
Error occurs in src/auth/reset.ts line 42. Steps to reproduce:
1. Request password reset
2. Click email link
3. Set new password
4. Try to log in immediately"

Example:
Before: "fix the bug"
After: "Fix the authentication bug causing 401 errors post-password-reset"
```

### Example 2: Missing Context

**Prompt**: "add tests"

#### Batch Mode Output

```text
Pattern: Missing Context
Severity: medium
Frequency: 1

Suggestion:
Specify which module, component, or function needs tests and what
scenarios should be covered.
```

#### Individual Mode Output

```text
Pattern: Missing Context (missing-context)
Severity: high
Status: needs-improvement

Problems:
- No target specified for tests
- Test type unclear (unit, integration, e2e)
- Missing coverage requirements

Categories: missing-context, unclear-goal

Suggestion:
Instead of "add tests", provide:
- What to test (specific module/function)
- Type of tests needed
- Coverage expectations
- Key scenarios to cover

Example:
Before: "add tests"
After: "Add unit tests for the payment module (src/payments/stripe.ts).
Cover successful payment, failed payment, and refund scenarios.
Aim for 80% code coverage."
```

## FAQ

### Which mode should I use as a beginner?

Start with **batch mode** for daily use. It's faster and provides good feedback for most situations. Switch to individual mode when you're learning specific prompt engineering patterns or need detailed analysis.

### Can I mix both modes?

Yes! Use batch mode for daily monitoring and individual mode for deep-dive sessions:

```bash
# Daily quick check
hyntx --analysis-mode batch

# Weekly deep analysis
hyntx -m individual --from 2025-01-15 --to 2025-01-22
```

### Does individual mode always detect more patterns?

Not necessarily. Individual mode provides more nuanced categorization, but batch mode is also effective. The main difference is in the level of detail and per-prompt context, not raw pattern count.

### Will individual mode work in watch mode?

Yes, but it will be slower. Each new prompt will take ~1-1.5 seconds to analyze instead of ~300-400ms. This might be acceptable for low-frequency prompting.

```bash
# Watch mode with individual analysis (slower but detailed)
hyntx --watch -m individual --project critical-app
```

### Does mode affect caching?

Both modes benefit from caching equally. Once a prompt is analyzed in a specific mode, subsequent requests for the same prompt in the same mode will use the cached result.

### Can I change modes between runs?

Yes. The mode is determined per-run. You can analyze the same prompts in both modes to compare results:

```bash
# Analyze in batch mode
hyntx --date 2025-01-20

# Re-analyze same date in individual mode
hyntx --date 2025-01-20 -m individual --no-cache
```

### Which mode uses more resources?

Individual mode uses more:

- **API calls**: 3-4x more requests to the AI model
- **Time**: 3-4x longer processing time
- **Memory**: Slightly higher (negligible for most use cases)

### Are the patterns different between modes?

The pattern taxonomy is the same, but individual mode may detect more subtle patterns or provide better categorization due to focused per-prompt analysis.

## Troubleshooting

### Batch Mode is Faster But Misses Issues

This is expected behavior. Batch mode optimizes for speed. If you're missing critical patterns:

1. Use individual mode for that specific analysis
2. Review prompts that scored low in batch mode using individual mode
3. Use batch for monitoring, individual for deep dives

### Individual Mode is Too Slow

Individual mode is inherently slower. To speed it up:

1. Use a smaller model (llama3.2 instead of llama3:70b)
2. Reduce the number of prompts analyzed
3. Enable caching (default) to avoid re-analyzing
4. Consider using batch mode for daily use

### Results Differ Significantly Between Modes

This can happen for complex prompts. Individual mode provides more context per prompt, leading to different categorization. Both are valid - choose based on your needs:

- Need speed? Trust batch mode results
- Need accuracy? Trust individual mode results

### Mode Selection Doesn't Work

Verify your configuration:

```bash
# Check that Ollama is running
ollama list

# Test configuration
hyntx --check-config

# Force mode explicitly
hyntx -m individual --verbose
```

## Performance Tuning

### Optimizing Batch Mode

- **Use micro models**: llama3.2, phi3:mini for fastest results
- **Enable caching**: Default behavior, but verify with --verbose
- **Process during off-hours**: Less competition for model resources
- **Limit date ranges**: Fewer prompts = faster overall time

### Optimizing Individual Mode

- **Filter prompts**: Use --project to analyze only relevant prompts
- **Use watch mode**: Analyze prompts one at a time as created
- **Smaller models**: Micro models are fast enough for individual analysis
- **Batch similar sessions**: Analyze related prompts together

## Comparison Script

To compare modes with your own dataset, use the built-in comparison script:

```bash
# Install tsx (TypeScript execution tool)
npm install -g tsx

# Compare batch vs individual on fixture data
tsx scripts/compare-batch-vs-individual.ts

# Or use npx (no installation required)
npx tsx scripts/compare-batch-vs-individual.ts

# With custom model
OLLAMA_MODEL=mistral:7b tsx scripts/compare-batch-vs-individual.ts

# With remote Ollama instance
OLLAMA_HOST=http://remote:11434 tsx scripts/compare-batch-vs-individual.ts
```

**Prerequisites:**

- Ollama must be running (default: http://localhost:11434)
- Model must be installed (default: llama3.2)

The script outputs:

- Time metrics for both modes
- Pattern detection counts
- Quality scores
- Speedup calculation
- Recommendation based on results

## Related Documentation

- [Hybrid Implementation Results](./HYBRID_IMPLEMENTATION_RESULTS.md) - Technical details of the implementation
- [Configuration Guide](./CONFIGURATION.md) - Full configuration options
- [Ollama Setup](./OLLAMA_SETUP.md) - Setting up local AI models
- [Performance Tuning](./PERFORMANCE.md) - Advanced performance optimization

---

**Last Updated**: 2025-01-20
**Version**: 2.6.0
