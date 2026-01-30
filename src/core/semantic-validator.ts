/**
 * Semantic Validation for Analysis Results
 *
 * Post-processing validation to catch logical inconsistencies
 * that JSON schema validation cannot detect.
 */

import type { AnalysisResult } from '../types/index.js';
import { getExpectedScoreRange } from '../benchmark/gold-standard.js';
import { logger } from '../utils/logger-base.js';

export type ValidationIssue = {
  readonly type:
    | 'score-mismatch'
    | 'example-not-found'
    | 'empty-patterns'
    | 'duplicate-issues';
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
  const issueCount = result.patterns?.length ?? 0;
  const expectedRange = getExpectedScoreRange(issueCount);
  const actualScore = result.stats.overallScore;

  if (actualScore < expectedRange.min || actualScore > expectedRange.max) {
    issues.push({
      type: 'score-mismatch',
      message: `Score ${actualScore} is inconsistent with ${issueCount} issues (expected ${expectedRange.min}-${expectedRange.max})`,
      severity: 'warning',
    });
  }

  // 2. Check for empty patterns with low score
  if (issueCount === 0 && actualScore < 70) {
    issues.push({
      type: 'empty-patterns',
      message: `No patterns detected but score is ${actualScore} (expected 70+)`,
      severity: 'warning',
    });
  }

  // 3. Check for duplicate issue IDs
  if (result.patterns && result.patterns.length > 0) {
    const seenIds = new Set<string>();
    for (const pattern of result.patterns) {
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
  if (result.patterns) {
    for (const pattern of result.patterns) {
      for (const example of pattern.examples ?? []) {
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
  }

  // Log warnings for debugging
  if (issues.length > 0) {
    logger.debug(
      `Semantic validation found ${issues.length} issue(s)`,
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
      const issueCount = result.patterns?.length ?? 0;
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
          `Auto-corrected score from ${result.stats.overallScore} to ${midpoint}`,
          'validator',
        );
      }
    }

    if (issue.type === 'duplicate-issues' && adjusted.patterns) {
      // Remove duplicate patterns
      const seen = new Set<string>();
      const uniquePatterns = adjusted.patterns.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
      adjusted = { ...adjusted, patterns: uniquePatterns };
    }
  }

  return adjusted;
}
