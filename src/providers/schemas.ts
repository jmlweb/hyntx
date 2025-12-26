/**
 * Schema variants and issue taxonomy for AI analysis providers.
 *
 * This module provides:
 * - Issue taxonomy with predefined metadata
 * - System prompts for different schema types
 * - Type definitions for schema variants
 * - Rules configuration utilities
 */

import type { PatternSeverity, RulesConfig } from '../types/index.js';
import { logger } from '../utils/logger-base.js';

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

// =============================================================================
// Rules Configuration
// =============================================================================

/**
 * Known valid pattern IDs from ISSUE_TAXONOMY.
 */
const VALID_PATTERN_IDS = Object.keys(ISSUE_TAXONOMY);

/**
 * Applies rules configuration to the issue taxonomy.
 * Filters out disabled rules and overrides severities.
 *
 * @param rules - Rules configuration from .hyntxrc.json
 * @param baseTaxonomy - Base taxonomy to apply rules to (defaults to ISSUE_TAXONOMY)
 * @returns Modified taxonomy with rules applied
 *
 * @example
 * ```typescript
 * const customTaxonomy = applyRulesConfig({
 *   'no-context': { enabled: false },
 *   vague: { severity: 'high' }
 * });
 * // Returns taxonomy without 'no-context' and with vague set to high severity
 * ```
 */
export function applyRulesConfig(
  rules: RulesConfig | undefined,
  baseTaxonomy: IssueTaxonomy = ISSUE_TAXONOMY,
): IssueTaxonomy {
  // If no rules config, return base taxonomy unchanged
  if (!rules || Object.keys(rules).length === 0) {
    return baseTaxonomy;
  }

  // Warn about invalid rule IDs - use immediate warning for config errors
  for (const ruleId of Object.keys(rules)) {
    if (!VALID_PATTERN_IDS.includes(ruleId)) {
      logger.warn(
        `Unknown rule ID "${ruleId}" in configuration. Valid IDs are: ${VALID_PATTERN_IDS.join(', ')}`,
        'config',
      );
    }
  }

  // Build new taxonomy
  const newTaxonomy: Record<string, IssueMetadata> = {};

  for (const [patternId, metadata] of Object.entries(baseTaxonomy)) {
    const ruleConfig = rules[patternId];

    // Skip if explicitly disabled
    if (ruleConfig?.enabled === false) {
      continue;
    }

    // Apply severity override if present
    if (ruleConfig?.severity) {
      newTaxonomy[patternId] = {
        ...metadata,
        severity: ruleConfig.severity,
      };
    } else {
      newTaxonomy[patternId] = metadata;
    }
  }

  // Warn if all rules are disabled
  if (Object.keys(newTaxonomy).length === 0) {
    logger.collectWarning(
      'All analysis rules are disabled in configuration. No patterns will be detected.',
      'config',
    );
  }

  return newTaxonomy;
}

/**
 * Gets list of enabled pattern IDs from rules configuration.
 *
 * @param rules - Rules configuration from .hyntxrc.json
 * @returns Array of enabled pattern IDs
 *
 * @example
 * ```typescript
 * const enabled = getEnabledPatternIds({
 *   'no-context': { enabled: false },
 *   vague: { enabled: true }
 * });
 * // Returns ['vague', 'too-broad', 'no-goal', 'imperative']
 * ```
 */
export function getEnabledPatternIds(
  rules: RulesConfig | undefined,
): readonly string[] {
  // If no rules config, all patterns are enabled
  if (!rules || Object.keys(rules).length === 0) {
    return VALID_PATTERN_IDS;
  }

  // Filter based on rules config
  return VALID_PATTERN_IDS.filter((patternId) => {
    const ruleConfig = rules[patternId];
    // Include if not explicitly disabled
    return ruleConfig?.enabled !== false;
  });
}
