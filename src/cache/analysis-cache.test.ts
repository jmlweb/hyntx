/**
 * Tests for disk-based cache system.
 */

import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AnalysisResult, CacheOptions } from '../types/index.js';

// Mock logger to prevent console output during tests
vi.mock('../utils/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Test cache directory (must be defined before mock)
const testCacheDir = join(process.cwd(), '.test-cache');

// Mock the paths module to use test directory
vi.mock('../utils/paths.js', () => ({
  CACHE_ANALYSIS_DIR: join(testCacheDir, 'analysis'),
  CACHE_META_FILE: join(testCacheDir, 'analysis', '.metadata.json'),
}));

// Import after mocks are set up
const {
  generateCacheKey,
  hashSystemPrompt,
  validateSystemPrompt,
  getCachedResult,
  setCachedResult,
  clearCache,
  cleanupExpiredEntries,
} = await import('./analysis-cache.js');

// Helper to create a mock analysis result
function createMockResult(date = '2025-01-15'): AnalysisResult {
  return {
    date,
    patterns: [
      {
        id: 'test-pattern',
        name: 'Test Pattern',
        frequency: 5,
        severity: 'medium',
        examples: ['example 1', 'example 2'],
        suggestion: 'Fix this issue',
        beforeAfter: {
          before: 'bad code',
          after: 'good code',
        },
      },
    ],
    stats: {
      totalPrompts: 10,
      promptsWithIssues: 5,
      overallScore: 75,
    },
    topSuggestion: 'Fix this issue',
  };
}

describe('analysis-cache', () => {
  beforeEach(async () => {
    // Clean up test cache directory before each test
    if (existsSync(testCacheDir)) {
      await rm(testCacheDir, { recursive: true, force: true });
    }
    await mkdir(testCacheDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test cache directory after each test
    if (existsSync(testCacheDir)) {
      await rm(testCacheDir, { recursive: true, force: true });
    }
  });

  describe('generateCacheKey', () => {
    it('generates consistent keys for same input', () => {
      const prompts = ['prompt1', 'prompt2'];
      const model = 'llama3.2';

      const key1 = generateCacheKey(prompts, model);
      const key2 = generateCacheKey(prompts, model);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('generates different keys for different prompts', () => {
      const model = 'llama3.2';

      const key1 = generateCacheKey(['prompt1'], model);
      const key2 = generateCacheKey(['prompt2'], model);

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different models', () => {
      const prompts = ['prompt1'];

      const key1 = generateCacheKey(prompts, 'llama3.2');
      const key2 = generateCacheKey(prompts, 'gemini');

      expect(key1).not.toBe(key2);
    });

    it('generates different keys for different prompt order', () => {
      const model = 'llama3.2';

      const key1 = generateCacheKey(['prompt1', 'prompt2'], model);
      const key2 = generateCacheKey(['prompt2', 'prompt1'], model);

      expect(key1).not.toBe(key2);
    });
  });

  describe('hashSystemPrompt', () => {
    it('generates consistent hash', () => {
      const hash1 = hashSystemPrompt();
      const hash2 = hashSystemPrompt();

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });
  });

  describe('validateSystemPrompt', () => {
    it('returns true on first run', async () => {
      const result = await validateSystemPrompt();
      expect(result).toBe(true);
    });

    it('returns true when system prompt unchanged', async () => {
      await validateSystemPrompt(); // First run
      const result = await validateSystemPrompt(); // Second run
      expect(result).toBe(true);
    });

    it('clears cache when system prompt changes', async () => {
      // First validation creates metadata
      await validateSystemPrompt();

      // Store a cache entry
      const prompts = ['test prompt'];
      const model = 'llama3.2';
      const result = createMockResult();
      await setCachedResult(prompts, model, result);

      // Verify cache exists
      const cached1 = await getCachedResult(prompts, model);
      expect(cached1).not.toBeNull();

      // Mock a system prompt change by manually updating metadata
      const { CACHE_META_FILE } = await import('../utils/paths.js');
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        CACHE_META_FILE,
        JSON.stringify({
          systemPromptHash: 'different-hash',
          lastUpdated: Date.now(),
        }),
        'utf-8',
      );

      // Validate should detect change and clear cache
      const result2 = await validateSystemPrompt();
      expect(result2).toBe(false);

      // Cache should be cleared
      const cached2 = await getCachedResult(prompts, model);
      expect(cached2).toBeNull();
    });
  });

  describe('getCachedResult', () => {
    it('returns null when cache is empty', async () => {
      const result = await getCachedResult(['prompt1'], 'llama3.2');
      expect(result).toBeNull();
    });

    it('returns cached result when available', async () => {
      const prompts = ['prompt1', 'prompt2'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts, model, mockResult);
      const cached = await getCachedResult(prompts, model);

      expect(cached).not.toBeNull();
      expect(cached?.patterns).toHaveLength(1);
      expect(cached?.stats.overallScore).toBe(75);
    });

    it('returns null when cache is expired', async () => {
      const prompts = ['prompt1'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts, model, mockResult);

      // Use very short TTL to force expiration
      const options: CacheOptions = { ttlMs: 1 }; // 1ms TTL
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for expiration

      const cached = await getCachedResult(prompts, model, options);
      expect(cached).toBeNull();
    });

    it('returns null when model does not match', async () => {
      const prompts = ['prompt1'];
      const mockResult = createMockResult();

      await setCachedResult(prompts, 'llama3.2', mockResult);
      const cached = await getCachedResult(prompts, 'gemini');

      expect(cached).toBeNull();
    });

    it('returns null when prompt count does not match', async () => {
      const mockResult = createMockResult();

      await setCachedResult(['prompt1', 'prompt2'], 'llama3.2', mockResult);
      const cached = await getCachedResult(['prompt1'], 'llama3.2');

      expect(cached).toBeNull();
    });
  });

  describe('setCachedResult', () => {
    it('stores result in cache', async () => {
      const prompts = ['prompt1'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts, model, mockResult);
      const cached = await getCachedResult(prompts, model);

      expect(cached).not.toBeNull();
      expect(cached?.date).toBe('2025-01-15');
    });

    it('overwrites existing cache entry', async () => {
      const prompts = ['prompt1'];
      const model = 'llama3.2';
      const result1 = createMockResult('2025-01-15');
      const result2 = createMockResult('2025-01-16');

      await setCachedResult(prompts, model, result1);
      await setCachedResult(prompts, model, result2);

      const cached = await getCachedResult(prompts, model);
      expect(cached?.date).toBe('2025-01-16');
    });

    it('stores metadata with result', async () => {
      const prompts = ['prompt1', 'prompt2'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts, model, mockResult);

      // Read the cache file directly to verify metadata
      const { CACHE_ANALYSIS_DIR } = await import('../utils/paths.js');
      const cacheKey = generateCacheKey(prompts, model);
      const filePath = join(CACHE_ANALYSIS_DIR, `${cacheKey}.json`);
      const { readFile } = await import('node:fs/promises');
      const content = await readFile(filePath, 'utf-8');
      const cached = JSON.parse(content) as {
        result: AnalysisResult;
        metadata: { model: string; promptCount: number };
      };

      expect(cached.metadata.model).toBe('llama3.2');
      expect(cached.metadata.promptCount).toBe(2);
    });
  });

  describe('clearCache', () => {
    it('removes all cache entries', async () => {
      const prompts1 = ['prompt1'];
      const prompts2 = ['prompt2'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts1, model, mockResult);
      await setCachedResult(prompts2, model, mockResult);

      // Verify both exist
      expect(await getCachedResult(prompts1, model)).not.toBeNull();
      expect(await getCachedResult(prompts2, model)).not.toBeNull();

      await clearCache();

      // Verify both removed
      expect(await getCachedResult(prompts1, model)).toBeNull();
      expect(await getCachedResult(prompts2, model)).toBeNull();
    });

    it('does not throw when cache is already empty', async () => {
      await expect(clearCache()).resolves.not.toThrow();
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('removes expired entries only', async () => {
      const prompts1 = ['prompt1'];
      const prompts2 = ['prompt2'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts1, model, mockResult);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      await setCachedResult(prompts2, model, mockResult);

      // Cleanup with very short TTL (should remove first entry)
      const options: CacheOptions = { ttlMs: 5 };
      const removed = await cleanupExpiredEntries(options);

      expect(removed).toBe(1);
      expect(await getCachedResult(prompts1, model)).toBeNull();
      expect(await getCachedResult(prompts2, model)).not.toBeNull();
    });

    it('returns 0 when no entries are expired', async () => {
      const prompts = ['prompt1'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      await setCachedResult(prompts, model, mockResult);

      // Use very long TTL
      const options: CacheOptions = { ttlMs: 1000000 };
      const removed = await cleanupExpiredEntries(options);

      expect(removed).toBe(0);
      expect(await getCachedResult(prompts, model)).not.toBeNull();
    });

    it('returns 0 when cache is empty', async () => {
      const removed = await cleanupExpiredEntries();
      expect(removed).toBe(0);
    });
  });

  describe('integration', () => {
    it('full cache lifecycle works correctly', async () => {
      const prompts = ['prompt1', 'prompt2'];
      const model = 'llama3.2';
      const mockResult = createMockResult();

      // Cache miss
      const miss = await getCachedResult(prompts, model);
      expect(miss).toBeNull();

      // Store result
      await setCachedResult(prompts, model, mockResult);

      // Cache hit
      const hit = await getCachedResult(prompts, model);
      expect(hit).not.toBeNull();
      expect(hit?.stats.overallScore).toBe(75);

      // Clear cache
      await clearCache();

      // Cache miss again
      const miss2 = await getCachedResult(prompts, model);
      expect(miss2).toBeNull();
    });
  });
});
