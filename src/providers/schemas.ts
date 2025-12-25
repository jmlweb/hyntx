/**
 * Schema variants and issue taxonomy for AI analysis providers.
 *
 * This module provides:
 * - Issue taxonomy with predefined metadata
 * - System prompts for different schema types
 * - Type definitions for schema variants
 */

import type { PatternSeverity } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata for a predefined issue type.
 * Used by the aggregator to convert minimal issue IDs to full patterns.
 */
export type IssueMetadata = {
  readonly name: string;
  readonly severity: PatternSeverity;
  readonly suggestion: string;
  readonly exampleBefore?: string;
  readonly exampleAfter?: string;
};

/**
 * Taxonomy mapping issue IDs to their metadata.
 */
export type IssueTaxonomy = Record<string, IssueMetadata>;

/**
 * Schema type identifier.
 * - minimal: Lightweight schema for small models (issue IDs + score)
 * - simple: Medium schema with issue objects
 * - full: Complete schema with patterns and stats
 */
export type SchemaType = 'minimal' | 'simple' | 'full';

// =============================================================================
// Issue Taxonomy
// =============================================================================

/**
 * Predefined issue taxonomy for common prompt quality problems.
 * Used to convert minimal issue IDs into full AnalysisPattern objects.
 */
export const ISSUE_TAXONOMY: IssueTaxonomy = {
  vague: {
    name: 'Vague Request',
    severity: 'high',
    suggestion: 'Be more specific about what you need',
    exampleBefore: 'Help me with my code',
    exampleAfter:
      'Help me debug this TypeScript function that returns undefined',
  },
  'no-context': {
    name: 'Missing Context',
    severity: 'high',
    suggestion: 'Provide relevant background information',
    exampleBefore: 'Fix the bug',
    exampleAfter:
      'Fix the bug in the authentication flow where users are logged out after 5 minutes',
  },
  'too-broad': {
    name: 'Too Broad',
    severity: 'medium',
    suggestion: 'Break down into smaller, focused requests',
    exampleBefore: 'Build me an app',
    exampleAfter:
      'Create a React component for displaying user profiles with avatar and bio',
  },
  'no-goal': {
    name: 'No Clear Goal',
    severity: 'high',
    suggestion: 'State what outcome you want to achieve',
    exampleBefore: 'Look at this file',
    exampleAfter:
      'Review this file for security vulnerabilities in the authentication logic',
  },
  imperative: {
    name: 'Command Without Context',
    severity: 'low',
    suggestion: 'Explain why you need this',
    exampleBefore: 'Add a button',
    exampleAfter:
      'Add a "Submit" button to trigger form validation and API submission',
  },
} as const;

// =============================================================================
// System Prompts
// =============================================================================

/**
 * Minimal system prompt for small models.
 * Returns only issue IDs and score - no examples or detailed metadata.
 */
export const SYSTEM_PROMPT_MINIMAL = `You analyze prompts for quality issues.
Respond with JSON only: {"issues": ["issue-id", ...], "score": 0-100}

Valid issue IDs: vague, no-context, too-broad, no-goal, imperative

Examples:
Input: "Help me with code"
Output: {"issues": ["vague", "no-context"], "score": 40}

Input: "Debug this TypeScript function that returns undefined"
Output: {"issues": [], "score": 85}`;

/**
 * Simple system prompt for medium models.
 * Returns issue objects with name, example, and fix.
 */
export const SYSTEM_PROMPT_SIMPLE = `Analyze prompts for quality issues. Return ONLY JSON, no other text.

Schema:
{"issues":[{"name":"issue name","example":"bad prompt","fix":"better prompt"}],"score":75,"tip":"main suggestion"}

Rules:
- issues: array of problems found (empty if none)
- score: 0-100 quality score (100=perfect)
- tip: single most important suggestion
- name: short issue name (e.g. "vague request", "missing context")
- example: actual prompt text showing the issue
- fix: improved version of that prompt`;

/**
 * Full system prompt for large models.
 * Returns complete patterns with frequency, severity, and examples.
 */
export const SYSTEM_PROMPT_FULL = SYSTEM_PROMPT_SIMPLE;
