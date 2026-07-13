import { describe, expect, it } from 'vitest';

import type { AnalysisResult } from '../types/index.js';
import {
  autoCorrectResult,
  validateSemantics,
  type ValidationResult,
} from './semantic-validator.js';

// Helper to create a valid base result
function createResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    date: '2025-01-15',
    patterns: [],
    stats: { totalPrompts: 10, promptsWithIssues: 0, overallScore: 90 },
    topSuggestion: 'Be more specific',
    ...overrides,
  };
}

// Helper to create a pattern
function createPattern(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vague',
    name: 'Vague Request',
    frequency: 3,
    severity: 'high' as const,
    examples: ['help me'],
    suggestion: 'Be specific',
    beforeAfter: { before: 'help me', after: 'Help me fix X in Y' },
    ...overrides,
  };
}

describe('validateSemantics', () => {
  it('returns valid for a well-formed result', () => {
    const result = createResult({
      patterns: [createPattern()],
      stats: { totalPrompts: 10, promptsWithIssues: 3, overallScore: 70 },
    });
    const validation = validateSemantics(result, ['help me', 'fix bug']);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it('detects score-mismatch when score is outside expected range for issue count', () => {
    const result = createResult({
      patterns: [
        createPattern(),
        createPattern({ id: 'no-context' }),
        createPattern({ id: 'too-broad' }),
      ],
      stats: { totalPrompts: 10, promptsWithIssues: 7, overallScore: 95 },
    });
    const validation = validateSemantics(result, ['help me']);
    expect(validation.issues.some((i) => i.type === 'score-mismatch')).toBe(
      true,
    );
  });

  it('detects empty-patterns with low score', () => {
    const result = createResult({
      patterns: [],
      stats: { totalPrompts: 10, promptsWithIssues: 0, overallScore: 50 },
    });
    const validation = validateSemantics(result, ['some prompt']);
    expect(validation.issues.some((i) => i.type === 'empty-patterns')).toBe(
      true,
    );
  });

  it('detects duplicate-issues', () => {
    const result = createResult({
      patterns: [
        createPattern({ id: 'vague' }),
        createPattern({ id: 'vague' }),
      ],
    });
    const validation = validateSemantics(result, ['help me']);
    expect(validation.issues.some((i) => i.type === 'duplicate-issues')).toBe(
      true,
    );
  });

  it('detects example-not-found when examples do not match prompts', () => {
    const result = createResult({
      patterns: [
        createPattern({
          examples: ['this example does not exist in any prompt at all'],
        }),
      ],
    });
    const validation = validateSemantics(result, [
      'completely different text here',
    ]);
    expect(validation.issues.some((i) => i.type === 'example-not-found')).toBe(
      true,
    );
  });

  it('detects stats-inconsistent when promptsWithIssues exceeds totalPrompts', () => {
    const result = createResult({
      stats: { totalPrompts: 3, promptsWithIssues: 12, overallScore: 6 },
    });
    const validation = validateSemantics(result, ['a', 'b', 'c']);
    const issue = validation.issues.find(
      (i) => i.type === 'stats-inconsistent',
    );
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(validation.valid).toBe(false);
  });

  it('detects unknown-pattern-id for IDs not in taxonomy', () => {
    const result = createResult({
      patterns: [
        createPattern({ id: 'vague-project-name', name: 'Vague Project Name' }),
      ],
      stats: { totalPrompts: 3, promptsWithIssues: 2, overallScore: 5 },
    });
    const validation = validateSemantics(result, ['help me']);
    expect(validation.issues.some((i) => i.type === 'unknown-pattern-id')).toBe(
      true,
    );
  });

  it('does not flag valid taxonomy IDs', () => {
    const result = createResult({
      patterns: [
        createPattern({ id: 'vague' }),
        createPattern({ id: 'no-context', name: 'Missing Context' }),
      ],
      stats: { totalPrompts: 10, promptsWithIssues: 5, overallScore: 5 },
    });
    const validation = validateSemantics(result, ['help me']);
    expect(
      validation.issues.filter((i) => i.type === 'unknown-pattern-id'),
    ).toHaveLength(0);
  });

  it('detects placeholder-example in pattern examples', () => {
    const result = createResult({
      patterns: [createPattern({ examples: ['example prompt 1'] })],
      stats: { totalPrompts: 3, promptsWithIssues: 2, overallScore: 5 },
    });
    const validation = validateSemantics(result, ['example prompt 1']);
    expect(
      validation.issues.some((i) => i.type === 'placeholder-example'),
    ).toBe(true);
  });
});

describe('autoCorrectResult', () => {
  it('adjusts score to expected range midpoint', () => {
    const result = createResult({
      patterns: [
        createPattern(),
        createPattern({ id: 'no-context' }),
        createPattern({ id: 'too-broad' }),
      ],
      stats: { totalPrompts: 10, promptsWithIssues: 7, overallScore: 95 },
    });
    const validation = validateSemantics(result, ['help me']);
    const corrected = autoCorrectResult(result, validation);
    expect(corrected.stats.overallScore).toBeLessThan(95);
  });

  it('removes duplicate patterns', () => {
    const result = createResult({
      patterns: [
        createPattern({ id: 'vague' }),
        createPattern({ id: 'vague' }),
      ],
    });
    const validation: ValidationResult = {
      valid: true,
      issues: [
        {
          type: 'duplicate-issues',
          message: 'Duplicate: vague',
          severity: 'warning',
        },
      ],
    };
    const corrected = autoCorrectResult(result, validation);
    expect(corrected.patterns).toHaveLength(1);
  });

  it('clamps promptsWithIssues to totalPrompts', () => {
    const result = createResult({
      stats: { totalPrompts: 3, promptsWithIssues: 12, overallScore: 6 },
    });
    const validation: ValidationResult = {
      valid: false,
      issues: [
        {
          type: 'stats-inconsistent',
          message: 'promptsWithIssues exceeds totalPrompts',
          severity: 'error',
        },
      ],
    };
    const corrected = autoCorrectResult(result, validation);
    expect(corrected.stats.promptsWithIssues).toBe(3);
    expect(corrected.stats.totalPrompts).toBe(3);
  });

  it('maps unknown pattern IDs to taxonomy', () => {
    const result = createResult({
      patterns: [
        createPattern({
          id: 'vague-project-name',
          name: 'Vague Project Name',
          severity: 'high',
          suggestion: 'custom suggestion',
        }),
      ],
    });
    const validation: ValidationResult = {
      valid: true,
      issues: [
        {
          type: 'unknown-pattern-id',
          message: 'Unknown: vague-project-name',
          severity: 'warning',
        },
      ],
    };
    const corrected = autoCorrectResult(result, validation);
    expect(corrected.patterns[0]?.id).toBe('vague');
    expect(corrected.patterns[0]?.name).toBe('Vague Request');
  });

  it('deduplicates patterns after remapping IDs', () => {
    const result = createResult({
      patterns: [
        createPattern({ id: 'vague-project-name', name: 'Vague Project' }),
        createPattern({ id: 'vague', name: 'Vague Request' }),
      ],
    });
    const validation: ValidationResult = {
      valid: true,
      issues: [
        {
          type: 'unknown-pattern-id',
          message: 'Unknown: vague-project-name',
          severity: 'warning',
        },
      ],
    };
    const corrected = autoCorrectResult(result, validation);
    expect(corrected.patterns.filter((p) => p.id === 'vague')).toHaveLength(1);
  });

  it('removes placeholder examples', () => {
    const result = createResult({
      patterns: [
        createPattern({ examples: ['example prompt 1', 'real user prompt'] }),
      ],
    });
    const validation: ValidationResult = {
      valid: true,
      issues: [
        {
          type: 'placeholder-example',
          message: 'Placeholder detected',
          severity: 'warning',
        },
      ],
    };
    const corrected = autoCorrectResult(result, validation);
    expect(corrected.patterns[0]?.examples).toEqual(['real user prompt']);
  });
});
