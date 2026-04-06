/**
 * Semantic Validation for Analysis Results
 *
 * Post-processing validation to catch logical inconsistencies
 * that JSON schema validation cannot detect.
 */

import { getExpectedScoreRange } from '../benchmark/gold-standard.js';
import type { AnalysisResult } from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import { ISSUE_TAXONOMY } from '../providers/schemas.js';

export type ValidationIssue = {
  readonly type:
    | 'score-mismatch'
    | 'example-not-found'
    | 'empty-patterns'
    | 'duplicate-issues'
    | 'stats-inconsistent'
    | 'unknown-pattern-id'
    | 'placeholder-example';
  readonly message: string;
  readonly severity: 'warning' | 'error';
};

export type ValidationResult = {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly adjustedResult?: AnalysisResult;
};

/**
 * Validates an analysis result for semantic consistency.
 * Checks that scores correlate with issue counts and examples exist in prompts.
 */
export function validateSemantics(
  result: AnalysisResult,
  originalPrompts: readonly string[],
): ValidationResult {
  const issues: ValidationIssue[] = [];

  // 1. Check score-to-issues correlation
  const { patterns } = result;
  const issueCount = patterns.length;
  const expectedRange = getExpectedScoreRange(issueCount);
  const actualScore = result.stats.overallScore;

  if (actualScore < expectedRange.min || actualScore > expectedRange.max) {
    issues.push({
      type: 'score-mismatch',
      message: `Score ${String(actualScore)} is inconsistent with ${String(issueCount)} issues (expected ${String(expectedRange.min)}-${String(expectedRange.max)})`,
      severity: 'warning',
    });
  }

  // 2. Check for empty patterns with low score
  if (issueCount === 0 && actualScore < 70) {
    issues.push({
      type: 'empty-patterns',
      message: `No patterns detected but score is ${String(actualScore)} (expected 70+)`,
      severity: 'warning',
    });
  }

  // 3. Check for duplicate issue IDs
  if (patterns.length > 0) {
    const seenIds = new Set<string>();
    for (const pattern of patterns) {
      if (seenIds.has(pattern.id)) {
        issues.push({
          type: 'duplicate-issues',
          message: `Duplicate pattern ID: ${pattern.id}`,
          severity: 'warning',
        });
      }
      seenIds.add(pattern.id);
    }
  }

  // 4. Verify examples are substrings of original prompts
  for (const pattern of patterns) {
    const { examples } = pattern;
    for (const example of examples) {
      const found = originalPrompts.some(
        (prompt) =>
          prompt.includes(example) ||
          example.includes(prompt.slice(0, Math.min(50, prompt.length))),
      );
      if (!found && example.length > 10) {
        issues.push({
          type: 'example-not-found',
          message: `Example "${example.slice(0, 30)}..." not found in prompts`,
          severity: 'warning',
        });
      }
    }
  }

  // 5. Check stats consistency: promptsWithIssues must not exceed totalPrompts
  if (result.stats.promptsWithIssues > result.stats.totalPrompts) {
    issues.push({
      type: 'stats-inconsistent',
      message: `promptsWithIssues (${result.stats.promptsWithIssues}) exceeds totalPrompts (${result.stats.totalPrompts})`,
      severity: 'error',
    });
  }

  // 6. Check for unknown pattern IDs not in taxonomy
  const validIds = Object.keys(ISSUE_TAXONOMY);
  if (result.patterns) {
    for (const pattern of result.patterns) {
      if (!validIds.includes(pattern.id)) {
        issues.push({
          type: 'unknown-pattern-id',
          message: `Unknown pattern ID: "${pattern.id}" (valid: ${validIds.join(', ')})`,
          severity: 'warning',
        });
      }
    }
  }

  // 7. Check for placeholder examples in patterns
  const PLACEHOLDER_TEXTS = [
    'example prompt 1',
    'example prompt 2',
    'example prompt 3',
    'original prompt',
    'improved prompt',
  ];
  if (result.patterns) {
    for (const pattern of result.patterns) {
      for (const example of pattern.examples ?? []) {
        if (PLACEHOLDER_TEXTS.some((p) => example.toLowerCase().includes(p))) {
          issues.push({
            type: 'placeholder-example',
            message: `Placeholder example detected: "${example.slice(0, 40)}"`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // Log warnings for debugging
  if (issues.length > 0) {
    logger.debug(
      `Semantic validation found ${String(issues.length)} issue(s)`,
      'validator',
    );
    for (const issue of issues) {
      logger.debug(`  [${issue.type}] ${issue.message}`, 'validator');
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

/**
 * Finds the closest taxonomy ID for an unknown pattern ID.
 * Uses substring and keyword matching as heuristics.
 */
function findClosestTaxonomyId(
  unknownId: string,
  validIds: readonly string[],
): string | undefined {
  const normalized = unknownId.toLowerCase();

  // Direct substring match: check if any valid ID is contained in the unknown ID
  for (const validId of validIds) {
    if (normalized.includes(validId.replace('-', ''))) return validId;
    if (normalized.includes(validId)) return validId;
  }

  // Keyword-based matching
  const keywordMap: Record<string, string> = {
    vague: 'vague',
    context: 'no-context',
    broad: 'too-broad',
    goal: 'no-goal',
    imperative: 'imperative',
    command: 'imperative',
    technical: 'missing-technical-details',
    detail: 'missing-technical-details',
    priorit: 'unclear-priorities',
    constraint: 'insufficient-constraints',
    specif: 'vague',
    unclear: 'vague',
    missing: 'no-context',
  };

  for (const [keyword, taxonomyId] of Object.entries(keywordMap)) {
    if (normalized.includes(keyword)) return taxonomyId;
  }

  return undefined;
}

/**
 * Attempts to fix common semantic issues in results.
 * Returns adjusted result if fixes were applied.
 */
export function autoCorrectResult(
  result: AnalysisResult,
  validation: ValidationResult,
): AnalysisResult {
  let adjusted = result;

  for (const issue of validation.issues) {
    if (issue.type === 'score-mismatch') {
      // Adjust score to match issue count
      const { patterns } = result;
      const issueCount = patterns.length;
      const expectedRange = getExpectedScoreRange(issueCount);
      const midpoint = Math.round((expectedRange.min + expectedRange.max) / 2);

      if (
        result.stats.overallScore < expectedRange.min ||
        result.stats.overallScore > expectedRange.max
      ) {
        adjusted = {
          ...adjusted,
          stats: {
            ...adjusted.stats,
            overallScore: midpoint,
          },
        };
        logger.debug(
          `Auto-corrected score from ${String(result.stats.overallScore)} to ${String(midpoint)}`,
          'validator',
        );
      }
    }

    if (issue.type === 'duplicate-issues') {
      // Remove duplicate patterns
      const seen = new Set<string>();
      const uniquePatterns = adjusted.patterns.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      adjusted = { ...adjusted, patterns: uniquePatterns };
    }

    if (issue.type === 'stats-inconsistent') {
      adjusted = {
        ...adjusted,
        stats: {
          ...adjusted.stats,
          promptsWithIssues: Math.min(
            adjusted.stats.promptsWithIssues,
            adjusted.stats.totalPrompts,
          ),
        },
      };
    }

    if (issue.type === 'unknown-pattern-id' && adjusted.patterns) {
      const validIds = Object.keys(ISSUE_TAXONOMY);
      const mappedPatterns = adjusted.patterns.map((pattern) => {
        if (validIds.includes(pattern.id)) return pattern;
        const matchedId = findClosestTaxonomyId(pattern.id, validIds);
        if (matchedId) {
          const metadata = ISSUE_TAXONOMY[matchedId];
          return {
            ...pattern,
            id: matchedId,
            name: metadata.name,
            severity: metadata.severity,
            suggestion: metadata.suggestion,
          };
        }
        return pattern;
      });
      // Deduplicate after remapping (multiple IDs may map to same taxonomy ID)
      const seen = new Set<string>();
      adjusted = {
        ...adjusted,
        patterns: mappedPatterns.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        }),
      };
    }

    if (issue.type === 'placeholder-example' && adjusted.patterns) {
      const PLACEHOLDER_TEXTS = [
        'example prompt 1',
        'example prompt 2',
        'example prompt 3',
        'original prompt',
        'improved prompt',
      ];
      adjusted = {
        ...adjusted,
        patterns: adjusted.patterns.map((pattern) => ({
          ...pattern,
          examples: pattern.examples.filter(
            (ex) =>
              !PLACEHOLDER_TEXTS.some((p) => ex.toLowerCase().includes(p)),
          ),
        })),
      };
    }
  }

  return adjusted;
}
