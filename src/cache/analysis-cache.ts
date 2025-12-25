/**
 * Disk-based cache for analysis results.
 *
 * This module provides caching functionality to avoid redundant API calls
 * for the same prompts. Cache entries are invalidated when:
 * - TTL expires (default: 7 days)
 * - Model changes
 * - System prompt changes
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync } from 'node:fs';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { CACHE_ANALYSIS_DIR, CACHE_META_FILE } from '../utils/paths.js';
import { logger } from '../utils/logger.js';
import { SYSTEM_PROMPT } from '../providers/base.js';
import type {
  AnalysisResult,
  CachedBatchResult,
  CacheMetadata,
  CacheOptions,
} from '../types/index.js';
import { CACHE_DEFAULTS } from '../types/index.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Metadata file structure for cache invalidation.
 */
type CacheMetadataFile = {
  readonly systemPromptHash: string;
  readonly lastUpdated: number;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Ensures the cache directory exists with proper permissions.
 * Creates the directory if it doesn't exist.
 */
async function ensureCacheDir(): Promise<void> {
  try {
    await mkdir(CACHE_ANALYSIS_DIR, { recursive: true, mode: 0o700 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create cache directory ${CACHE_ANALYSIS_DIR}: ${errorMessage}`,
    );
  }
}

/**
 * Gets the cache file path for a given cache key.
 *
 * @param cacheKey - Cache key hash
 * @returns Full path to cache file
 */
function getCacheFilePath(cacheKey: string): string {
  return join(CACHE_ANALYSIS_DIR, `${cacheKey}.json`);
}

// =============================================================================
// Cache Key Generation
// =============================================================================

/**
 * Generates a SHA-256 hash of a string.
 *
 * @param input - String to hash
 * @returns Hex-encoded hash
 */
function hashString(input: string): string {
  return createHash('sha256').update(input, 'utf-8').digest('hex');
}

/**
 * Generates a cache key from prompts and model.
 * The cache key uniquely identifies a batch of prompts for a specific model.
 *
 * @param prompts - Array of prompt strings
 * @param model - Model identifier
 * @returns Cache key hash
 *
 * @example
 * ```typescript
 * const key = generateCacheKey(['prompt1', 'prompt2'], 'llama3.2');
 * // Returns: 'a3f2b1...' (SHA-256 hash)
 * ```
 */
export function generateCacheKey(
  prompts: readonly string[],
  model: string,
): string {
  const joined = prompts.join('\n---\n');
  const input = `${model}:${joined}`;
  return hashString(input);
}

/**
 * Hashes the system prompt for invalidation detection.
 * When the system prompt changes, all cache entries become invalid.
 *
 * @returns System prompt hash
 */
export function hashSystemPrompt(): string {
  return hashString(SYSTEM_PROMPT);
}

// =============================================================================
// Cache Metadata Management
// =============================================================================

/**
 * Loads the cache metadata file.
 *
 * @returns Metadata or null if not found
 */
async function loadCacheMetadata(): Promise<CacheMetadataFile | null> {
  if (!existsSync(CACHE_META_FILE)) {
    return null;
  }

  try {
    const content = await readFile(CACHE_META_FILE, 'utf-8');
    const metadata = JSON.parse(content) as CacheMetadataFile;
    return metadata;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to load cache metadata: ${errorMessage}`, 'cache');
    return null;
  }
}

/**
 * Saves the cache metadata file with atomic write.
 *
 * @param metadata - Metadata to save
 */
async function saveCacheMetadata(metadata: CacheMetadataFile): Promise<void> {
  try {
    await ensureCacheDir();

    const content = JSON.stringify(metadata, null, 2);

    // Atomic write using temp file
    const tmpFile = `${CACHE_META_FILE}.tmp`;
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, CACHE_META_FILE);

    logger.debug('Saved cache metadata', 'cache');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to save cache metadata: ${errorMessage}`, 'cache');
  }
}

/**
 * Validates that the system prompt has not changed.
 * If it has changed, clears the entire cache.
 *
 * @returns True if system prompt is valid, false if cache was invalidated
 */
export async function validateSystemPrompt(): Promise<boolean> {
  const currentHash = hashSystemPrompt();
  const metadata = await loadCacheMetadata();

  if (!metadata) {
    // First run - save current hash
    await saveCacheMetadata({
      systemPromptHash: currentHash,
      lastUpdated: Date.now(),
    });
    return true;
  }

  if (metadata.systemPromptHash !== currentHash) {
    logger.debug('System prompt changed - invalidating cache', 'cache');
    await clearCache();
    await saveCacheMetadata({
      systemPromptHash: currentHash,
      lastUpdated: Date.now(),
    });
    return false;
  }

  return true;
}

// =============================================================================
// Cache Operations
// =============================================================================

/**
 * Gets a cached result if it exists and is valid.
 * Returns null if cache miss or entry is invalid (expired, wrong model, etc).
 *
 * @param prompts - Array of prompt strings
 * @param model - Model identifier
 * @param options - Cache options
 * @returns Cached result or null
 */
export async function getCachedResult(
  prompts: readonly string[],
  model: string,
  options: CacheOptions = CACHE_DEFAULTS,
): Promise<AnalysisResult | null> {
  // Validate system prompt first
  await validateSystemPrompt();

  const cacheKey = generateCacheKey(prompts, model);
  const filePath = getCacheFilePath(cacheKey);

  if (!existsSync(filePath)) {
    logger.debug(`Cache miss for key ${cacheKey}`, 'cache');
    return null;
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as Partial<CachedBatchResult>;

    // Validate required fields exist
    if (!data.metadata || !data.result) {
      logger.debug(`Invalid cache entry for key ${cacheKey}`, 'cache');
      return null;
    }

    const cached = data as CachedBatchResult;

    // Check TTL
    const now = Date.now();
    const age = now - cached.metadata.cachedAt;
    if (age > options.ttlMs) {
      logger.debug(
        `Cache entry expired for key ${cacheKey} (age: ${String(age)}ms)`,
        'cache',
      );
      return null;
    }

    // Check model match
    if (cached.metadata.model !== model) {
      logger.debug(
        `Model mismatch for key ${cacheKey} (cached: ${cached.metadata.model}, requested: ${model})`,
        'cache',
      );
      return null;
    }

    // Check prompt count match
    if (cached.metadata.promptCount !== prompts.length) {
      logger.debug(`Prompt count mismatch for key ${cacheKey}`, 'cache');
      return null;
    }

    logger.debug(`Cache hit for key ${cacheKey}`, 'cache');
    return cached.result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(
      `Failed to read cache entry ${cacheKey}: ${errorMessage}`,
      'cache',
    );
    return null;
  }
}

/**
 * Stores an analysis result in the cache with atomic write.
 * Does not throw on failure - logs warning instead.
 *
 * @param prompts - Array of prompt strings
 * @param model - Model identifier
 * @param result - Analysis result to cache
 */
export async function setCachedResult(
  prompts: readonly string[],
  model: string,
  result: AnalysisResult,
): Promise<void> {
  try {
    await ensureCacheDir();
    await validateSystemPrompt();

    const cacheKey = generateCacheKey(prompts, model);
    const filePath = getCacheFilePath(cacheKey);

    const metadata: CacheMetadata = {
      cachedAt: Date.now(),
      promptCount: prompts.length,
      model,
      systemPromptHash: hashSystemPrompt(),
    };

    const cached: CachedBatchResult = {
      result,
      metadata,
    };

    const content = JSON.stringify(cached, null, 2);

    // Atomic write using temp file
    const tmpFile = `${filePath}.tmp`;
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, filePath);

    logger.debug(`Cached result for key ${cacheKey}`, 'cache');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to cache result: ${errorMessage}`, 'cache');
  }
}

/**
 * Clears all cached entries.
 * Removes the entire cache analysis directory.
 */
export async function clearCache(): Promise<void> {
  if (!existsSync(CACHE_ANALYSIS_DIR)) {
    logger.debug('Cache directory does not exist - nothing to clear', 'cache');
    return;
  }

  try {
    await rm(CACHE_ANALYSIS_DIR, { recursive: true, force: true });
    logger.debug('Cache cleared', 'cache');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to clear cache: ${errorMessage}`, 'cache');
  }
}

/**
 * Removes expired cache entries based on TTL.
 * Useful for periodic cleanup to prevent disk bloat.
 *
 * @param options - Cache options
 * @returns Number of entries removed
 */
export async function cleanupExpiredEntries(
  options: CacheOptions = CACHE_DEFAULTS,
): Promise<number> {
  if (!existsSync(CACHE_ANALYSIS_DIR)) {
    return 0;
  }

  try {
    const files = readdirSync(CACHE_ANALYSIS_DIR);
    const now = Date.now();
    let removedCount = 0;

    for (const file of files) {
      // Skip metadata file and non-JSON files
      if (!file.endsWith('.json') || file === '.metadata.json') {
        continue;
      }

      const filePath = join(CACHE_ANALYSIS_DIR, file);

      try {
        const content = await readFile(filePath, 'utf-8');
        const cached = JSON.parse(content) as CachedBatchResult;

        // Check if expired
        const age = now - cached.metadata.cachedAt;
        if (age > options.ttlMs) {
          await rm(filePath, { force: true });
          removedCount++;
          logger.debug(`Removed expired cache entry: ${file}`, 'cache');
        }
      } catch {
        // If we can't read or parse the file, remove it
        await rm(filePath, { force: true });
        removedCount++;
        logger.debug(`Removed invalid cache entry: ${file}`, 'cache');
      }
    }

    if (removedCount > 0) {
      logger.debug(
        `Cleanup removed ${String(removedCount)} expired entries`,
        'cache',
      );
    }

    return removedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to cleanup expired entries: ${errorMessage}`, 'cache');
    return 0;
  }
}
