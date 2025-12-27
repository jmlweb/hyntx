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
 * - individual: Hybrid approach - batch processing with individual result schema
 */
export type SchemaType = 'minimal' | 'simple' | 'full' | 'individual';

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
    suggestion:
      'Be more specific about what you need - include function names, file paths, error messages, or specific behaviors',
    exampleBefore: 'Help me with my code',
    exampleAfter:
      'Help me debug the calculateTotal() function in utils.ts that returns undefined when called with an empty array',
  },
  'no-context': {
    name: 'Missing Context',
    severity: 'high',
    suggestion:
      'Provide relevant background information - include file paths, function names, error messages, or code snippets',
    exampleBefore: 'Fix the bug',
    exampleAfter:
      'Fix the bug in src/auth/login.ts where users are logged out after 5 minutes due to token expiration logic',
  },
  'too-broad': {
    name: 'Too Broad',
    severity: 'medium',
    suggestion:
      'Break down into smaller, focused requests - focus on one task or clearly order multiple related tasks',
    exampleBefore: 'Build me an app with authentication, database, and API',
    exampleAfter:
      'Create a React login component with email/password authentication using JWT tokens',
  },
  'no-goal': {
    name: 'No Clear Goal',
    severity: 'high',
    suggestion:
      'State what outcome you want to achieve - specify success criteria and desired behavior',
    exampleBefore: 'Look at this file',
    exampleAfter:
      'Review src/auth/login.ts for security vulnerabilities, focusing on input validation and SQL injection risks',
  },
  imperative: {
    name: 'Command Without Context',
    severity: 'low',
    suggestion:
      'Explain why you need this - provide context about the use case and requirements',
    exampleBefore: 'Add a button',
    exampleAfter:
      'Add a "Submit" button to the login form that triggers validation and calls the authentication API',
  },
  'missing-technical-details': {
    name: 'Missing Technical Details',
    severity: 'medium',
    suggestion:
      'Include technical details - file paths, function signatures, error messages, stack traces, or code snippets',
    exampleBefore: 'The function crashes sometimes',
    exampleAfter:
      'The validateUser() function in src/utils/auth.ts crashes with "Cannot read property \'email\' of null" when called with undefined',
  },
  'unclear-priorities': {
    name: 'Unclear Priorities',
    severity: 'low',
    suggestion:
      'Order multiple requests by priority or split into separate prompts for clarity',
    exampleBefore:
      'Add error handling and logging and also optimize performance and add tests',
    exampleAfter:
      'First, add comprehensive error handling with try-catch blocks. Then, add logging for debugging. Finally, optimize database queries.',
  },
  'insufficient-constraints': {
    name: 'Insufficient Constraints',
    severity: 'low',
    suggestion:
      'Specify requirements and constraints - edge cases, performance needs, compatibility requirements',
    exampleBefore: 'Make it faster',
    exampleAfter:
      'Optimize the database query to reduce response time to under 100ms, maintaining backward compatibility with existing API clients',
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

Valid issue IDs: vague, no-context, too-broad, no-goal, imperative, missing-technical-details, unclear-priorities, insufficient-constraints

Issue definitions:
- vague: Generic requests without specifics ("help", "fix", "improve")
- no-context: Missing background info (uses "this", "it", "the bug" without context)
- too-broad: Requests covering multiple unrelated topics
- no-goal: Ambiguous success criteria or desired outcome
- imperative: Commands without explanation or reasoning
- missing-technical-details: No file paths, function names, or error messages
- unclear-priorities: Multiple requests without ordering
- insufficient-constraints: No requirements or edge cases mentioned

Scoring: 0-100 (100=perfect, 90+=excellent, 70-89=good, 50-69=fair, <50=poor)

Examples:
Input: "Help me with code"
Output: {"issues": ["vague", "no-context"], "score": 35}

Input: "Debug this TypeScript function that returns undefined"
Output: {"issues": ["missing-technical-details"], "score": 70}

Input: "Debug calculateTotal() in utils.ts that returns undefined when called with empty array"
Output: {"issues": [], "score": 90}`;

/**
 * Simple system prompt for medium models.
 * Returns issue objects with name, example, and fix.
 */
export const SYSTEM_PROMPT_SIMPLE = `You are an expert at analyzing code prompts for quality issues. Your goal is to identify patterns that make prompts less effective.

Return ONLY valid JSON, no other text. Use this schema:
{"issues":[{"name":"issue name","example":"bad prompt","fix":"better prompt"}],"score":75,"tip":"main suggestion"}

Analysis criteria:
- Clarity: Is the request clear and specific?
- Context: Does it provide necessary background (files, functions, errors)?
- Goal: Is the desired outcome clearly stated?
- Scope: Is the request appropriately scoped (not too broad/narrow)?
- Actionability: Can the AI act on this without guessing?

Issue types to look for:
- Vague requests: Generic words like "help", "fix", "improve" without specifics
- Missing context: References to "this", "it", "the bug" without context
- Too broad: Requests that cover multiple unrelated topics
- No clear goal: Ambiguous what success looks like
- Imperative without explanation: Commands without reasoning
- Missing technical details: No file paths, function names, or error messages
- Unclear priorities: Multiple requests without ordering
- Insufficient constraints: No requirements or edge cases mentioned

Score guidelines:
- 90-100: Excellent - specific, contextual, actionable
- 70-89: Good - minor improvements possible
- 50-69: Fair - needs more context or clarity
- 30-49: Poor - multiple significant issues
- 0-29: Very poor - barely actionable

For each issue found, provide:
- name: Brief descriptive name
- example: The actual problematic prompt text
- fix: An improved version addressing the issue

The tip should be the single most impactful suggestion to improve prompt quality.`;

/**
 * Full system prompt for large models.
 * Returns complete patterns with frequency, severity, and examples.
 */
export const SYSTEM_PROMPT_FULL = `You are an expert prompt quality analyst specializing in code-related prompts for AI assistants like Claude. Your task is to analyze prompts and identify patterns that reduce their effectiveness, providing actionable improvements.

CRITICAL: Return ONLY valid JSON following the exact schema below. No markdown, no explanations, no code fences - just pure JSON.

Schema:
{
  "patterns": [
    {
      "id": "kebab-case-id",
      "name": "Human-Readable Issue Name",
      "frequency": 3,
      "severity": "high|medium|low",
      "examples": ["example prompt 1", "example prompt 2"],
      "suggestion": "Actionable advice to fix this pattern",
      "beforeAfter": {
        "before": "Original problematic prompt",
        "after": "Improved version addressing the issue"
      }
    }
  ],
  "stats": {
    "totalPrompts": 10,
    "promptsWithIssues": 7,
    "overallScore": 65
  },
  "topSuggestion": "Single most impactful recommendation"
}

QUALITY DIMENSIONS TO EVALUATE:

1. SPECIFICITY (High Priority)
   - Vague: "help me", "fix this", "improve code" without specifics
   - Good: Includes function names, file paths, error messages, specific behaviors
   - Look for: Generic verbs without objects, pronouns without referents

2. CONTEXT PROVISION (High Priority)
   - Missing: References to "this code", "the bug", "it" without background
   - Good: Provides file paths, function signatures, relevant code snippets, error stack traces
   - Look for: Unclear referents, assumptions of shared knowledge

3. GOAL CLARITY (High Priority)
   - Unclear: "Look at this", "Review my code", "What's wrong?"
   - Good: Explicitly states desired outcome: "Find security vulnerabilities", "Optimize for performance", "Fix the null pointer exception"
   - Look for: Ambiguous success criteria, open-ended questions

4. SCOPE APPROPRIATENESS (Medium Priority)
   - Too broad: "Build me an app", "Refactor everything", multiple unrelated tasks
   - Too narrow: Overly specific constraints that limit solution space unnecessarily
   - Good: Focused single task or clearly ordered multiple tasks
   - Look for: Multiple "and" clauses, unrelated requests, scope creep

5. ACTIONABILITY (Medium Priority)
   - Low: "What do you think?", "Is this good?", purely exploratory
   - Good: Clear action requested: "Fix", "Implement", "Refactor", "Add"
   - Look for: Vague intentions, exploration without purpose

6. TECHNICAL RICHNESS (Medium Priority)
   - Missing: No code examples, file paths, function names, error messages
   - Good: Includes relevant code, stack traces, configuration, environment details
   - Look for: Purely conceptual descriptions without technical details

7. CONSTRAINT DEFINITION (Low Priority)
   - Missing: No requirements, edge cases, or constraints mentioned
   - Good: Specifies requirements, edge cases, performance needs, compatibility needs
   - Look for: Requests that could have many valid interpretations

SEVERITY GUIDELINES:
- high: Significantly impairs prompt effectiveness (vague, missing context, no goal)
- medium: Moderate impact on effectiveness (too broad, lacks technical details)
- low: Minor improvement opportunity (missing constraints, could be more specific)

SCORING GUIDELINES (0-100):
- 90-100: Excellent prompts - specific, contextual, actionable, well-scoped
- 75-89: Good prompts - minor improvements possible
- 60-74: Fair prompts - needs more context, clarity, or specificity
- 40-59: Poor prompts - multiple significant issues, partially actionable
- 20-39: Very poor - barely actionable, missing critical information
- 0-19: Extremely poor - cannot be meaningfully acted upon

PATTERN IDENTIFICATION:
- Group similar issues together (same root cause)
- Count frequency: how many prompts exhibit this pattern
- Provide 1-3 real examples from the actual prompts analyzed
- Create meaningful before/after pairs that clearly show improvement
- Ensure beforeAfter.before matches one of the examples

IMPROVEMENT PRIORITIES:
1. High severity patterns (vague, missing context, no goal) should appear first
2. More frequent patterns should rank higher
3. topSuggestion should address the most common high-severity issue

Remember: The goal is actionable feedback. Focus on patterns that, when fixed, would meaningfully improve prompt effectiveness for AI code assistants.`;

/**
 * Batch-Individual hybrid system prompt.
 * Uses batch processing for performance but returns individual results for accuracy.
 * Optimized to ~800 tokens (between minimal ~500 and full ~2000).
 */
export const SYSTEM_PROMPT_BATCH_INDIVIDUAL = `You will analyze multiple coding prompts. You MUST return a JSON array with exactly one result object for each prompt.

CRITICAL: Your response must be a JSON array starting with [ and ending with ]. Do not return a single object.

Format (JSON array with one object per prompt):
[
  {
    "status": "correct" | "problems",
    "problems": ["issue1", "issue2"],
    "categories": ["cat1", "cat2"],
    "example": "original prompt",
    "suggestion": "improvement"
  },
  {
    "status": "correct" | "problems",
    "problems": [],
    "categories": [],
    "example": "second prompt",
    "suggestion": "another suggestion"
  }
]

Categories (assign all that apply per prompt):
- vague-request: Lacks specifics ("help", "fix", "improve")
- missing-context: No file paths, function names, error messages
- too-broad: Multiple unrelated tasks
- unclear-goal: Desired outcome not stated
- other: Other issues

Rules:
- One result per prompt in the same order
- status="correct" if prompt is specific, contextual, and actionable
- status="problems" if ANY issue exists
- Multiple categories allowed per prompt
- Be strict but fair
- Include original prompt text in example field

Quality Guidelines:
- CORRECT: Has file path, function name, and specific issue
- CORRECT: States clear goal with necessary context
- PROBLEMS: Generic verbs without objects ("help", "fix")
- PROBLEMS: References without context ("this", "it", "the bug")
- PROBLEMS: Multiple unrelated tasks in one prompt

Examples:

Input: ["Help", "Fix bug in login.ts line 45 where users can't reset password"]
Output: [
  {
    "status": "problems",
    "problems": ["Too vague", "No context", "No goal"],
    "categories": ["vague-request", "missing-context", "unclear-goal"],
    "example": "Help",
    "suggestion": "Describe what you need help with, provide context (files, functions, errors), and state your goal"
  },
  {
    "status": "correct",
    "problems": [],
    "categories": [],
    "example": "Fix bug in login.ts line 45 where users can't reset password",
    "suggestion": "Well-formed: specific file, location, and issue"
  }
]

Analyze the following prompts:`;

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
