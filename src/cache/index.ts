/**
 * Cache module exports.
 *
 * Provides disk-based caching for analysis results.
 */

export {
  generateCacheKey,
  hashSystemPrompt,
  validateSystemPrompt,
  getCachedResult,
  setCachedResult,
  clearCache,
  cleanupExpiredEntries,
} from './analysis-cache.js';
