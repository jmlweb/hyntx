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
} from '../types/index.js';

/**
 * System prompt template for AI analysis providers.
 * Defines the JSON schema and analysis guidelines.
 */
export const SYSTEM_PROMPT = `You are an AI prompt quality analyzer. Your task is to analyze user prompts to Claude Code and identify patterns that could be improved for clarity, specificity, and effectiveness.

Analyze the provided prompts and return a JSON object with the following structure:

{
  "patterns": [
    {
      "id": "unique-kebab-case-id",
      "name": "Pattern Name",
      "frequency": <number of occurrences>,
      "severity": "low" | "medium" | "high",
      "examples": ["example prompt 1", "example prompt 2"],
      "suggestion": "Clear, actionable suggestion for improvement",
      "beforeAfter": {
        "before": "Example of current prompt",
        "after": "Example of improved prompt"
      }
    }
  ],
  "stats": {
    "totalPrompts": <total number of prompts analyzed>,
    "promptsWithIssues": <number of prompts with detected issues>,
    "overallScore": <score from 0-100, where 100 is perfect>
  },
  "topSuggestion": "Most important single improvement to make"
}

Guidelines:
- Focus on patterns that appear multiple times (frequency >= 2)
- Severity: "high" for clarity issues, "medium" for specificity, "low" for style
- Examples should be actual quotes from the prompts (or close paraphrases)
- beforeAfter should show concrete, realistic improvements
- topSuggestion should be the most impactful single change
- If no issues found, return empty patterns array with score 100
- Be constructive and specific in suggestions`;

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
 * Parses and validates an AI response into an AnalysisResult.
 * Handles both raw JSON and markdown-wrapped JSON responses.
 *
 * @param response - Raw response string from the AI provider
 * @param date - Date context for the analysis result
 * @returns Validated AnalysisResult object
 * @throws Error if response cannot be parsed or is invalid
 */
export function parseResponse(response: string, date: string): AnalysisResult {
  // Try to extract JSON from markdown code blocks
  const codeBlockRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
  const jsonMatch = codeBlockRegex.exec(response);
  const jsonString = jsonMatch?.[1]?.trim() ?? response.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (error) {
    throw new Error(
      `Failed to parse response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  // Validate structure
  if (!isValidAnalysisResponse(parsed)) {
    throw new Error('Response does not match expected schema');
  }

  return {
    date,
    patterns: parsed.patterns,
    stats: parsed.stats,
    topSuggestion: parsed.topSuggestion,
  };
}

/**
 * Type guard to validate analysis response structure.
 * Performs runtime validation of the parsed JSON.
 */
function isValidAnalysisResponse(value: unknown): value is {
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
