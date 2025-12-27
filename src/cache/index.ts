/**
 * Cache module exports.
 *
 * Provides disk-based caching for analysis results.
 */

export {
  cleanupExpiredEntries,
  clearCache,
  generateCacheKey,
  getCachedResult,
  hashSystemPrompt,
  setCachedResult,
  validateSystemPrompt,
} from './analysis-cache.js';
