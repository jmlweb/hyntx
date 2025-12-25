/**
 * Base utilities for AI analysis providers.
 *
 * This module contains shared functionality for all provider implementations:
 * - System prompt template with JSON schema
 * - User prompt builder with context and formatting
 * - Response parser with validation and error handling
 */

import {
  type AnalysisResult,
  type AnalysisPattern,
  type ProjectContext,
  type MinimalResult,
} from '../types/index.js';
import { ISSUE_TAXONOMY, SYSTEM_PROMPT_FULL } from './schemas.js';
import { convertMinimalToAnalysisResult } from '../core/aggregator.js';

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

export function parseResponse(response: string, date: string): AnalysisResult {
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
    return convertMinimalToAnalysisResult(minimal, date, ISSUE_TAXONOMY);
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
        overallScore: simple.score,
      },
      topSuggestion: simple.tip,
    };
  }

  // 3. Try full schema (for larger models)
  if (isValidFullResponse(parsed)) {
    return {
      date,
      patterns: parsed.patterns,
      stats: parsed.stats,
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
