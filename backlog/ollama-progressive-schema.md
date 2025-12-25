# Multi-Pass Progressive Schema for Small Models

## Metadata

- **Priority**: P2
- **Phase**: 2
- **Dependencies**: ollama-adaptive-batching.md
- **Estimation**: Medium (1 day)
- **Parent**: improve-small-model-compatibility.md

## Description

Implement a multi-pass analysis approach where the model performs simpler tasks in each pass, with aggregation handled in code. This reduces cognitive load on small models and improves JSON compliance.

## Objective

Split complex analysis into multiple simpler requests:

1. **Pass 1**: Identify issues (ultra-simple output)
2. **Pass 2**: Enrich details (optional, only if model shows capability)
3. **Aggregation**: Combine results in Node.js code

## Implementation

### Schema Variants

```typescript
// Pass 1: Ultra-simple (works with smallest models)
const SCHEMA_MINIMAL = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'string' } },
    score: { type: 'number' },
  },
};
// Expected: { "issues": ["vague", "no-context"], "score": 65 }

// Pass 2: Enrichment (optional)
const SCHEMA_ENRICHMENT = {
  type: 'object',
  properties: {
    issue: { type: 'string' },
    example: { type: 'string' },
    fix: { type: 'string' },
  },
};
// Expected: { "issue": "vague", "example": "Help me", "fix": "Be specific" }

// Full schema (for capable models)
const SCHEMA_FULL = {
  // Current schema with patterns, severity, etc.
};
```

### Issue Taxonomy

Predefined issue types that small models can identify:

```typescript
const ISSUE_TYPES = {
  vague: {
    name: 'Vague Request',
    severity: 'high',
    suggestion: 'Be more specific about what you need',
  },
  'no-context': {
    name: 'Missing Context',
    severity: 'high',
    suggestion: 'Provide relevant background information',
  },
  'too-broad': {
    name: 'Too Broad',
    severity: 'medium',
    suggestion: 'Break down into smaller, focused requests',
  },
  'no-goal': {
    name: 'No Clear Goal',
    severity: 'high',
    suggestion: 'State what outcome you want to achieve',
  },
  imperative: {
    name: 'Command Without Context',
    severity: 'low',
    suggestion: 'Explain why you need this',
  },
} as const;
```

### Aggregation Logic

```typescript
function aggregateResults(
  batchResults: MinimalResult[],
  date: string,
): AnalysisResult {
  // Count issue frequencies
  const issueCounts = new Map<string, number>();
  const scores: number[] = [];

  for (const result of batchResults) {
    scores.push(result.score);
    for (const issue of result.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1);
    }
  }

  // Convert to patterns
  const patterns: AnalysisPattern[] = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issueId, count]) => {
      const issueInfo = ISSUE_TYPES[issueId] || {
        name: issueId,
        severity: 'medium',
        suggestion: 'Review this pattern',
      };

      return {
        id: issueId,
        name: issueInfo.name,
        frequency: count,
        severity: issueInfo.severity,
        suggestion: issueInfo.suggestion,
        examples: [], // Populated in enrichment pass
      };
    });

  return {
    date,
    patterns,
    stats: {
      totalPrompts: batchResults.length,
      promptsWithIssues: batchResults.filter((r) => r.issues.length > 0).length,
      overallScore: Math.round(average(scores)),
    },
    topSuggestion: patterns[0]?.suggestion || 'Your prompts look good!',
  };
}
```

### System Prompts

```typescript
const SYSTEM_PROMPT_MINIMAL = `You analyze prompts for issues.
Respond with JSON only: {"issues": ["issue-id", ...], "score": 0-100}

Valid issue IDs: vague, no-context, too-broad, no-goal, imperative

Example:
Input: "Help me with code"
Output: {"issues": ["vague", "no-context"], "score": 40}`;

const SYSTEM_PROMPT_ENRICHMENT = `Given an issue found in a prompt, provide an example and fix.
Respond with JSON only: {"issue": "...", "example": "...", "fix": "..."}`;
```

## Files to Create/Modify

### New Files

- `src/providers/schemas.ts` - Schema variants and issue taxonomy
- `src/core/aggregator.ts` - Result aggregation logic

### Modified Files

- `src/providers/base.ts` - Use schema based on capability
- `src/providers/ollama.ts` - Multi-pass orchestration
- `src/core/analyzer.ts` - Integrate aggregation

## Acceptance Criteria

- [ ] Small models use minimal schema
- [ ] Issue identification works with 90%+ success rate
- [ ] Aggregation produces valid AnalysisResult
- [ ] Enrichment pass is optional and gracefully skipped
- [ ] No regression for cloud providers (use full schema)

## Test Cases

- [ ] Minimal schema produces valid JSON from llama3.2
- [ ] Unknown issue IDs are handled gracefully
- [ ] Empty issues array produces valid result
- [ ] Aggregation merges multiple batches correctly
- [ ] Score averaging works correctly
- [ ] Cloud providers still use full schema
