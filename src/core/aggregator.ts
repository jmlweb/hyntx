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

/**
 * Extracts real examples from prompts based on issue type.
 * Uses heuristic matching to identify prompts that exhibit the given issue.
 *
 * @param issueId - Issue identifier (kebab-case)
 * @param prompts - Array of prompt strings to search
 * @param limit - Maximum number of examples to return (default: 3)
 * @returns Array of sanitized example prompts
 *
 * @example
 * ```typescript
 * extractRealExamples('vague', ['help me', 'fix auth bug in login.ts'], 3)
 * // Returns: ['help me']
 *
 * extractRealExamples('no-context', ['fix it', 'update the config'], 3)
 * // Returns: ['fix it', 'update the config']
 * ```
 */
export function extractRealExamples(
  issueId: string,
  prompts: readonly string[],
  limit = 3,
): readonly string[] {
  const matches: string[] = [];

  for (const prompt of prompts) {
    if (matches.length >= limit) {
      break;
    }

    const trimmed = prompt.trim();
    const lowerPrompt = trimmed.toLowerCase();
    const wordCount = trimmed.split(/\s+/).length;

    // Heuristic matching based on issue type
    let isMatch = false;

    switch (issueId) {
      case 'vague':
        // Short prompts (< 50 chars) with generic words and no specifics
        isMatch =
          trimmed.length < 50 &&
          wordCount <= 5 &&
          (lowerPrompt.includes('help') ||
            lowerPrompt.includes('fix') ||
            lowerPrompt.includes('do') ||
            lowerPrompt.includes('make') ||
            lowerPrompt.includes('create')) &&
          /\w+\.(ts|js|tsx|jsx|py|go|java|rb|php)\b/.exec(lowerPrompt) === null;
        break;

      case 'no-context':
        // Contains pronouns without file/function names
        isMatch =
          (lowerPrompt.includes('this') ||
            lowerPrompt.includes('it') ||
            lowerPrompt.includes('the bug') ||
            lowerPrompt.includes('that')) &&
          /\w+\.(ts|js|tsx|jsx|py|go|java|rb|php)\b/.exec(lowerPrompt) ===
            null &&
          /function|component|method|class/.exec(lowerPrompt) === null;
        break;

      case 'too-broad': {
        // Long prompts (> 100 chars) with multiple requests
        const andMatches = lowerPrompt.match(/\band\b/g);
        isMatch =
          trimmed.length > 100 &&
          (andMatches?.length ?? 0) >= 2 &&
          (lowerPrompt.includes('also') ||
            lowerPrompt.includes('then') ||
            lowerPrompt.includes('build') ||
            lowerPrompt.includes('create'));
        break;
      }

      case 'no-goal':
        // Very short (< 30 chars) without clear action or question
        isMatch =
          trimmed.length < 30 &&
          wordCount <= 4 &&
          /\b(how|what|why|when|where|create|build|fix|add)\b/.exec(
            lowerPrompt,
          ) === null &&
          !lowerPrompt.includes('?');
        break;

      case 'imperative':
        // Short commands (< 20 chars) starting with verbs without explanation
        isMatch =
          trimmed.length < 20 &&
          wordCount <= 3 &&
          /^(add|delete|remove|update|change|modify)\b/.exec(lowerPrompt) !==
            null &&
          !lowerPrompt.includes('?');
        break;

      case 'missing-technical-details': {
        // No file paths, function names, error messages, or code references
        const hasFileRef =
          /\w+\.(ts|js|tsx|jsx|py|go|java|rb|php|json|yaml|yml)\b/.exec(
            lowerPrompt,
          ) !== null;
        const hasFunctionRef =
          /function|def |class |const |let |var |(\.\w+\()/.exec(
            lowerPrompt,
          ) !== null;
        const hasErrorRef =
          /error|exception|failed|crash|undefined|null/.exec(lowerPrompt) !==
          null;
        isMatch =
          !hasFileRef && !hasFunctionRef && !hasErrorRef && wordCount >= 3;
        break;
      }

      case 'unclear-priorities': {
        // Multiple requests with conjunctions but no ordering
        const andMatches = lowerPrompt.match(/\band\b/g);
        const orMatches = lowerPrompt.match(/\bor\b/g);
        const alsoMatches = lowerPrompt.match(/\balso\b/g);
        const conjunctionCount =
          (andMatches?.length ?? 0) +
          (orMatches?.length ?? 0) +
          (alsoMatches?.length ?? 0);
        isMatch =
          conjunctionCount >= 2 &&
          !/\b(first|second|third|then|next|finally|after|before)\b/.exec(
            lowerPrompt,
          ) &&
          wordCount >= 10;
        break;
      }

      case 'insufficient-constraints':
        // Requests without constraints, edge cases, or requirements
        isMatch =
          !/\b(constraint|requirement|must|should|edge case|boundary|limit|performance|compatib)\b/.exec(
            lowerPrompt,
          ) &&
          !/\b(<|>|<=|>=|\d+ms|\d+mb|\d+kb)\b/.exec(lowerPrompt) &&
          (lowerPrompt.includes('optimize') ||
            lowerPrompt.includes('improve') ||
            lowerPrompt.includes('make') ||
            lowerPrompt.includes('add')) &&
          wordCount >= 4;
        break;

      default:
        // Unknown issue type - no match
        isMatch = false;
    }

    if (isMatch) {
      matches.push(sanitizeExample(trimmed));
    }
  }

  // Deduplicate
  return [...new Set(matches)];
}

/**
 * Sanitizes an example prompt for display.
 * Truncates to 80 characters and removes extra whitespace.
 *
 * @param prompt - Raw prompt string
 * @returns Sanitized prompt string
 */
function sanitizeExample(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= 80) {
    return trimmed;
  }
  return trimmed.slice(0, 77) + '...';
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
 * @param prompts - Optional array of prompts to extract real examples from
 * @returns Complete AnalysisResult
 *
 * @example
 * ```typescript
 * const minimal = { issues: ['vague', 'no-context'], score: 40 };
 * const result = convertMinimalToAnalysisResult(minimal, '2025-01-15', ISSUE_TAXONOMY);
 * // Returns full AnalysisResult with patterns populated from taxonomy
 *
 * const withPrompts = convertMinimalToAnalysisResult(
 *   minimal,
 *   '2025-01-15',
 *   ISSUE_TAXONOMY,
 *   ['help me', 'fix this']
 * );
 * // Returns AnalysisResult with real examples from prompts
 * ```
 */
export function convertMinimalToAnalysisResult(
  minimal: MinimalResult,
  date: string,
  taxonomy: IssueTaxonomy,
  prompts?: readonly string[],
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

      // Extract real examples from prompts if provided, otherwise use taxonomy examples
      const examples = prompts
        ? extractRealExamples(issueId, prompts, 3)
        : metadata.exampleBefore
          ? [metadata.exampleBefore]
          : [];

      return {
        id: issueId,
        name: metadata.name,
        frequency: count,
        severity: metadata.severity,
        examples: [...examples],
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
 * @param prompts - Optional array of prompts to extract real examples from
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
  prompts?: readonly string[],
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
    return convertMinimalToAnalysisResult(result, date, taxonomy, prompts);
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

      // Extract real examples from prompts if provided, otherwise use taxonomy examples
      const examples = prompts
        ? extractRealExamples(issueId, prompts, 3)
        : metadata.exampleBefore
          ? [metadata.exampleBefore]
          : [];

      return {
        id: issueId,
        name: metadata.name,
        frequency: count,
        severity: metadata.severity,
        examples: [...examples],
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
