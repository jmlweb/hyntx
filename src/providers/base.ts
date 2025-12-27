/**
 * Base utilities for AI analysis providers.
 *
 * This module contains shared functionality for all provider implementations:
 * - System prompt template with JSON schema
 * - User prompt builder with context and formatting
 * - Response parser with validation and error handling
 */

import {
  convertMinimalToAnalysisResult,
  normalizeScore,
} from '../core/aggregator.js';
import {
  type AnalysisPattern,
  type AnalysisResult,
  type IndividualPromptResult,
  type MinimalResult,
  type ProjectContext,
} from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import {
  ISSUE_TAXONOMY,
  type IssueTaxonomy,
  SYSTEM_PROMPT_FULL,
} from './schemas.js';

/**
 * System prompt template for AI analysis providers.
 * Defines the JSON schema and analysis guidelines.
 * @deprecated Use SYSTEM_PROMPT_FULL from schemas.js instead
 */
export const SYSTEM_PROMPT = SYSTEM_PROMPT_FULL;

/**
 * Builds a user prompt for analysis from a list of prompts.
 * Formats prompts with numbers and includes date context.
 * Optionally injects project context to provide additional information.
 *
 * @param prompts - Array of prompt strings to analyze
 * @param date - Date context for the analysis (e.g., "2025-01-15")
 * @param context - Optional project context to inject
 * @returns Formatted user prompt string
 */
export function buildUserPrompt(
  prompts: readonly string[],
  date: string,
  context?: ProjectContext,
): string {
  if (prompts.length === 0) {
    throw new Error('Cannot build prompt from empty array');
  }

  const promptsList = prompts
    .map((prompt, index) => `${String(index + 1)}. ${prompt}`)
    .join('\n\n');

  const count = String(prompts.length);
  const plural = prompts.length === 1 ? '' : 's';

  // Build context section if context is provided
  let contextSection = '';
  if (context) {
    const contextParts: string[] = [];

    if (context.role) {
      contextParts.push(`Role: ${context.role}`);
    }
    if (context.projectType) {
      contextParts.push(`Project Type: ${context.projectType}`);
    }
    if (context.domain) {
      contextParts.push(`Domain: ${context.domain}`);
    }
    if (context.techStack && context.techStack.length > 0) {
      contextParts.push(`Tech Stack: ${context.techStack.join(', ')}`);
    }
    if (context.guidelines && context.guidelines.length > 0) {
      contextParts.push(
        `Guidelines:\n${context.guidelines.map((g) => `- ${g}`).join('\n')}`,
      );
    }

    if (contextParts.length > 0) {
      contextSection = `\n\nProject Context:\n${contextParts.join('\n')}\n`;
    }
  }

  return `Analyze the following ${count} prompt${plural} from ${date}:${contextSection}

${promptsList}

Please provide your analysis as a JSON object following the specified schema.`;
}

/**
 * Simplified issue from AI response.
 */
type SimpleIssue = {
  name: string;
  example: string;
  fix: string;
};

/**
 * Simplified response schema for small models.
 */
type SimpleResponse = {
  issues: SimpleIssue[];
  score: number;
  tip: string;
};

/**
 * Type guard for minimal response schema.
 * Validates that response contains issues array and optional score.
 */
function isValidMinimalResponse(value: unknown): value is MinimalResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check issues array (required)
  if (!Array.isArray(obj['issues'])) {
    return false;
  }
  if (!obj['issues'].every((item) => typeof item === 'string')) {
    return false;
  }

  // Score is optional, will default to 50
  return true;
}

/**
 * Safely extracts MinimalResult with defaults for missing fields.
 */
function extractMinimalResult(obj: Record<string, unknown>): MinimalResult {
  const issues = obj['issues'] as string[];
  const score = typeof obj['score'] === 'number' ? obj['score'] : 50;

  return { issues, score };
}

/**
 * Converts a simple issue to a full AnalysisPattern.
 */
function issueToPattern(issue: SimpleIssue, index: number): AnalysisPattern {
  const id = issue.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    id: id || `issue-${String(index)}`,
    name: issue.name,
    frequency: 1,
    severity: 'medium' as const,
    examples: [issue.example],
    suggestion: issue.fix,
    beforeAfter: {
      before: issue.example,
      after: issue.fix,
    },
  };
}

/**
 * Parses and validates an AI response into an AnalysisResult.
 * Supports both simplified schema (for small models) and full schema.
 *
 * @param response - Raw response string from the AI provider
 * @param date - Date context for the analysis result
 * @returns Validated AnalysisResult object
 * @throws Error if response cannot be parsed or is invalid
 */
/**
 * Attempts to fix truncated JSON by closing open structures.
 */
function tryFixTruncatedJson(json: string): string {
  let fixed = json.trim();

  // Count open brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (const char of fixed) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') openBraces++;
    if (char === '}') openBraces--;
    if (char === '[') openBrackets++;
    if (char === ']') openBrackets--;
  }

  // Close any unclosed string
  if (inString) {
    fixed += '"';
  }

  // Remove trailing comma if present
  fixed = fixed.replace(/,\s*$/, '');

  // Close open brackets and braces
  while (openBrackets > 0) {
    fixed += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    fixed += '}';
    openBraces--;
  }

  return fixed;
}

export function parseResponse(
  response: string,
  date: string,
  taxonomy: IssueTaxonomy = ISSUE_TAXONOMY,
  prompts?: readonly string[],
): AnalysisResult {
  // Try to extract JSON from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const jsonMatch = codeBlockRegex.exec(response);
  let jsonString = jsonMatch?.[1]?.trim() ?? response.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    // Try to fix truncated JSON
    jsonString = tryFixTruncatedJson(jsonString);
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(
        `Failed to parse response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Try schemas in order: minimal → simple → full

  // 1. Try minimal schema (for small models)
  if (isValidMinimalResponse(parsed)) {
    const minimal = extractMinimalResult(parsed as Record<string, unknown>);
    return convertMinimalToAnalysisResult(minimal, date, taxonomy, prompts);
  }

  // 2. Try simple schema (for medium models)
  if (isValidSimpleResponse(parsed)) {
    const simple = extractSimpleResponse(parsed as Record<string, unknown>);
    const patterns = simple.issues.map((issue, i) => issueToPattern(issue, i));
    return {
      date,
      patterns,
      stats: {
        totalPrompts: 0, // Will be filled by caller
        promptsWithIssues: simple.issues.length,
        overallScore: normalizeScore(simple.score),
      },
      topSuggestion: simple.tip,
    };
  }

  // 3. Try full schema (for larger models)
  if (isValidFullResponse(parsed)) {
    // Normalize patterns to ensure all have at least one example for consistent formatting
    const normalizedPatterns = parsed.patterns.map((pattern) => {
      if (pattern.examples.length === 0) {
        return {
          ...pattern,
          examples: [pattern.beforeAfter.before],
        };
      }
      return pattern;
    });

    return {
      date,
      patterns: normalizedPatterns,
      stats: {
        ...parsed.stats,
        overallScore: normalizeScore(parsed.stats.overallScore),
      },
      topSuggestion: parsed.topSuggestion,
    };
  }

  throw new Error('Response does not match expected schema');
}

/**
 * Type guard for simplified response schema.
 * Flexible validation - allows missing score/tip with defaults.
 */
function isValidSimpleResponse(value: unknown): value is SimpleResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check issues array (required)
  if (!Array.isArray(obj['issues'])) {
    return false;
  }

  for (const issue of obj['issues']) {
    if (typeof issue !== 'object' || issue === null) {
      return false;
    }
    const i = issue as Record<string, unknown>;
    if (
      typeof i['name'] !== 'string' ||
      typeof i['example'] !== 'string' ||
      typeof i['fix'] !== 'string'
    ) {
      return false;
    }
  }

  // Score and tip are optional - will use defaults if missing
  return true;
}

/**
 * Safely extracts SimpleResponse with defaults for missing fields.
 */
function extractSimpleResponse(obj: Record<string, unknown>): SimpleResponse {
  const issues = obj['issues'] as SimpleIssue[];
  const score = typeof obj['score'] === 'number' ? obj['score'] : 50;
  const tip =
    typeof obj['tip'] === 'string'
      ? obj['tip']
      : issues.length > 0 && issues[0]
        ? issues[0].fix
        : 'No suggestions';

  return { issues, score, tip };
}

/**
 * Type guard for full response schema.
 */
function isValidFullResponse(value: unknown): value is {
  patterns: AnalysisPattern[];
  stats: {
    totalPrompts: number;
    promptsWithIssues: number;
    overallScore: number;
  };
  topSuggestion: string;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Validate patterns array
  if (!Array.isArray(obj['patterns'])) {
    return false;
  }

  for (const pattern of obj['patterns']) {
    if (!isValidPattern(pattern)) {
      return false;
    }
  }

  // Validate stats object
  if (typeof obj['stats'] !== 'object' || obj['stats'] === null) {
    return false;
  }

  const stats = obj['stats'] as Record<string, unknown>;
  if (
    typeof stats['totalPrompts'] !== 'number' ||
    typeof stats['promptsWithIssues'] !== 'number' ||
    typeof stats['overallScore'] !== 'number'
  ) {
    return false;
  }

  // Validate topSuggestion
  if (typeof obj['topSuggestion'] !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard to validate a single pattern object.
 */
function isValidPattern(value: unknown): value is AnalysisPattern {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (
    typeof obj['id'] !== 'string' ||
    typeof obj['name'] !== 'string' ||
    typeof obj['frequency'] !== 'number' ||
    typeof obj['suggestion'] !== 'string'
  ) {
    return false;
  }

  if (
    obj['severity'] !== 'low' &&
    obj['severity'] !== 'medium' &&
    obj['severity'] !== 'high'
  ) {
    return false;
  }

  if (
    !Array.isArray(obj['examples']) ||
    !obj['examples'].every((e) => typeof e === 'string')
  ) {
    return false;
  }

  if (typeof obj['beforeAfter'] !== 'object' || obj['beforeAfter'] === null) {
    return false;
  }

  const beforeAfter = obj['beforeAfter'] as Record<string, unknown>;
  if (
    typeof beforeAfter['before'] !== 'string' ||
    typeof beforeAfter['after'] !== 'string'
  ) {
    return false;
  }

  return true;
}

// =============================================================================
// Batch-Individual Hybrid Parsing
// =============================================================================

/**
 * Parses batch-individual response into an AnalysisResult.
 * This is the hybrid approach: batch processing with individual schema.
 *
 * @param response - Raw response string (should be a JSON array)
 * @param date - Date context for the analysis
 * @param prompts - Original prompts (for validation and fallback)
 * @returns AnalysisResult with aggregated patterns
 */
export function parseBatchIndividualResponse(
  response: string,
  date: string,
  prompts: readonly string[],
): AnalysisResult {
  logger.debug(
    `Parsing batch-individual response (${String(prompts.length)} prompts)`,
    'parser',
  );
  logger.debug(`Response length: ${String(response.length)} chars`, 'parser');

  // Try to extract JSON from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const jsonMatch = codeBlockRegex.exec(response);
  let jsonString = jsonMatch?.[1]?.trim() ?? response.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    // Try to fix truncated JSON
    jsonString = tryFixTruncatedJson(jsonString);
    try {
      parsed = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(
        `Failed to parse batch-individual response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // Handle models that return a single object instead of an array
  // This is common with smaller models that struggle with complex output formats
  let parsedArray: unknown[];
  if (!Array.isArray(parsed)) {
    // If it's a valid individual result, wrap it in an array
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      isValidIndividualPromptResult(parsed)
    ) {
      logger.debug(
        'Model returned single object instead of array, wrapping it',
        'parser',
      );
      parsedArray = [parsed];
    } else {
      throw new Error(
        'Batch-individual response must be an array of individual results',
      );
    }
  } else {
    parsedArray = parsed;
  }

  // Parse each individual result
  const individualResults: IndividualPromptResult[] = [];
  for (let i = 0; i < parsedArray.length; i++) {
    const item = parsedArray[i];
    if (!isValidIndividualPromptResult(item)) {
      // Fallback for invalid result
      individualResults.push({
        status: 'problems',
        problems: ['Invalid response format'],
        categories: ['other'],
        example: prompts[i] ?? `Prompt ${String(i + 1)}`,
        suggestion: 'Could not analyze this prompt',
      });
    } else {
      individualResults.push(item);
    }
  }

  // Convert individual results to AnalysisResult
  return convertIndividualResultsToAnalysis(individualResults, date);
}

/**
 * Type guard for IndividualPromptResult.
 */
function isValidIndividualPromptResult(
  value: unknown,
): value is IndividualPromptResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    (obj['status'] === 'correct' || obj['status'] === 'problems') &&
    Array.isArray(obj['problems']) &&
    Array.isArray(obj['categories']) &&
    typeof obj['example'] === 'string' &&
    typeof obj['suggestion'] === 'string'
  );
}

/**
 * Converts array of IndividualPromptResult to AnalysisResult.
 * Groups by category, calculates frequencies, and creates patterns.
 */
function convertIndividualResultsToAnalysis(
  results: readonly IndividualPromptResult[],
  date: string,
): AnalysisResult {
  const totalPrompts = results.length;
  let promptsWithIssues = 0;

  // Group by category
  const categoryMap = new Map<
    string,
    { examples: string[]; suggestions: string[]; count: number }
  >();

  for (const result of results) {
    if (result.status === 'problems') {
      promptsWithIssues++;

      for (const category of result.categories) {
        if (!categoryMap.has(category)) {
          categoryMap.set(category, {
            examples: [],
            suggestions: [],
            count: 0,
          });
        }
        const group = categoryMap.get(category);
        if (group) {
          group.count++;
          if (group.examples.length < 3) {
            group.examples.push(result.example);
          }
          if (!group.suggestions.includes(result.suggestion)) {
            group.suggestions.push(result.suggestion);
          }
        }
      }
    }
  }

  // Convert to patterns
  const patterns: AnalysisPattern[] = [];
  for (const [categoryId, group] of categoryMap.entries()) {
    // Map category to metadata
    const metadata = getCategoryMetadata(categoryId);

    patterns.push({
      id: categoryId,
      name: metadata.name,
      frequency: group.count,
      severity: metadata.severity,
      examples: group.examples,
      suggestion: group.suggestions[0] ?? metadata.suggestion,
      beforeAfter: {
        before: group.examples[0] ?? 'Example prompt',
        after: metadata.suggestion,
      },
    });
  }

  // Sort by frequency (desc) then severity
  patterns.sort((a, b) => {
    if (b.frequency !== a.frequency) {
      return b.frequency - a.frequency;
    }
    const severityRank = { high: 3, medium: 2, low: 1 };
    return severityRank[b.severity] - severityRank[a.severity];
  });

  // Calculate overall score (0-100)
  const issueRate = promptsWithIssues / totalPrompts;
  const overallScore = Math.round((1 - issueRate) * 100);

  return {
    date,
    patterns: patterns.slice(0, 5), // Top 5 patterns
    stats: {
      totalPrompts,
      promptsWithIssues,
      overallScore: normalizeScore(overallScore),
    },
    topSuggestion:
      patterns.length > 0 && patterns[0]
        ? patterns[0].suggestion
        : 'No issues detected',
  };
}

/**
 * Gets metadata for a category.
 * Maps categories to their display names and severities.
 */
function getCategoryMetadata(category: string): {
  name: string;
  severity: 'low' | 'medium' | 'high';
  suggestion: string;
} {
  const categoryMetadata: Record<
    string,
    { name: string; severity: 'low' | 'medium' | 'high'; suggestion: string }
  > = {
    'vague-request': {
      name: 'Vague Request',
      severity: 'high',
      suggestion:
        'Be more specific - include function names, file paths, or describe the exact issue',
    },
    'missing-context': {
      name: 'Missing Context',
      severity: 'high',
      suggestion:
        'Provide necessary context - file paths, function names, error messages, or code snippets',
    },
    'too-broad': {
      name: 'Too Broad',
      severity: 'medium',
      suggestion:
        'Break down into smaller, focused requests - tackle one task at a time',
    },
    'unclear-goal': {
      name: 'Unclear Goal',
      severity: 'high',
      suggestion:
        'State what you want to achieve - specify success criteria and desired outcome',
    },
    other: {
      name: 'Other Issues',
      severity: 'low',
      suggestion: 'Review and improve prompt clarity and specificity',
    },
  };

  return (
    categoryMetadata[category] ?? {
      name: category,
      severity: 'low',
      suggestion: 'Improve prompt quality',
    }
  );
}
