/**
 * Prompt Analyzer for Hyntx
 *
 * This module provides core analysis functionality for batching prompts,
 * merging results, and orchestrating the analysis workflow.
 */

import { sanitizePrompts } from './sanitizer.js';
import { logger } from '../utils/logger-base.js';
import { getCachedResult, setCachedResult } from '../cache/index.js';
import {
  type AnalysisProvider,
  type AnalysisResult,
  type AnalysisPattern,
  type PatternSeverity,
  type ProviderType,
  type ProviderLimits,
  type ProjectContext,
  type RulesConfig,
  PROVIDER_LIMITS,
  CACHE_DEFAULTS,
} from '../types/index.js';
import { applyRulesConfig, ISSUE_TAXONOMY } from '../providers/schemas.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * System overhead in tokens to reserve from the context limit.
 * Accounts for system prompt and response overhead.
 */
const SYSTEM_OVERHEAD_TOKENS = 2000;

/**
 * Minimum viable batch size in tokens.
 * Batches smaller than this are inefficient.
 * Currently unused but reserved for future optimization.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MIN_BATCH_SIZE_TOKENS = 5000;

/**
 * Severity ranking for sorting patterns.
 * Higher values = more severe.
 */
const SEVERITY_RANK: Record<PatternSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Maximum patterns to include in final result.
 */
const MAX_PATTERNS = 5;

/**
 * Maximum examples to include per pattern.
 */
const MAX_EXAMPLES_PER_PATTERN = 3;

/**
 * Estimated characters per token.
 * 1 token ≈ 4 characters (common approximation).
 */
const CHARS_PER_TOKEN = 4;

// =============================================================================
// Types
// =============================================================================

/**
 * A batch of prompts with estimated token count.
 */
type Batch = {
  readonly prompts: readonly string[];
  readonly tokens: number;
};

/**
 * Options for batching prompts.
 */
type BatchPromptsOptions = {
  readonly prompts: readonly string[];
  readonly maxTokensPerBatch: number;
  readonly maxPromptsPerBatch?: number;
  readonly prioritization: 'longest-first' | 'chronological';
};

/**
 * Options for merging batch results.
 */
type MergeBatchResultsOptions = {
  readonly results: readonly AnalysisResult[];
  readonly date: string;
};

/**
 * Options for analyzing prompts.
 */
type AnalyzePromptsOptions = {
  readonly provider: AnalysisProvider;
  readonly prompts: readonly string[];
  readonly date: string;
  readonly context?: ProjectContext;
  readonly rules?: RulesConfig;
  readonly onProgress?: (current: number, total: number) => void;
  readonly noCache?: boolean;
  /**
   * Pre-cached results from incremental results storage.
   * When provided, these will be merged with newly analyzed results
   * using mergeBatchResults(). This enables incremental analysis
   * where only new prompts are analyzed.
   */
  readonly cachedResults?: ReadonlyMap<string, AnalysisResult>;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Type guard to check if a provider supports dynamic batch limits.
 *
 * @param provider - Any analysis provider
 * @returns True if provider has getBatchLimits method
 */
function hasDynamicLimits(
  provider: AnalysisProvider,
): provider is AnalysisProvider & { getBatchLimits(): ProviderLimits } {
  return (
    typeof (provider as { getBatchLimits?: unknown }).getBatchLimits ===
    'function'
  );
}

/**
 * Determines if an error should trigger batch fallback retry.
 * Parse errors, schema errors, and network errors are good candidates.
 *
 * @param error - Error from provider.analyze()
 * @returns True if error warrants fallback retry
 */
function shouldFallback(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('parse') ||
    message.includes('schema') ||
    message.includes('json') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('failed')
  );
}

/**
 * Calculates the average of an array of numbers.
 *
 * @param numbers - Array of numbers
 * @returns Average value, or 0 if empty
 */
function average(numbers: readonly number[]): number {
  if (numbers.length === 0) return 0;
  return sum(numbers) / numbers.length;
}

/**
 * Calculates the sum of an array of numbers.
 *
 * @param numbers - Array of numbers
 * @returns Sum of all values
 */
function sum(numbers: readonly number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Flattens an array of arrays into a single array.
 * Does NOT remove duplicates - duplicates are merged later.
 *
 * @param arrays - Array of pattern arrays
 * @returns Flattened array with all patterns
 */
function flattenAll(
  arrays: readonly (readonly AnalysisPattern[])[],
): AnalysisPattern[] {
  const result: AnalysisPattern[] = [];

  for (const arr of arrays) {
    for (const item of arr) {
      result.push(item);
    }
  }

  return result;
}

/**
 * Limits the number of examples in an array.
 *
 * @param examples - Array of examples
 * @param max - Maximum number to keep
 * @returns Limited array
 */
function limitExamples(
  examples: readonly string[],
  max: number,
): readonly string[] {
  return examples.slice(0, max);
}

/**
 * Infers provider type from provider name.
 *
 * @param providerName - Name of the provider (e.g., "Ollama", "Anthropic")
 * @returns Provider type
 */
function inferProviderType(providerName: string): ProviderType {
  const nameLower = providerName.toLowerCase();
  if (nameLower.includes('ollama')) return 'ollama';
  if (nameLower.includes('anthropic') || nameLower.includes('claude'))
    return 'anthropic';
  if (nameLower.includes('google') || nameLower.includes('gemini'))
    return 'google';
  return 'ollama'; // Default fallback
}

/**
 * Extracts model identifier from provider name.
 * Provider names typically follow the pattern "Provider (model-name)".
 *
 * @param providerName - Provider name (e.g., "Ollama (llama3.2)")
 * @returns Model identifier or provider name if no model found
 */
export function extractModelFromProvider(providerName: string): string {
  const match = /\((.*?)\)/.exec(providerName);
  return match?.[1] ?? providerName;
}

/**
 * Returns the maximum severity from an array of severities.
 *
 * @param severities - Array of severity levels
 * @returns Maximum severity
 */
function maxSeverity(severities: readonly PatternSeverity[]): PatternSeverity {
  if (severities.length === 0) return 'low';

  let max: PatternSeverity = 'low';
  let maxRank = SEVERITY_RANK.low;

  for (const severity of severities) {
    const rank = SEVERITY_RANK[severity];
    if (rank > maxRank) {
      max = severity;
      maxRank = rank;
    }
  }

  return max;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Recursively analyzes a batch with automatic fallback on failure.
 * When a batch fails with a retryable error, splits it in half and retries each part.
 * Single-prompt failures are skipped gracefully.
 *
 * @param provider - Analysis provider
 * @param prompts - Prompts to analyze
 * @param date - Date context
 * @param context - Optional project context
 * @param model - Model identifier for cache
 * @param noCache - Whether to skip cache
 * @returns Array of successful analysis results (may be empty if all fail)
 */
async function analyzeWithFallback(
  provider: AnalysisProvider,
  prompts: readonly string[],
  date: string,
  context: ProjectContext | undefined,
  model: string,
  noCache: boolean,
): Promise<readonly AnalysisResult[]> {
  if (prompts.length === 0) {
    return [];
  }

  try {
    // Check cache first (unless noCache is true)
    if (!noCache) {
      const cachedResult = await getCachedResult(
        prompts,
        model,
        CACHE_DEFAULTS,
      );
      if (cachedResult) {
        logger.debug(
          `Using cached result for batch of ${String(prompts.length)} prompt(s)`,
          'analyzer',
        );
        return [{ ...cachedResult, date }];
      }
    }

    // Attempt analysis
    const result = await provider.analyze(prompts, date, context);

    // Store in cache (unless noCache is true)
    if (!noCache) {
      await setCachedResult(prompts, model, result);
    }

    return [result];
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check if this is a retryable error
    if (shouldFallback(err)) {
      // If batch has multiple prompts, split and retry
      if (prompts.length > 1) {
        const mid = Math.ceil(prompts.length / 2);
        const leftPrompts = prompts.slice(0, mid);
        const rightPrompts = prompts.slice(mid);

        logger.debug(
          `Batch of ${String(prompts.length)} failed, splitting into ${String(leftPrompts.length)} + ${String(rightPrompts.length)}`,
          'analyzer',
        );

        // Recursively retry both halves
        const [leftResults, rightResults] = await Promise.all([
          analyzeWithFallback(
            provider,
            leftPrompts,
            date,
            context,
            model,
            noCache,
          ),
          analyzeWithFallback(
            provider,
            rightPrompts,
            date,
            context,
            model,
            noCache,
          ),
        ]);

        return [...leftResults, ...rightResults];
      }

      // Single prompt failed - skip it gracefully
      const promptPreview = prompts[0]?.slice(0, 50) ?? 'unknown';
      logger.warn(
        `Skipped single prompt due to error: ${promptPreview}... (${err.message})`,
        'analyzer',
      );
      return [];
    }

    // Non-retryable error - propagate it
    throw err;
  }
}

/**
 * Estimates the token count for a given text.
 *
 * Uses a simple approximation: 1 token ≈ 4 characters.
 * This is a conservative estimate that works across most tokenizers.
 *
 * @param text - Text to estimate
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * estimateTokens('Hello world') // 3 tokens
 * estimateTokens('') // 0 tokens
 * ```
 */
export function estimateTokens(text: string): number {
  if (!text || text.length === 0) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Batches prompts intelligently based on token limits and prioritization strategy.
 *
 * Uses a greedy bin-packing algorithm to create batches that respect token limits
 * while minimizing the number of API calls.
 *
 * @param options - Batching options
 * @returns Array of batches
 *
 * @example
 * ```typescript
 * const batches = batchPrompts({
 *   prompts: ['short', 'medium prompt', 'very long prompt...'],
 *   maxTokensPerBatch: 1000,
 *   maxPromptsPerBatch: 5,
 *   prioritization: 'longest-first'
 * });
 * ```
 */
export function batchPrompts(options: BatchPromptsOptions): readonly Batch[] {
  const { prompts, maxTokensPerBatch, maxPromptsPerBatch, prioritization } =
    options;

  if (prompts.length === 0) {
    return [];
  }

  // Reserve space for system overhead
  const effectiveLimit = maxTokensPerBatch - SYSTEM_OVERHEAD_TOKENS;

  // Calculate token estimates for each prompt
  const promptsWithTokens = prompts.map((prompt) => ({
    prompt,
    tokens: estimateTokens(prompt),
  }));

  // Sort based on prioritization strategy
  const sorted =
    prioritization === 'longest-first'
      ? [...promptsWithTokens].sort((a, b) => b.tokens - a.tokens)
      : promptsWithTokens; // chronological maintains original order

  // Greedy bin-packing algorithm
  const batches: Batch[] = [];
  let currentBatch: string[] = [];
  let currentTokens = 0;

  for (const { prompt, tokens } of sorted) {
    // Handle oversized prompts (create dedicated batch)
    if (tokens > effectiveLimit) {
      // Flush current batch if it has content
      if (currentBatch.length > 0) {
        batches.push({ prompts: currentBatch, tokens: currentTokens });
        currentBatch = [];
        currentTokens = 0;
      }
      // Create dedicated batch for oversized prompt
      batches.push({ prompts: [prompt], tokens });
      continue;
    }

    // Check if adding this prompt would exceed token limit or prompt count limit
    const wouldExceedTokens =
      currentTokens + tokens > effectiveLimit && currentBatch.length > 0;
    const wouldExceedPrompts =
      maxPromptsPerBatch !== undefined &&
      currentBatch.length >= maxPromptsPerBatch;

    if (wouldExceedTokens || wouldExceedPrompts) {
      // Flush current batch and start new one
      batches.push({ prompts: currentBatch, tokens: currentTokens });
      currentBatch = [prompt];
      currentTokens = tokens;
    } else {
      // Add to current batch
      currentBatch.push(prompt);
      currentTokens += tokens;
    }
  }

  // Flush final batch
  if (currentBatch.length > 0) {
    batches.push({ prompts: currentBatch, tokens: currentTokens });
  }

  return batches;
}

/**
 * Merges multiple batch results into a single consolidated result.
 *
 * Handles deduplication, averaging, and limiting of patterns and statistics.
 *
 * @param options - Merge options
 * @returns Merged analysis result
 *
 * @example
 * ```typescript
 * const merged = mergeBatchResults({
 *   results: [result1, result2, result3],
 *   date: '2025-01-15'
 * });
 * ```
 */
export function mergeBatchResults(
  options: MergeBatchResultsOptions,
): AnalysisResult {
  const { results, date } = options;

  if (results.length === 0) {
    throw new Error('Cannot merge empty results array');
  }

  // Fast path: single result (still apply limiting and date override)
  if (results.length === 1) {
    const result = results[0];
    if (!result) {
      throw new Error('Results array is empty');
    }

    // Apply limiting to patterns and examples
    const limitedPatterns = result.patterns
      .map((p) => ({
        ...p,
        examples: limitExamples(p.examples, MAX_EXAMPLES_PER_PATTERN),
      }))
      .sort((a, b) => {
        const severityDiff =
          SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (severityDiff !== 0) return severityDiff;
        return b.frequency - a.frequency;
      })
      .slice(0, MAX_PATTERNS);

    const topSuggestion =
      limitedPatterns.length > 0 && limitedPatterns[0]
        ? limitedPatterns[0].suggestion
        : result.topSuggestion;

    return {
      ...result,
      date,
      patterns: limitedPatterns,
      topSuggestion,
    };
  }

  // Flatten all patterns (duplicates will be merged below)
  const allPatterns = flattenAll(results.map((r) => r.patterns));

  // Group patterns by ID and merge
  const patternGroups = new Map<string, AnalysisPattern[]>();

  for (const pattern of allPatterns) {
    const group = patternGroups.get(pattern.id) ?? [];
    group.push(pattern);
    patternGroups.set(pattern.id, group);
  }

  // Merge each group into a single pattern
  const mergedPatterns: AnalysisPattern[] = [];

  for (const group of patternGroups.values()) {
    if (group.length === 0) continue;

    const firstPattern = group[0];
    if (!firstPattern) continue;

    if (group.length === 1) {
      // Single pattern, just limit examples
      mergedPatterns.push({
        ...firstPattern,
        examples: limitExamples(
          firstPattern.examples,
          MAX_EXAMPLES_PER_PATTERN,
        ),
      });
    } else {
      // Multiple patterns with same ID - merge them
      const frequencies = group.map((p) => p.frequency);
      const severities = group.map((p) => p.severity);
      const allExamples = group.flatMap((p) => Array.from(p.examples));

      const mergedFrequency = Math.round(average(frequencies));
      const mergedSeverity = maxSeverity(severities);
      const mergedExamples = limitExamples(
        allExamples,
        MAX_EXAMPLES_PER_PATTERN,
      );

      mergedPatterns.push({
        ...firstPattern,
        frequency: mergedFrequency,
        severity: mergedSeverity,
        examples: mergedExamples,
      });
    }
  }

  // Sort patterns by severity (desc) then frequency (desc)
  const sortedPatterns = mergedPatterns.sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.frequency - a.frequency;
  });

  // Limit to top patterns
  const topPatterns = sortedPatterns.slice(0, MAX_PATTERNS);

  // Aggregate statistics
  const totalPrompts = sum(results.map((r) => r.stats.totalPrompts));
  const promptsWithIssues = sum(results.map((r) => r.stats.promptsWithIssues));
  const avgScore = Math.round(
    average(results.map((r) => r.stats.overallScore)),
  );

  // Use top suggestion from first result (or most severe pattern)
  const topSuggestion =
    topPatterns.length > 0 && topPatterns[0]
      ? topPatterns[0].suggestion
      : (results[0]?.topSuggestion ?? 'No suggestions available');

  return {
    date,
    patterns: topPatterns,
    stats: {
      totalPrompts,
      promptsWithIssues,
      overallScore: avgScore,
    },
    topSuggestion,
  };
}

/**
 * Applies rules configuration to an analysis result.
 * Filters out disabled patterns and updates severities.
 *
 * @param result - Analysis result to modify
 * @param rules - Rules configuration
 * @returns Modified analysis result
 */
function applyRulesToResult(
  result: AnalysisResult,
  rules: RulesConfig | undefined,
): AnalysisResult {
  if (!rules || Object.keys(rules).length === 0) {
    return result;
  }

  // Create custom taxonomy with rules applied
  const customTaxonomy = applyRulesConfig(rules, ISSUE_TAXONOMY);
  const enabledPatternIds = Object.keys(customTaxonomy);

  // Filter patterns to only include enabled ones
  const filteredPatterns = result.patterns.filter((pattern) =>
    enabledPatternIds.includes(pattern.id),
  );

  // Update severities based on rules
  const updatedPatterns = filteredPatterns.map((pattern) => {
    const ruleConfig = rules[pattern.id];
    // ruleConfig should always exist since we filtered by enabledPatternIds,
    // but we use optional chaining for type safety
    if (ruleConfig?.severity) {
      return {
        ...pattern,
        severity: ruleConfig.severity,
      };
    }
    return pattern;
  });

  // Update top suggestion if patterns changed
  const topSuggestion =
    updatedPatterns.length > 0 && updatedPatterns[0]
      ? updatedPatterns[0].suggestion
      : result.topSuggestion;

  return {
    ...result,
    patterns: updatedPatterns,
    topSuggestion,
  };
}

/**
 * Merges analysis results with pre-cached results and applies rules.
 * If no cached results are provided, just applies rules to the new results.
 *
 * @param newResults - Array of newly analyzed results
 * @param cachedResults - Optional map of pre-cached results
 * @param date - Date context for merging
 * @param rules - Rules configuration to apply
 * @returns Merged and filtered analysis result
 */
function mergeWithCachedResults(
  newResults: readonly AnalysisResult[],
  cachedResults: ReadonlyMap<string, AnalysisResult> | undefined,
  date: string,
  rules: RulesConfig | undefined,
): AnalysisResult {
  // If no cached results, just merge new results and apply rules
  if (!cachedResults || cachedResults.size === 0) {
    if (newResults.length === 1) {
      const result = newResults[0];
      if (result) {
        return applyRulesToResult(result, rules);
      }
    }
    const mergedResult = mergeBatchResults({ results: newResults, date });
    return applyRulesToResult(mergedResult, rules);
  }

  // Combine cached and new results
  const cachedArray = Array.from(cachedResults.values());
  const allResults = [...cachedArray, ...newResults];

  logger.debug(
    `Merging ${String(cachedArray.length)} cached + ${String(newResults.length)} new results`,
    'analyzer',
  );

  const mergedResult = mergeBatchResults({ results: allResults, date });
  return applyRulesToResult(mergedResult, rules);
}

/**
 * Analyzes prompts using the provided AI provider.
 *
 * Orchestrates the full analysis workflow:
 * 1. Sanitizes prompts to remove secrets
 * 2. Batches prompts based on provider limits
 * 3. Checks cache for existing results (unless noCache is true)
 * 4. Processes batches sequentially with progress updates
 * 5. Stores results in cache for future use
 * 6. Merges batch results with any provided cached results
 * 7. Applies rules configuration to filter/modify patterns
 *
 * For incremental analysis, use the `cachedResults` option to provide
 * pre-loaded results from the incremental results storage. This allows
 * the analyzer to only process new prompts and merge the results.
 *
 * @param options - Analysis options
 * @returns Analysis result
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await analyzePrompts({
 *   provider: ollamaProvider,
 *   prompts: ['prompt1', 'prompt2', 'prompt3'],
 *   date: '2025-01-15',
 *   context: { role: 'developer', techStack: ['TypeScript'] },
 *   onProgress: (current, total) => console.log(`${current}/${total}`),
 *   noCache: false
 * });
 *
 * // With incremental cached results
 * const { cached, toAnalyze } = await getPromptsWithCache(prompts, model, schema);
 * const result = await analyzePrompts({
 *   provider,
 *   prompts: toAnalyze.map(p => p.content),
 *   date: '2025-01-15',
 *   cachedResults: cached,  // Pre-loaded results from incremental storage
 * });
 * ```
 */
export async function analyzePrompts(
  options: AnalyzePromptsOptions,
): Promise<AnalysisResult> {
  const {
    provider,
    prompts,
    date,
    context,
    rules,
    onProgress,
    noCache,
    cachedResults,
  } = options;

  logger.debug(
    `Starting analysis of ${String(prompts.length)} prompts for ${date}`,
    'analyzer',
  );

  // If we have only cached results and no new prompts to analyze
  if (prompts.length === 0 && cachedResults && cachedResults.size > 0) {
    logger.debug(
      `Using ${String(cachedResults.size)} cached result(s), no new prompts to analyze`,
      'analyzer',
    );
    const cachedArray = Array.from(cachedResults.values());
    const mergedResult = mergeBatchResults({ results: cachedArray, date });
    return applyRulesToResult(mergedResult, rules);
  }

  if (prompts.length === 0) {
    throw new Error('Cannot analyze empty prompts array');
  }

  // Log cache statistics if available
  if (cachedResults && cachedResults.size > 0) {
    const totalPrompts = prompts.length + cachedResults.size;
    const cacheHitRate = ((cachedResults.size / totalPrompts) * 100).toFixed(1);
    logger.debug(
      `Results cache: ${String(cachedResults.size)} cached, ${String(prompts.length)} to analyze (${cacheHitRate}% hit rate)`,
      'analyzer',
    );
  }

  // Step 1: Sanitize prompts
  const { prompts: sanitizedPrompts, totalRedacted } = sanitizePrompts(prompts);

  if (totalRedacted > 0) {
    logger.debug(
      `Sanitizer redacted ${String(totalRedacted)} secrets`,
      'analyzer',
    );
  }

  // Step 2: Get provider limits (dynamic if supported, static otherwise)
  const limits = hasDynamicLimits(provider)
    ? provider.getBatchLimits()
    : PROVIDER_LIMITS[inferProviderType(provider.name)];

  const limitsInfo = limits.maxPromptsPerBatch
    ? `${String(limits.maxTokensPerBatch)} tokens/batch, max ${String(limits.maxPromptsPerBatch)} prompts/batch`
    : `${String(limits.maxTokensPerBatch)} tokens/batch`;

  logger.debug(`Using batch limits: ${limitsInfo}`, 'analyzer');

  // Step 3: Batch prompts
  const batches = batchPrompts({
    prompts: sanitizedPrompts,
    maxTokensPerBatch: limits.maxTokensPerBatch,
    maxPromptsPerBatch: limits.maxPromptsPerBatch,
    prioritization: limits.prioritization,
  });

  logger.debug(
    `Created ${String(batches.length)} batch(es) for analysis`,
    'analyzer',
  );

  // Fast path: single batch (no merge overhead)
  if (batches.length === 1) {
    const batch = batches[0];
    if (!batch) {
      throw new Error('Failed to create batches');
    }

    if (onProgress) {
      onProgress(0, 1);
    }

    // Extract model identifier for cache key
    const model = extractModelFromProvider(provider.name);

    logger.debug(
      `Processing single batch (${String(batch.tokens)} tokens, ${String(batch.prompts.length)} prompts)`,
      'analyzer',
    );
    const startTime = Date.now();

    // Use fallback logic for resilience
    const results = await analyzeWithFallback(
      provider,
      batch.prompts,
      date,
      context,
      model,
      noCache ?? false,
    );

    const elapsed = Date.now() - startTime;
    logger.debug(`Batch completed in ${String(elapsed)}ms`, 'analyzer');

    if (onProgress) {
      onProgress(1, 1);
    }

    // If fallback resulted in multiple results, merge them
    if (results.length === 0) {
      throw new Error('All prompts failed analysis');
    }

    // Merge new results with cached results (if any)
    logger.debug(`Analysis complete, merging with cached results`, 'analyzer');

    return mergeWithCachedResults(results, cachedResults, date, rules);
  }

  // Step 4: Process batches sequentially with progress updates
  const results: AnalysisResult[] = [];
  const totalBatches = batches.length;
  const model = extractModelFromProvider(provider.name);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    if (!batch) continue;

    if (onProgress) {
      onProgress(i, totalBatches);
    }

    logger.debug(
      `Processing batch ${String(i + 1)}/${String(totalBatches)} (${String(batch.tokens)} tokens, ${String(batch.prompts.length)} prompts)`,
      'analyzer',
    );
    const startTime = Date.now();

    // Use fallback logic for resilience
    const batchResults = await analyzeWithFallback(
      provider,
      batch.prompts,
      date,
      context,
      model,
      noCache ?? false,
    );

    // Add all successful results (may be 0 if all failed)
    results.push(...batchResults);

    const elapsed = Date.now() - startTime;
    logger.debug(
      `Batch ${String(i + 1)}/${String(totalBatches)} completed in ${String(elapsed)}ms (${String(batchResults.length)} result(s))`,
      'analyzer',
    );
  }

  if (onProgress) {
    onProgress(totalBatches, totalBatches);
  }

  // Check if we have any results
  if (results.length === 0) {
    throw new Error('All batches failed analysis');
  }

  // Step 5: Merge results with cached results (if any)
  logger.debug(
    `Analysis complete, merging ${String(results.length)} batch results with cached results`,
    'analyzer',
  );

  return mergeWithCachedResults(results, cachedResults, date, rules);
}
