/**
 * Incremental results storage for individual prompt analyses.
 *
 * This module provides storage for individual prompt analysis results,
 * organized by date (YYYY-MM-DD) and keyed by a hash of:
 * - Prompt content
 * - Date
 * - Project (optional)
 * - Model
 * - Schema type
 * - System prompt hash
 *
 * This enables efficient incremental analysis where previously analyzed
 * prompts can be skipped.
 *
 * Storage structure: ~/.hyntx/results/<YYYY-MM-DD>/<hash>.json
 */

import { existsSync, readdirSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { isBefore, parseISO } from 'date-fns';

import { hashString, hashSystemPrompt } from '../cache/analysis-cache.js';
import type {
  AnalysisResult,
  ExtractedPrompt,
  PromptResult,
  PromptResultMetadata,
} from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import { getResultsDateDir, HYNTX_RESULTS_DIR } from '../utils/paths.js';

// =============================================================================
// Hash Generation
// =============================================================================

/**
 * Generates a unique hash for a prompt result.
 * The hash includes the system prompt hash for automatic invalidation.
 *
 * Hash input format (null-byte separated):
 * - Prompt content
 * - Date (YYYY-MM-DD)
 * - Project (or empty string)
 * - Model
 * - Schema type
 * - System prompt hash
 *
 * @param prompt - Prompt content
 * @param metadata - Result metadata
 * @returns SHA-256 hash of the input
 */
export function getPromptResultHash(
  prompt: string,
  metadata: Pick<
    PromptResultMetadata,
    'date' | 'project' | 'model' | 'schemaType'
  >,
): string {
  const systemPromptHash = hashSystemPrompt();
  const input = [
    prompt,
    metadata.date,
    metadata.project ?? '',
    metadata.model,
    metadata.schemaType,
    systemPromptHash,
  ].join('\x00');

  return hashString(input);
}

// =============================================================================
// Load Operations
// =============================================================================

/**
 * Loads a cached prompt result if it exists and is valid.
 * Returns null on any error (cache miss).
 *
 * No validation is needed because the hash includes the system prompt hash,
 * so if the system prompt changes, the hash will be different and the
 * cache will miss automatically.
 *
 * @param prompt - Prompt content
 * @param metadata - Result metadata
 * @returns Cached result or null
 */
export async function getPromptResult(
  prompt: string,
  metadata: Pick<
    PromptResultMetadata,
    'date' | 'project' | 'model' | 'schemaType'
  >,
): Promise<AnalysisResult | null> {
  const hash = getPromptResultHash(prompt, metadata);
  const dateDir = getResultsDateDir(metadata.date);
  const filePath = join(dateDir, `${hash}.json`);

  if (!existsSync(filePath)) {
    logger.debug(
      `Cache miss for prompt on ${metadata.date} (hash: ${hash.slice(0, 8)}...)`,
      'results',
    );
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as Partial<PromptResult>;

    // Validate required fields
    if (!data.result || !data.metadata) {
      logger.debug(
        `Invalid cached result for hash ${hash.slice(0, 8)}...`,
        'results',
      );
      return null;
    }

    logger.debug(
      `Cache hit for prompt on ${metadata.date} (hash: ${hash.slice(0, 8)}...)`,
      'results',
    );
    return data.result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.debug(
      `Failed to read cached result ${hash.slice(0, 8)}...: ${errorMessage}`,
      'results',
    );
    return null;
  }
}

// =============================================================================
// Save Operations
// =============================================================================

/**
 * Ensures a date-specific results directory exists.
 *
 * @param date - Date string (YYYY-MM-DD)
 */
async function ensureDateDir(date: string): Promise<void> {
  const dateDir = getResultsDateDir(date);
  await mkdir(dateDir, { recursive: true, mode: 0o700 });
}

/**
 * Saves a prompt analysis result with atomic write.
 * Does not throw on failure - logs warning instead.
 *
 * @param prompt - Original prompt content
 * @param result - Analysis result
 * @param metadata - Result metadata
 */
export async function savePromptResult(
  prompt: string,
  result: AnalysisResult,
  metadata: Omit<PromptResultMetadata, 'promptHash' | 'analyzedAt'>,
): Promise<void> {
  try {
    await ensureDateDir(metadata.date);

    const hash = getPromptResultHash(prompt, metadata);
    const promptHash = hashString(prompt);

    const fullMetadata: PromptResultMetadata = {
      ...metadata,
      promptHash,
      analyzedAt: Date.now(),
    };

    const promptResult: PromptResult = {
      result,
      metadata: fullMetadata,
    };

    const dateDir = getResultsDateDir(metadata.date);
    const filePath = join(dateDir, `${hash}.json`);
    const content = JSON.stringify(promptResult, null, 2);

    // Atomic write using temp file
    const tmpFile = `${filePath}.tmp`;
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, filePath);

    logger.debug(
      `Saved result for prompt on ${metadata.date} (hash: ${hash.slice(0, 8)}...)`,
      'results',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Failed to save prompt result for ${metadata.date}: ${errorMessage}`,
      'results',
    );
  }
}

// =============================================================================
// Batch Operations
// =============================================================================

/**
 * Loads cached results for multiple prompts in parallel.
 * Returns a map of cached results and a list of prompts that need analysis.
 *
 * @param prompts - Array of prompts to check
 * @param model - Model identifier
 * @param schemaType - Schema type
 * @returns Object with cached results map and prompts to analyze
 */
export async function getPromptsWithCache(
  prompts: readonly ExtractedPrompt[],
  model: string,
  schemaType: string,
): Promise<{
  readonly cached: ReadonlyMap<string, AnalysisResult>;
  readonly toAnalyze: readonly ExtractedPrompt[];
}> {
  // Load all cached results in parallel
  const cacheResults = await Promise.all(
    prompts.map(async (prompt) => {
      const result = await getPromptResult(prompt.content, {
        date: prompt.date,
        project: prompt.project,
        model,
        schemaType,
      });
      return { prompt, result };
    }),
  );

  // Build cached map and toAnalyze list
  const cached = new Map<string, AnalysisResult>();
  const toAnalyze: ExtractedPrompt[] = [];

  for (const { prompt, result } of cacheResults) {
    if (result) {
      cached.set(prompt.content, result);
    } else {
      toAnalyze.push(prompt);
    }
  }

  // Log cache statistics
  const hitRate =
    prompts.length > 0
      ? ((cached.size / prompts.length) * 100).toFixed(1)
      : '0.0';
  logger.debug(
    `Cache: ${String(cached.size)} hits, ${String(toAnalyze.length)} misses (${hitRate}% hit rate)`,
    'results',
  );

  return { cached, toAnalyze };
}

// =============================================================================
// Cleanup Operations
// =============================================================================

/**
 * Deletes all cached results before a specified date.
 * Removes entire date directories.
 *
 * @param beforeDate - Date string (YYYY-MM-DD) or Date object
 * @returns Number of directories deleted
 */
export async function cleanupResults(
  beforeDate: string | Date,
): Promise<number> {
  if (!existsSync(HYNTX_RESULTS_DIR)) {
    return 0;
  }

  try {
    const cutoffDate =
      typeof beforeDate === 'string' ? parseISO(beforeDate) : beforeDate;
    const directories = readdirSync(HYNTX_RESULTS_DIR);
    let deletedCount = 0;

    for (const dir of directories) {
      // Validate date format (YYYY-MM-DD)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dir)) {
        continue;
      }

      try {
        const dirDate = parseISO(dir);
        if (isBefore(dirDate, cutoffDate)) {
          const dirPath = join(HYNTX_RESULTS_DIR, dir);
          await rm(dirPath, { recursive: true, force: true });
          deletedCount++;
          logger.debug(`Deleted results directory: ${dir}`, 'results');
        }
      } catch {
        // Skip invalid date directories
        continue;
      }
    }

    if (deletedCount > 0) {
      logger.debug(
        `Cleanup removed ${String(deletedCount)} date directories`,
        'results',
      );
    }

    return deletedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to cleanup results: ${errorMessage}`, 'results');
    return 0;
  }
}
