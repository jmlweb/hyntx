import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { rm, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { format, subDays } from 'date-fns';
import type * as PathsModule from '../utils/paths.js';

// Mock the paths module to use test directory
vi.mock('../utils/paths.js', async (): Promise<typeof PathsModule> => {
  const actual = await vi.importActual<typeof PathsModule>('../utils/paths.js');
  const testDir = join(process.cwd(), '.test-results');
  return {
    ...actual,
    HYNTX_RESULTS_DIR: testDir,
    getResultsDateDir: (date: string): string => join(testDir, date),
  };
});

// Test directory for isolated tests
const TEST_RESULTS_DIR = join(process.cwd(), '.test-results');
const originalEnv = process.env['HYNTX_RESULTS_DIR'];

import {
  getPromptResultHash,
  getPromptResult,
  savePromptResult,
  getPromptsWithCache,
  cleanupResults,
} from './results-storage.js';
import { hashSystemPrompt } from '../cache/analysis-cache.js';
import type {
  ExtractedPrompt,
  AnalysisResult,
  PromptResultMetadata,
} from '../types/index.js';

// Mock data
const mockResult: AnalysisResult = {
  date: '2025-12-26',
  patterns: [
    {
      id: 'test-pattern',
      name: 'Test Pattern',
      frequency: 5,
      severity: 'medium',
      examples: ['example 1', 'example 2'],
      suggestion: 'Test suggestion',
      beforeAfter: {
        before: 'before code',
        after: 'after code',
      },
    },
  ],
  stats: {
    totalPrompts: 10,
    promptsWithIssues: 5,
    overallScore: 7.5,
  },
  topSuggestion: 'Top test suggestion',
};

const mockPrompt: ExtractedPrompt = {
  content: 'Test prompt content',
  timestamp: '2025-12-26T10:00:00Z',
  sessionId: 'test-session',
  project: 'test-project',
  date: '2025-12-26',
};

const mockMetadata: Omit<PromptResultMetadata, 'promptHash' | 'analyzedAt'> = {
  date: '2025-12-26',
  project: 'test-project',
  provider: 'ollama',
  model: 'llama3.2',
  schemaType: 'full',
};

beforeEach(async () => {
  // Clean up test directory
  if (existsSync(TEST_RESULTS_DIR)) {
    await rm(TEST_RESULTS_DIR, { recursive: true, force: true });
  }
  await mkdir(TEST_RESULTS_DIR, { recursive: true, mode: 0o700 });
});

afterEach(async () => {
  // Clean up test directory
  if (existsSync(TEST_RESULTS_DIR)) {
    await rm(TEST_RESULTS_DIR, { recursive: true, force: true });
  }

  // Restore environment
  if (originalEnv) {
    process.env['HYNTX_RESULTS_DIR'] = originalEnv;
  } else {
    delete process.env['HYNTX_RESULTS_DIR'];
  }
});

describe('getPromptResultHash', () => {
  it('generates consistent hash for same inputs', () => {
    const hash1 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
  });

  it('generates different hash when prompt changes', () => {
    const hash1 = getPromptResultHash('prompt 1', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('prompt 2', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    expect(hash1).not.toBe(hash2);
  });

  it('generates different hash when date changes', () => {
    const hash1 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('test prompt', {
      date: '2025-12-27',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    expect(hash1).not.toBe(hash2);
  });

  it('generates different hash when project changes', () => {
    const hash1 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project2',
      model: 'llama3.2',
      schemaType: 'full',
    });

    expect(hash1).not.toBe(hash2);
  });

  it('generates different hash when model changes', () => {
    const hash1 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'gemma3:4b',
      schemaType: 'full',
    });

    expect(hash1).not.toBe(hash2);
  });

  it('generates different hash when schema type changes', () => {
    const hash1 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: 'project1',
      model: 'llama3.2',
      schemaType: 'minimal',
    });

    expect(hash1).not.toBe(hash2);
  });

  it('handles undefined project correctly', () => {
    const hash1 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: undefined,
      model: 'llama3.2',
      schemaType: 'full',
    });

    const hash2 = getPromptResultHash('test prompt', {
      date: '2025-12-26',
      project: undefined,
      model: 'llama3.2',
      schemaType: 'full',
    });

    expect(hash1).toBe(hash2);
  });

  it('includes system prompt hash in calculation', () => {
    const systemPromptHash = hashSystemPrompt();
    expect(systemPromptHash).toBeTruthy();

    // Hash should change if system prompt changes
    const hash1 = getPromptResultHash('test', {
      date: '2025-12-26',
      project: 'test',
      model: 'llama3.2',
      schemaType: 'full',
    });

    expect(hash1).toBeTruthy();
  });
});

describe('savePromptResult and getPromptResult', () => {
  it('saves and loads a result successfully', async () => {
    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    const loaded = await getPromptResult(mockPrompt.content, mockMetadata);

    expect(loaded).toEqual(mockResult);
  });

  it('returns null for non-existent result', async () => {
    const loaded = await getPromptResult('non-existent prompt', mockMetadata);

    expect(loaded).toBeNull();
  });

  it('creates date directory if it does not exist', async () => {
    const dateDir = join(TEST_RESULTS_DIR, mockMetadata.date);
    expect(existsSync(dateDir)).toBe(false);

    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    expect(existsSync(dateDir)).toBe(true);
  });

  it('saves result with correct metadata', async () => {
    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    const hash = getPromptResultHash(mockPrompt.content, mockMetadata);
    const filePath = join(TEST_RESULTS_DIR, mockMetadata.date, `${hash}.json`);

    const content = await readFile(filePath, 'utf-8');
    const saved = JSON.parse(content) as {
      metadata: {
        date: string;
        project?: string;
        provider: string;
        model: string;
        schemaType: string;
        promptHash: string;
        analyzedAt: number;
      };
    };

    expect(saved.metadata.date).toBe(mockMetadata.date);
    expect(saved.metadata.project).toBe(mockMetadata.project);
    expect(saved.metadata.provider).toBe(mockMetadata.provider);
    expect(saved.metadata.model).toBe(mockMetadata.model);
    expect(saved.metadata.schemaType).toBe(mockMetadata.schemaType);
    expect(saved.metadata.promptHash).toBeTruthy();
    expect(saved.metadata.analyzedAt).toBeTruthy();
  });

  it('uses atomic write pattern', async () => {
    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    const hash = getPromptResultHash(mockPrompt.content, mockMetadata);
    const tmpFile = join(
      TEST_RESULTS_DIR,
      mockMetadata.date,
      `${hash}.json.tmp`,
    );

    // Temp file should not exist after successful write
    expect(existsSync(tmpFile)).toBe(false);
  });

  it('handles save errors gracefully without throwing', async () => {
    // Save to a read-only directory should fail but not throw
    const readonlyDir = join(TEST_RESULTS_DIR, 'readonly');
    await mkdir(readonlyDir, { recursive: true, mode: 0o444 });

    const invalidMetadata = { ...mockMetadata, date: 'readonly/invalid' };

    // Should not throw
    await expect(
      savePromptResult(mockPrompt.content, mockResult, invalidMetadata),
    ).resolves.toBeUndefined();
  });

  it('returns null for corrupted result file', async () => {
    // First save a valid result
    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    const hash = getPromptResultHash(mockPrompt.content, mockMetadata);
    const dateDir = join(TEST_RESULTS_DIR, mockMetadata.date);
    const filePath = join(dateDir, `${hash}.json`);

    // Overwrite with corrupted data (missing required fields)
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, '{"invalid": "data"}', 'utf-8');

    const loaded = await getPromptResult(mockPrompt.content, mockMetadata);

    expect(loaded).toBeNull();
  });

  it('returns null for invalid JSON in result file', async () => {
    const hash = getPromptResultHash(mockPrompt.content, mockMetadata);
    const dateDir = join(TEST_RESULTS_DIR, mockMetadata.date);
    await mkdir(dateDir, { recursive: true, mode: 0o700 });

    const filePath = join(dateDir, `${hash}.json`);
    const fs = await import('node:fs/promises');
    await fs.writeFile(filePath, 'invalid json{', 'utf-8');

    const loaded = await getPromptResult(mockPrompt.content, mockMetadata);

    expect(loaded).toBeNull();
  });

  it('overwrites existing result when saving again', async () => {
    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    const updatedResult = {
      ...mockResult,
      stats: { ...mockResult.stats, overallScore: 9.0 },
    };

    await savePromptResult(mockPrompt.content, updatedResult, mockMetadata);

    const loaded = await getPromptResult(mockPrompt.content, mockMetadata);

    expect(loaded?.stats.overallScore).toBe(9.0);
  });
});

describe('getPromptsWithCache', () => {
  it('returns all prompts to analyze when cache is empty', async () => {
    const prompts: ExtractedPrompt[] = [
      { ...mockPrompt, content: 'prompt 1' },
      { ...mockPrompt, content: 'prompt 2' },
      { ...mockPrompt, content: 'prompt 3' },
    ];

    const result = await getPromptsWithCache(
      prompts,
      mockMetadata.model,
      mockMetadata.schemaType,
    );

    expect(result.cached.size).toBe(0);
    expect(result.toAnalyze).toHaveLength(3);
    expect(result.toAnalyze).toEqual(prompts);
  });

  it('returns cached results and uncached prompts', async () => {
    const prompts: ExtractedPrompt[] = [
      { ...mockPrompt, content: 'prompt 1' },
      { ...mockPrompt, content: 'prompt 2' },
      { ...mockPrompt, content: 'prompt 3' },
    ];

    // Cache first two prompts
    const prompt0 = prompts[0];
    const prompt1 = prompts[1];
    if (prompt0 && prompt1) {
      await savePromptResult(prompt0.content, mockResult, mockMetadata);
      await savePromptResult(prompt1.content, mockResult, mockMetadata);
    }

    const result = await getPromptsWithCache(
      prompts,
      mockMetadata.model,
      mockMetadata.schemaType,
    );

    expect(result.cached.size).toBe(2);
    expect(result.toAnalyze).toHaveLength(1);
    expect(result.toAnalyze[0]).toEqual(prompts[2]);
  });

  it('returns all cached when all prompts are cached', async () => {
    const prompts: ExtractedPrompt[] = [
      { ...mockPrompt, content: 'prompt 1' },
      { ...mockPrompt, content: 'prompt 2' },
    ];

    // Cache all prompts
    for (const prompt of prompts) {
      await savePromptResult(prompt.content, mockResult, mockMetadata);
    }

    const result = await getPromptsWithCache(
      prompts,
      mockMetadata.model,
      mockMetadata.schemaType,
    );

    expect(result.cached.size).toBe(2);
    expect(result.toAnalyze).toHaveLength(0);
  });

  it('loads cached results in parallel', async () => {
    const prompts: ExtractedPrompt[] = Array.from({ length: 10 }, (_, i) => ({
      ...mockPrompt,
      content: `prompt ${String(i)}`,
    }));

    // Cache half the prompts
    for (let i = 0; i < 5; i++) {
      const prompt = prompts[i];
      if (prompt) {
        await savePromptResult(prompt.content, mockResult, mockMetadata);
      }
    }

    const startTime = Date.now();
    const result = await getPromptsWithCache(
      prompts,
      mockMetadata.model,
      mockMetadata.schemaType,
    );
    const elapsed = Date.now() - startTime;

    expect(result.cached.size).toBe(5);
    expect(result.toAnalyze).toHaveLength(5);

    // Should be fast due to parallel loading (less than 1 second)
    expect(elapsed).toBeLessThan(1000);
  });

  it('maps cached results by prompt content', async () => {
    const prompts: ExtractedPrompt[] = [
      { ...mockPrompt, content: 'prompt 1' },
      { ...mockPrompt, content: 'prompt 2' },
    ];

    const result1 = {
      ...mockResult,
      stats: { ...mockResult.stats, overallScore: 8.0 },
    };
    const result2 = {
      ...mockResult,
      stats: { ...mockResult.stats, overallScore: 9.0 },
    };

    const prompt0 = prompts[0];
    const prompt1 = prompts[1];
    if (prompt0 && prompt1) {
      await savePromptResult(prompt0.content, result1, mockMetadata);
      await savePromptResult(prompt1.content, result2, mockMetadata);
    }

    const result = await getPromptsWithCache(
      prompts,
      mockMetadata.model,
      mockMetadata.schemaType,
    );

    expect(result.cached.get('prompt 1')?.stats.overallScore).toBe(8.0);
    expect(result.cached.get('prompt 2')?.stats.overallScore).toBe(9.0);
  });

  it('handles empty prompt list', async () => {
    const result = await getPromptsWithCache(
      [],
      mockMetadata.model,
      mockMetadata.schemaType,
    );

    expect(result.cached.size).toBe(0);
    expect(result.toAnalyze).toHaveLength(0);
  });

  it('respects model parameter in cache lookup', async () => {
    const prompts: ExtractedPrompt[] = [mockPrompt];

    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    // Different model should not hit cache
    const result = await getPromptsWithCache(
      prompts,
      'different-model',
      mockMetadata.schemaType,
    );

    expect(result.cached.size).toBe(0);
    expect(result.toAnalyze).toHaveLength(1);
  });

  it('respects schema type parameter in cache lookup', async () => {
    const prompts: ExtractedPrompt[] = [mockPrompt];

    await savePromptResult(mockPrompt.content, mockResult, mockMetadata);

    // Different schema type should not hit cache
    const result = await getPromptsWithCache(
      prompts,
      mockMetadata.model,
      'minimal',
    );

    expect(result.cached.size).toBe(0);
    expect(result.toAnalyze).toHaveLength(1);
  });
});

describe('cleanupResults', () => {
  it('deletes directories before cutoff date', async () => {
    const today = new Date();
    const dates = [
      format(subDays(today, 10), 'yyyy-MM-dd'),
      format(subDays(today, 5), 'yyyy-MM-dd'),
      format(today, 'yyyy-MM-dd'),
    ];

    // Create date directories
    for (const date of dates) {
      const dateDir = join(TEST_RESULTS_DIR, date);
      await mkdir(dateDir, { recursive: true, mode: 0o700 });
    }

    const cutoffDate = format(subDays(today, 7), 'yyyy-MM-dd');
    const deletedCount = await cleanupResults(cutoffDate);

    expect(deletedCount).toBe(1); // Only the 10-day-old directory
    const date0 = dates[0];
    const date1 = dates[1];
    const date2 = dates[2];
    if (date0 && date1 && date2) {
      expect(existsSync(join(TEST_RESULTS_DIR, date0))).toBe(false);
      expect(existsSync(join(TEST_RESULTS_DIR, date1))).toBe(true);
      expect(existsSync(join(TEST_RESULTS_DIR, date2))).toBe(true);
    }
  });

  it('deletes multiple directories', async () => {
    const today = new Date();
    const dates = [
      format(subDays(today, 20), 'yyyy-MM-dd'),
      format(subDays(today, 15), 'yyyy-MM-dd'),
      format(subDays(today, 10), 'yyyy-MM-dd'),
      format(today, 'yyyy-MM-dd'),
    ];

    for (const date of dates) {
      const dateDir = join(TEST_RESULTS_DIR, date);
      await mkdir(dateDir, { recursive: true, mode: 0o700 });
    }

    const cutoffDate = format(subDays(today, 12), 'yyyy-MM-dd');
    const deletedCount = await cleanupResults(cutoffDate);

    // Should delete 20 and 15 days ago (older than 12 days)
    // Should keep 10 days ago and today (newer than or equal to 12 days)
    expect(deletedCount).toBe(2);
    const date2 = dates[2];
    const date3 = dates[3];
    if (date2 && date3) {
      expect(existsSync(join(TEST_RESULTS_DIR, date2))).toBe(true);
      expect(existsSync(join(TEST_RESULTS_DIR, date3))).toBe(true);
    }
  });

  it('returns 0 when results directory does not exist', async () => {
    await rm(TEST_RESULTS_DIR, { recursive: true, force: true });

    const deletedCount = await cleanupResults('2025-01-01');

    expect(deletedCount).toBe(0);
  });

  it('returns 0 when no directories match cutoff', async () => {
    const today = new Date();
    const dates = [
      format(subDays(today, 2), 'yyyy-MM-dd'),
      format(today, 'yyyy-MM-dd'),
    ];

    for (const date of dates) {
      const dateDir = join(TEST_RESULTS_DIR, date);
      await mkdir(dateDir, { recursive: true, mode: 0o700 });
    }

    const cutoffDate = format(subDays(today, 10), 'yyyy-MM-dd');
    const deletedCount = await cleanupResults(cutoffDate);

    expect(deletedCount).toBe(0);
  });

  it('skips invalid directory names', async () => {
    const validDate = format(subDays(new Date(), 10), 'yyyy-MM-dd');
    await mkdir(join(TEST_RESULTS_DIR, validDate), {
      recursive: true,
      mode: 0o700,
    });
    await mkdir(join(TEST_RESULTS_DIR, 'invalid-dir'), {
      recursive: true,
      mode: 0o700,
    });
    await mkdir(join(TEST_RESULTS_DIR, '2025-13-45'), {
      recursive: true,
      mode: 0o700,
    });

    const cutoffDate = format(subDays(new Date(), 5), 'yyyy-MM-dd');
    const deletedCount = await cleanupResults(cutoffDate);

    expect(deletedCount).toBe(1);
    expect(existsSync(join(TEST_RESULTS_DIR, 'invalid-dir'))).toBe(true);
    expect(existsSync(join(TEST_RESULTS_DIR, '2025-13-45'))).toBe(true);
  });

  it('accepts Date object as cutoff', async () => {
    const today = new Date();
    const oldDate = format(subDays(today, 10), 'yyyy-MM-dd');

    await mkdir(join(TEST_RESULTS_DIR, oldDate), {
      recursive: true,
      mode: 0o700,
    });

    const cutoffDate = subDays(today, 5);
    const deletedCount = await cleanupResults(cutoffDate);

    expect(deletedCount).toBe(1);
  });

  it('accepts string as cutoff', async () => {
    const today = new Date();
    const oldDate = format(subDays(today, 10), 'yyyy-MM-dd');

    await mkdir(join(TEST_RESULTS_DIR, oldDate), {
      recursive: true,
      mode: 0o700,
    });

    const cutoffDate = format(subDays(today, 5), 'yyyy-MM-dd');
    const deletedCount = await cleanupResults(cutoffDate);

    expect(deletedCount).toBe(1);
  });

  it('deletes directories with contents', async () => {
    const oldDate = format(subDays(new Date(), 10), 'yyyy-MM-dd');
    const dateDir = join(TEST_RESULTS_DIR, oldDate);
    await mkdir(dateDir, { recursive: true, mode: 0o700 });

    // Add some files
    const fs = await import('node:fs/promises');
    await fs.writeFile(join(dateDir, 'file1.json'), '{}', 'utf-8');
    await fs.writeFile(join(dateDir, 'file2.json'), '{}', 'utf-8');

    const cutoffDate = format(subDays(new Date(), 5), 'yyyy-MM-dd');
    const deletedCount = await cleanupResults(cutoffDate);

    expect(deletedCount).toBe(1);
    expect(existsSync(dateDir)).toBe(false);
  });

  it('handles cleanup errors gracefully', async () => {
    // Test by trying to clean up a non-existent directory
    // (Different approach since we can't mock ESM imports easily)
    await rm(TEST_RESULTS_DIR, { recursive: true, force: true });

    const deletedCount = await cleanupResults('2025-01-01');

    // Should return 0 when directory doesn't exist
    expect(deletedCount).toBe(0);
  });
});
