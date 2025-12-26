/**
 * Aggregator for converting minimal analysis results to full AnalysisResult.
 *
 * This module provides utilities to:
 * - Convert minimal responses (issue IDs + score) to full AnalysisResult
 * - Aggregate multiple minimal results into a single result
 * - Look up issue metadata from the taxonomy with graceful fallback
 */

import type {
  AnalysisResult,
  AnalysisPattern,
  PatternSeverity,
} from '../types/index.js';
import type { IssueTaxonomy, IssueMetadata } from '../providers/schemas.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Minimal result from small models.
 * Contains only issue IDs and a quality score.
 */
export type MinimalResult = {
  readonly issues: readonly string[];
  readonly score: number;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Normalizes a score from 0-100 scale (from AI) to 0-10 scale (for display).
 * Clamps the result to ensure it stays within valid bounds.
 *
 * @param score100 - Score on 0-100 scale
 * @returns Score on 0-10 scale
 */
export function normalizeScore(score100: number): number {
  const normalized = score100 / 10;
  return Math.max(0, Math.min(10, normalized));
}

/**
 * Looks up issue metadata from taxonomy with graceful fallback.
 * Returns a generated metadata object for unknown issue IDs.
 *
 * @param issueId - Issue identifier (kebab-case)
 * @param taxonomy - Issue taxonomy mapping
 * @returns Issue metadata
 *
 * @example
 * ```typescript
 * lookupIssueMetadata('vague', ISSUE_TAXONOMY)
 * // Returns: { name: 'Vague Request', severity: 'high', ... }
 *
 * lookupIssueMetadata('unknown-issue', ISSUE_TAXONOMY)
 * // Returns: { name: 'Unknown Issue', severity: 'medium', suggestion: 'Review this pattern' }
 * ```
 */
export function lookupIssueMetadata(
  issueId: string,
  taxonomy: IssueTaxonomy,
): IssueMetadata {
  if (taxonomy[issueId]) {
    return taxonomy[issueId];
  }

  // Fallback for unknown issue IDs
  return {
    name: titleCase(issueId),
    severity: 'medium' as PatternSeverity,
    suggestion: 'Review this pattern',
  };
}

/**
 * Converts kebab-case to Title Case.
 *
 * @param str - Kebab-case string
 * @returns Title case string
 *
 * @example
 * ```typescript
 * titleCase('no-context') // 'No Context'
 * titleCase('too-broad') // 'Too Broad'
 * ```
 */
function titleCase(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Converts a minimal result to a full AnalysisResult.
 * Uses the issue taxonomy to populate pattern metadata.
 *
 * @param minimal - Minimal result from small model
 * @param date - Date context for the analysis
 * @param taxonomy - Issue taxonomy for metadata lookup
 * @returns Complete AnalysisResult
 *
 * @example
 * ```typescript
 * const minimal = { issues: ['vague', 'no-context'], score: 40 };
 * const result = convertMinimalToAnalysisResult(minimal, '2025-01-15', ISSUE_TAXONOMY);
 * // Returns full AnalysisResult with patterns populated from taxonomy
 * ```
 */
export function convertMinimalToAnalysisResult(
  minimal: MinimalResult,
  date: string,
  taxonomy: IssueTaxonomy,
): AnalysisResult {
  // Count unique issues
  const issueCounts = new Map<string, number>();

  for (const issue of minimal.issues) {
    issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
  }

  // Convert to patterns (limit to top 5 by frequency)
  const patterns: AnalysisPattern[] = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issueId, count]) => {
      const metadata = lookupIssueMetadata(issueId, taxonomy);

      return {
        id: issueId,
        name: metadata.name,
        frequency: count,
        severity: metadata.severity,
        examples: metadata.exampleBefore ? [metadata.exampleBefore] : [],
        suggestion: metadata.suggestion,
        beforeAfter: {
          before: metadata.exampleBefore ?? 'Example not available',
          after: metadata.exampleAfter ?? metadata.suggestion,
        },
      };
    });

  return {
    date,
    patterns,
    stats: {
      totalPrompts: 1,
      promptsWithIssues: minimal.issues.length > 0 ? 1 : 0,
      overallScore: normalizeScore(minimal.score),
    },
    topSuggestion:
      patterns.length > 0 && patterns[0]
        ? patterns[0].suggestion
        : 'Your prompts look good!',
  };
}

/**
 * Aggregates multiple minimal results into a single AnalysisResult.
 * Combines issue frequencies and calculates average score.
 *
 * @param results - Array of minimal results to aggregate
 * @param date - Date context for the analysis
 * @param taxonomy - Issue taxonomy for metadata lookup
 * @returns Aggregated AnalysisResult
 * @throws Error if results array is empty
 *
 * @example
 * ```typescript
 * const results = [
 *   { issues: ['vague'], score: 60 },
 *   { issues: ['vague', 'no-context'], score: 40 },
 * ];
 * const aggregated = aggregateMinimalResults(results, '2025-01-15', ISSUE_TAXONOMY);
 * // Returns AnalysisResult with combined frequencies and average score
 * ```
 */
export function aggregateMinimalResults(
  results: readonly MinimalResult[],
  date: string,
  taxonomy: IssueTaxonomy,
): AnalysisResult {
  if (results.length === 0) {
    throw new Error('Cannot aggregate empty results');
  }

  // Fast path: single result
  if (results.length === 1) {
    const result = results[0];
    if (!result) {
      throw new Error('Results array is empty');
    }
    return convertMinimalToAnalysisResult(result, date, taxonomy);
  }

  // Count issue frequencies across all results
  const issueCounts = new Map<string, number>();
  const scores: number[] = [];

  for (const result of results) {
    scores.push(result.score);
    for (const issue of result.issues) {
      issueCounts.set(issue, (issueCounts.get(issue) ?? 0) + 1);
    }
  }

  // Convert to patterns (limit to top 5 by frequency)
  const patterns: AnalysisPattern[] = [...issueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issueId, count]) => {
      const metadata = lookupIssueMetadata(issueId, taxonomy);

      return {
        id: issueId,
        name: metadata.name,
        frequency: count,
        severity: metadata.severity,
        examples: metadata.exampleBefore ? [metadata.exampleBefore] : [],
        suggestion: metadata.suggestion,
        beforeAfter: {
          before: metadata.exampleBefore ?? 'Example not available',
          after: metadata.exampleAfter ?? metadata.suggestion,
        },
      };
    });

  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

  return {
    date,
    patterns,
    stats: {
      totalPrompts: results.length,
      promptsWithIssues: results.filter((r) => r.issues.length > 0).length,
      overallScore: normalizeScore(avgScore),
    },
    topSuggestion:
      patterns.length > 0 && patterns[0]
        ? patterns[0].suggestion
        : 'Your prompts look good!',
  };
}
