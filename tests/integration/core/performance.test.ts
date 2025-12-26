/**
 * Performance benchmarks for incremental analysis.
 *
 * Tests performance characteristics of the incremental results cache:
 * - Load 100 cached results in < 500ms
 * - Handle 1000+ result files without degradation
 * - Use < 50MB memory for 1000 cached results
 *
 * These tests validate performance acceptance criteria from issue #53.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  cleanupTempDir,
  createTempDir,
  createUserMessage,
  generatePerformanceTestData,
  populateResultsCache,
} from '../../helpers/test-utils.js';

describe('Performance - Incremental Analysis', () => {
  let tempDir: string;
  let resultsDir: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    tempDir = createTempDir();
    resultsDir = `${tempDir}/results`;
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    process.env = originalEnv;
  });

  describe('Cache Loading Performance', () => {
    it('should load 100 cached results in < 500ms', async () => {
      // Pre-populate cache with 100 results
      const testData = generatePerformanceTestData(100);

      await populateResultsCache(resultsDir, testData, {
        date: '2025-01-20',
        project: 'perf-test',
        model: 'llama3.2',
        schemaType: 'full',
      });

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      // Create prompts array for cache lookup
      const prompts = testData.map((item, i) => ({
        content: item.content,
        timestamp: `2025-01-20T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
        sessionId: 'test-session',
        project: 'perf-test',
        date: '2025-01-20',
      }));

      // Measure cache lookup time
      const startTime = Date.now();
      const cacheCheck = await getPromptsWithCache(prompts, 'llama3.2', 'full');
      const loadTime = Date.now() - startTime;

      expect(cacheCheck.cached.size).toBe(100);
      expect(cacheCheck.toAnalyze).toHaveLength(0);
      expect(loadTime).toBeLessThan(500);

      // Log actual performance for reference
      console.log(`Loaded 100 cached results in ${loadTime}ms`);
    });

    it('should handle 1000+ result files without degradation', async () => {
      // Pre-populate cache with 1000 results
      const testData = generatePerformanceTestData(1000);

      console.log('Populating cache with 1000 results...');
      const populateStart = Date.now();
      await populateResultsCache(resultsDir, testData, {
        date: '2025-01-20',
        project: 'perf-test',
        model: 'llama3.2',
        schemaType: 'full',
      });
      const populateTime = Date.now() - populateStart;
      console.log(`Cache population took ${populateTime}ms`);

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      // Test loading different batch sizes
      const batchSizes = [100, 500, 1000];
      const loadTimes: Record<number, number> = {};

      for (const batchSize of batchSizes) {
        const prompts = testData.slice(0, batchSize).map((item, i) => ({
          content: item.content,
          timestamp: `2025-01-20T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
          sessionId: 'test-session',
          project: 'perf-test',
          date: '2025-01-20',
        }));

        const startTime = Date.now();
        const cacheCheck = await getPromptsWithCache(
          prompts,
          'llama3.2',
          'full',
        );
        const loadTime = Date.now() - startTime;

        loadTimes[batchSize] = loadTime;

        expect(cacheCheck.cached.size).toBe(batchSize);
        expect(cacheCheck.toAnalyze).toHaveLength(0);

        console.log(`Loaded ${batchSize} cached results in ${loadTime}ms`);
      }

      // Verify no significant degradation
      // 1000 results should not take more than 15x longer than 100
      const ratio = loadTimes[1000]! / loadTimes[100]!;
      expect(ratio).toBeLessThan(15);

      // 1000 results should load in reasonable time (< 5 seconds)
      expect(loadTimes[1000]).toBeLessThan(5000);
    });

    it('should efficiently handle partial cache hits with large cache', async () => {
      // Pre-populate cache with 500 results
      const cachedData = generatePerformanceTestData(500);
      await populateResultsCache(resultsDir, cachedData, {
        date: '2025-01-20',
        model: 'llama3.2',
        schemaType: 'full',
      });

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      // Create mix of cached and new prompts
      const mixedPrompts = [
        // First 250 are cached
        ...cachedData.slice(0, 250).map((item, i) => ({
          content: item.content,
          timestamp: `2025-01-20T10:${String(i % 60).padStart(2, '0')}:00.000Z`,
          sessionId: 'test-session',
          project: 'perf-test',
          date: '2025-01-20',
        })),
        // Next 250 are new
        ...Array.from({ length: 250 }, (_, i) => ({
          content: `New prompt ${i} with some realistic content`,
          timestamp: `2025-01-20T11:${String(i % 60).padStart(2, '0')}:00.000Z`,
          sessionId: 'test-session',
          project: 'perf-test',
          date: '2025-01-20',
        })),
      ];

      const startTime = Date.now();
      const cacheCheck = await getPromptsWithCache(
        mixedPrompts,
        'llama3.2',
        'full',
      );
      const loadTime = Date.now() - startTime;

      expect(cacheCheck.cached.size).toBe(250);
      expect(cacheCheck.toAnalyze).toHaveLength(250);
      expect(loadTime).toBeLessThan(1000); // Should still be fast

      console.log(`Mixed cache check (250/250) took ${loadTime}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should use < 50MB memory for 1000 cached results', async () => {
      // Note: This is a best-effort test since Node.js memory measurement
      // is not perfectly accurate and varies by runtime conditions

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Get baseline memory usage
      const baselineMemory = process.memoryUsage();

      // Pre-populate cache with 1000 results
      const testData = generatePerformanceTestData(1000);

      await populateResultsCache(resultsDir, testData, {
        date: '2025-01-20',
        project: 'perf-test',
        model: 'llama3.2',
        schemaType: 'full',
      });

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      const prompts = testData.map((item, i) => ({
        content: item.content,
        timestamp: `2025-01-20T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
        sessionId: 'test-session',
        project: 'perf-test',
        date: '2025-01-20',
      }));

      // Load all cached results
      const cacheCheck = await getPromptsWithCache(prompts, 'llama3.2', 'full');

      // Force garbage collection again if available
      if (global.gc) {
        global.gc();
      }

      // Get memory usage after loading cache
      const afterLoadMemory = process.memoryUsage();

      expect(cacheCheck.cached.size).toBe(1000);

      // Calculate memory delta (in MB)
      const heapDelta =
        (afterLoadMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024;

      console.log(
        `Memory usage for 1000 cached results: ${heapDelta.toFixed(2)}MB`,
      );
      console.log(
        `Baseline heap: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      );
      console.log(
        `After load heap: ${(afterLoadMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`,
      );

      // This is a soft limit - actual memory usage may vary
      // We mainly want to ensure no memory leaks or excessive usage
      expect(heapDelta).toBeLessThan(50);
    });

    it('should not leak memory on repeated cache operations', async () => {
      // Pre-populate cache with 100 results
      const testData = generatePerformanceTestData(100);

      await populateResultsCache(resultsDir, testData, {
        date: '2025-01-20',
        project: 'perf-test',
        model: 'llama3.2',
        schemaType: 'full',
      });

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      const prompts = testData.map((item, i) => ({
        content: item.content,
        timestamp: `2025-01-20T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
        sessionId: 'test-session',
        project: 'perf-test',
        date: '2025-01-20',
      }));

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Get baseline memory
      const baselineMemory = process.memoryUsage().heapUsed;

      // Perform multiple cache lookups
      for (let i = 0; i < 10; i++) {
        await getPromptsWithCache(prompts, 'llama3.2', 'full');
      }

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      // Get final memory
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = (finalMemory - baselineMemory) / 1024 / 1024;

      console.log(
        `Memory delta after 10 iterations: ${memoryDelta.toFixed(2)}MB`,
      );

      // Memory should not grow significantly (allow 10MB for variance)
      expect(memoryDelta).toBeLessThan(10);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent cache reads efficiently', async () => {
      // Pre-populate cache with 200 results
      const testData = generatePerformanceTestData(200);

      await populateResultsCache(resultsDir, testData, {
        date: '2025-01-20',
        project: 'perf-test',
        model: 'llama3.2',
        schemaType: 'full',
      });

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      // Create 5 batches of 40 prompts each
      const batches = Array.from({ length: 5 }, (_, batchIdx) =>
        testData.slice(batchIdx * 40, (batchIdx + 1) * 40).map((item, i) => ({
          content: item.content,
          timestamp: `2025-01-20T${String(10 + batchIdx)}:${String(i % 60).padStart(2, '0')}:00.000Z`,
          sessionId: 'test-session',
          project: 'perf-test',
          date: '2025-01-20',
        })),
      );

      // Read all batches concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        batches.map((batch) => getPromptsWithCache(batch, 'llama3.2', 'full')),
      );
      const totalTime = Date.now() - startTime;

      // Verify all results
      for (const result of results) {
        expect(result.cached.size).toBe(40);
        expect(result.toAnalyze).toHaveLength(0);
      }

      // Concurrent reads should be faster than sequential
      // (This is a soft check - mainly ensuring no errors)
      expect(totalTime).toBeLessThan(2000);

      console.log(`5 concurrent batches (40 each) loaded in ${totalTime}ms`);
    });

    it('should handle concurrent cache writes safely', async () => {
      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { savePromptResult } =
        await import('../../../src/core/results-storage.js');

      const { createMinimalAnalysis } =
        await import('../../helpers/test-utils.js');

      // Create 50 prompts to save concurrently
      const prompts = Array.from({ length: 50 }, (_, i) => ({
        content: `Concurrent prompt ${i}`,
        result: createMinimalAnalysis(),
      }));

      const startTime = Date.now();

      // Save all prompts concurrently
      await Promise.all(
        prompts.map(({ content, result }) =>
          savePromptResult(
            content,
            { ...result, date: '2025-01-20' },
            {
              date: '2025-01-20',
              project: 'perf-test',
              provider: 'test-provider',
              model: 'llama3.2',
              schemaType: 'full',
            },
          ),
        ),
      );

      const saveTime = Date.now() - startTime;

      console.log(`50 concurrent saves completed in ${saveTime}ms`);

      // Verify all saves completed (no errors thrown)
      // and files were written correctly
      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      const promptsToCheck = prompts.map((item, i) => ({
        content: item.content,
        timestamp: `2025-01-20T10:${String(i % 60).padStart(2, '0')}:00.000Z`,
        sessionId: 'test-session',
        project: 'perf-test',
        date: '2025-01-20',
      }));

      const cacheCheck = await getPromptsWithCache(
        promptsToCheck,
        'llama3.2',
        'full',
      );

      expect(cacheCheck.cached.size).toBe(50);
    });
  });

  describe('Disk I/O Performance', () => {
    it('should efficiently read from date-partitioned directories', async () => {
      // Pre-populate cache across multiple dates
      const dates = ['2025-01-18', '2025-01-19', '2025-01-20'];

      for (const date of dates) {
        const testData = generatePerformanceTestData(100, date);
        await populateResultsCache(resultsDir, testData, {
          date,
          model: 'llama3.2',
          schemaType: 'full',
        });
      }

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { getPromptsWithCache } =
        await import('../../../src/core/results-storage.js');

      // Read from a specific date
      const testData = generatePerformanceTestData(100, '2025-01-20');
      const prompts = testData.map((item, i) => ({
        content: item.content,
        timestamp: `2025-01-20T${String(10 + Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
        sessionId: 'test-session',
        project: 'perf-test',
        date: '2025-01-20',
      }));

      const startTime = Date.now();
      const cacheCheck = await getPromptsWithCache(prompts, 'llama3.2', 'full');
      const loadTime = Date.now() - startTime;

      expect(cacheCheck.cached.size).toBe(100);
      expect(loadTime).toBeLessThan(500);

      console.log(`Read 100 results from partitioned cache in ${loadTime}ms`);
    });

    it('should handle cache cleanup efficiently', async () => {
      // Pre-populate cache with old dates
      const oldDates = [
        '2025-01-01',
        '2025-01-02',
        '2025-01-03',
        '2025-01-04',
        '2025-01-05',
      ];

      for (const date of oldDates) {
        const testData = generatePerformanceTestData(50, date);
        await populateResultsCache(resultsDir, testData, {
          date,
          model: 'llama3.2',
          schemaType: 'full',
        });
      }

      process.env['HYNTX_RESULTS_DIR'] = resultsDir;

      const { cleanupResults } =
        await import('../../../src/core/results-storage.js');

      // Cleanup results before 2025-01-04
      const startTime = Date.now();
      const deletedCount = await cleanupResults('2025-01-04');
      const cleanupTime = Date.now() - startTime;

      expect(deletedCount).toBe(3); // Should delete 01, 02, 03
      expect(cleanupTime).toBeLessThan(1000);

      console.log(
        `Cleanup of ${deletedCount} date directories took ${cleanupTime}ms`,
      );
    });
  });
});
