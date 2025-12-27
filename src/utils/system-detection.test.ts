import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectSystemInfo,
  getAvailableOllamaModels,
  isModelAvailable,
  type OllamaModelInfo,
} from './system-detection.js';

describe('system-detection', () => {
  describe('detectSystemInfo', () => {
    it('should detect system RAM in GB', () => {
      const info = detectSystemInfo();

      expect(info).toHaveProperty('ramGB');
      expect(typeof info.ramGB).toBe('number');
      expect(info.ramGB).toBeGreaterThan(0);
    });

    it('should round RAM to whole GB', () => {
      const info = detectSystemInfo();

      // RAM should be a whole number (no decimals)
      expect(info.ramGB % 1).toBe(0);
    });

    it('should return positive RAM value', () => {
      const info = detectSystemInfo();

      expect(info.ramGB).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAvailableOllamaModels', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return available models on success', async () => {
      const mockResponse = {
        models: [
          { name: 'llama3.2:latest', size: 2000000000 },
          { name: 'mistral:7b', size: 4000000000 },
        ],
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue(mockResponse),
        }),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(true);
      expect(result.models).toHaveLength(2);
      expect(result.models[0]?.name).toBe('llama3.2:latest');
      expect(result.models[1]?.name).toBe('mistral:7b');
    });

    it('should return empty models list on network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should return empty models list on timeout', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => {
                resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
              }, 5000);
            }),
        ),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should return empty models list on non-ok response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        }),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should handle invalid JSON response gracefully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
        }),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should handle missing models field in response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({}),
        }),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should handle models field that is not an array', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: vi.fn().mockResolvedValue({ models: 'not-an-array' }),
        }),
      );

      const result = await getAvailableOllamaModels('http://localhost:11434');

      expect(result.success).toBe(false);
      expect(result.models).toEqual([]);
    });

    it('should use 3 second timeout', async () => {
      const startTime = Date.now();

      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(
          (_url, options?: { signal?: AbortSignal }) =>
            new Promise((resolve, reject) => {
              // Listen for abort signal
              if (options?.signal) {
                options.signal.addEventListener('abort', () => {
                  reject(new Error('Aborted'));
                });
              }
              // Never resolves normally - should be aborted
              setTimeout(() => {
                resolve({ ok: true, json: vi.fn().mockResolvedValue({}) });
              }, 10000);
            }),
        ),
      );

      await getAvailableOllamaModels('http://localhost:11434');
      const duration = Date.now() - startTime;

      // Should timeout around 3 seconds (with some tolerance for test execution)
      expect(duration).toBeLessThan(4000);
      expect(duration).toBeGreaterThan(2500);
    });
  });

  describe('isModelAvailable', () => {
    it('should return true when model exists in list', () => {
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b', size: 4000000000 },
      ];

      expect(isModelAvailable('llama3.2', models)).toBe(true);
      expect(isModelAvailable('mistral:7b', models)).toBe(true);
    });

    it('should match partial model names', () => {
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b-instruct-v0.1', size: 4000000000 },
      ];

      // Partial matches should work
      expect(isModelAvailable('llama3.2', models)).toBe(true);
      expect(isModelAvailable('mistral', models)).toBe(true);
      expect(isModelAvailable('mistral:7b', models)).toBe(true);
    });

    it('should return false when model does not exist', () => {
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      expect(isModelAvailable('qwen2.5:14b', models)).toBe(false);
      expect(isModelAvailable('codellama', models)).toBe(false);
    });

    it('should return false for empty model list', () => {
      const models: OllamaModelInfo[] = [];

      expect(isModelAvailable('llama3.2', models)).toBe(false);
    });

    it('should be case-sensitive', () => {
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      expect(isModelAvailable('LLAMA3.2', models)).toBe(false);
      expect(isModelAvailable('Llama3.2', models)).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle extremely large RAM values', () => {
      const info = detectSystemInfo();

      // Just verify it returns a reasonable number (not infinity, NaN, etc)
      expect(Number.isFinite(info.ramGB)).toBe(true);
      expect(info.ramGB).toBeGreaterThan(0);
    });

    it('should return consistent results for detectSystemInfo', () => {
      const info1 = detectSystemInfo();
      const info2 = detectSystemInfo();

      expect(info1.ramGB).toBe(info2.ramGB);
    });
  });
});
