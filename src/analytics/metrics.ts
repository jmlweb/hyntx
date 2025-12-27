/**
 * Prompt Quality Metrics Module
 *
 * Provides metrics for analyzing prompt specificity and lexical complexity.
 * These metrics help quantify how detailed and well-structured prompts are.
 */

import type { LexicalMetrics, SpecificityScore } from '../types/index.js';

// =============================================================================
// Pattern Definitions
// =============================================================================

/**
 * Regex patterns for detecting specific elements in prompts.
 */
const SPECIFICITY_PATTERNS = {
  // File paths with common extensions
  filePath:
    /\b[\w/-]+\.(ts|js|tsx|jsx|py|go|java|rb|php|json|yaml|yml|xml|md|sql|sh|bash|css|scss|sass|html|vue|svelte|rs)\b/gi,

  // Function references and method calls
  functionRef:
    /\b(function|def|class|const|let|var|fn|func|method|async|export)\s+\w+|\.\w+\(|\w+\(/g,

  // Error messages and exceptions
  errorMessage:
    /\b(error|exception|failed|crash|undefined|null|NaN|TypeError|ReferenceError|SyntaxError|warning|fatal|panic)\b/gi,

  // Code snippets (backticks and code blocks)
  codeSnippet: /```[\s\S]*?```|`[^`]+`/g,

  // Action verbs indicating specific tasks
  actionVerbs:
    /\b(fix|implement|add|remove|update|refactor|debug|optimize|create|delete|modify|change|improve|enhance|replace|migrate|test|validate|deploy|build|compile|install)\b/gi,

  // Technical terms indicating domain knowledge
  technicalTerms:
    /\b(API|REST|GraphQL|SQL|database|schema|endpoint|middleware|component|service|controller|model|view|route|auth|authentication|authorization|JWT|token|session|cache|Redis|Docker|Kubernetes|CI\/CD|deployment|production|testing|unit test|integration|async|promise|callback|closure|immutable|state|props|hook|lifecycle)\b/gi,
} as const;

// =============================================================================
// Main Metrics Functions
// =============================================================================

/**
 * Compute specificity score for a prompt.
 *
 * Measures how specific and detailed a prompt is by analyzing:
 * - File paths mentioned
 * - Function/method references
 * - Error messages included
 * - Code snippets provided
 * - Action verb clarity
 *
 * @param prompt - The prompt text to analyze
 * @returns Specificity score with detailed breakdown
 *
 * @example
 * ```typescript
 * const prompt = "Fix the authentication bug in src/auth/login.ts where JWT validation fails";
 * const score = computePromptSpecificity(prompt);
 * console.log(score.overall); // High score (e.g., 75)
 * console.log(score.filePathCount); // 1
 * console.log(score.hasErrorMessage); // true
 * ```
 */
export function computePromptSpecificity(prompt: string): SpecificityScore {
  const filePaths = prompt.match(SPECIFICITY_PATTERNS.filePath) ?? [];
  const functionRefs = prompt.match(SPECIFICITY_PATTERNS.functionRef) ?? [];
  const errorMessages = prompt.match(SPECIFICITY_PATTERNS.errorMessage) ?? [];
  const codeSnippets = prompt.match(SPECIFICITY_PATTERNS.codeSnippet) ?? [];
  const actionVerbs = prompt.match(SPECIFICITY_PATTERNS.actionVerbs) ?? [];

  const filePathCount = filePaths.length;
  const functionMentions = functionRefs.length;
  const hasErrorMessage = errorMessages.length > 0;
  const hasCodeSnippet = codeSnippets.length > 0;
  const wordCount = prompt.trim().split(/\s+/).length;
  const characterCount = prompt.length;

  // Action verb clarity: ratio of action verbs to total words
  const actionVerbClarity =
    wordCount > 0 ? (actionVerbs.length / wordCount) * 100 : 0;

  // Calculate overall specificity score (0-100)
  const overall = calculateOverallSpecificity({
    filePathCount,
    functionMentions,
    hasErrorMessage,
    hasCodeSnippet,
    actionVerbClarity,
    wordCount,
  });

  return {
    overall,
    filePathCount,
    functionMentions,
    hasErrorMessage,
    hasCodeSnippet,
    actionVerbClarity: Math.min(100, Math.round(actionVerbClarity * 10) / 10),
    wordCount,
    characterCount,
  };
}

/**
 * Compute lexical complexity metrics for text.
 *
 * Analyzes text complexity using:
 * - Unique word ratio (Type-Token Ratio)
 * - Average word length
 * - Technical term density
 * - Sentence structure
 *
 * @param text - The text to analyze
 * @returns Lexical complexity metrics
 *
 * @example
 * ```typescript
 * const text = "Implement JWT authentication middleware for the REST API endpoints";
 * const metrics = computeLexicalComplexity(text);
 * console.log(metrics.technicalTermDensity); // High due to JWT, REST, API
 * console.log(metrics.uniqueWordRatio); // Close to 1.0 (all unique words)
 * ```
 */
export function computeLexicalComplexity(text: string): LexicalMetrics {
  const words = text.toLowerCase().match(/\b[a-z]+\b/gi) ?? [];
  const uniqueWords = new Set(words);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

  const technicalTerms = text.match(SPECIFICITY_PATTERNS.technicalTerms) ?? [];

  // Type-Token Ratio: ratio of unique words to total words
  const uniqueWordRatio =
    words.length > 0 ? uniqueWords.size / words.length : 0;

  // Average word length
  const totalLength = words.reduce((sum, word) => sum + word.length, 0);
  const averageWordLength = words.length > 0 ? totalLength / words.length : 0;

  // Technical term density: percentage of words that are technical terms
  const technicalTermDensity =
    words.length > 0 ? (technicalTerms.length / words.length) * 100 : 0;

  // Sentence metrics
  const sentenceCount = sentences.length;
  const averageSentenceLength =
    sentenceCount > 0 ? words.length / sentenceCount : 0;

  return {
    uniqueWordRatio: Math.round(uniqueWordRatio * 1000) / 1000,
    averageWordLength: Math.round(averageWordLength * 10) / 10,
    technicalTermDensity: Math.round(technicalTermDensity * 10) / 10,
    sentenceCount,
    averageSentenceLength: Math.round(averageSentenceLength * 10) / 10,
  };
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Calculate overall specificity score based on individual metrics.
 *
 * Scoring algorithm:
 * - File paths: +15 points each (max 30)
 * - Function mentions: +10 points each (max 20)
 * - Error message: +15 points
 * - Code snippet: +15 points
 * - Action verb clarity: up to 20 points
 *
 * Total: 100 points maximum
 */
function calculateOverallSpecificity(params: {
  filePathCount: number;
  functionMentions: number;
  hasErrorMessage: boolean;
  hasCodeSnippet: boolean;
  actionVerbClarity: number;
  wordCount: number;
}): number {
  let score = 0;

  // File paths contribute up to 30 points
  score += Math.min(30, params.filePathCount * 15);

  // Function mentions contribute up to 20 points
  score += Math.min(20, params.functionMentions * 10);

  // Error message contributes 15 points
  if (params.hasErrorMessage) {
    score += 15;
  }

  // Code snippet contributes 15 points
  if (params.hasCodeSnippet) {
    score += 15;
  }

  // Action verb clarity contributes up to 20 points
  // Scale actionVerbClarity (which is percentage of action verbs)
  // Normalize: if 10% of words are action verbs = full 20 points
  score += Math.min(20, (params.actionVerbClarity / 10) * 20);

  return Math.min(100, Math.round(score));
}
