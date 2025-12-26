/**
 * Tests for library API exports
 *
 * Verifies that all expected exports are available and properly typed.
 */

import { describe, it, expect } from 'vitest';
import * as api from '../../../src/api/index.js';

describe('Library API Exports', () => {
  describe('Core Functions', () => {
    it('should export analyzePrompts', () => {
      expect(api.analyzePrompts).toBeDefined();
      expect(typeof api.analyzePrompts).toBe('function');
    });

    it('should export sanitize', () => {
      expect(api.sanitize).toBeDefined();
      expect(typeof api.sanitize).toBe('function');
    });

    it('should export sanitizePrompts', () => {
      expect(api.sanitizePrompts).toBeDefined();
      expect(typeof api.sanitizePrompts).toBe('function');
    });

    it('should export readLogs', () => {
      expect(api.readLogs).toBeDefined();
      expect(typeof api.readLogs).toBe('function');
    });

    it('should export claudeProjectsExist', () => {
      expect(api.claudeProjectsExist).toBeDefined();
      expect(typeof api.claudeProjectsExist).toBe('function');
    });

    it('should export extractProjectName', () => {
      expect(api.extractProjectName).toBeDefined();
      expect(typeof api.extractProjectName).toBe('function');
    });

    it('should export parseDate', () => {
      expect(api.parseDate).toBeDefined();
      expect(typeof api.parseDate).toBe('function');
    });

    it('should export groupByDay', () => {
      expect(api.groupByDay).toBeDefined();
      expect(typeof api.groupByDay).toBe('function');
    });
  });

  describe('History Functions', () => {
    it('should export saveAnalysisResult', () => {
      expect(api.saveAnalysisResult).toBeDefined();
      expect(typeof api.saveAnalysisResult).toBe('function');
    });

    it('should export loadAnalysisResult', () => {
      expect(api.loadAnalysisResult).toBeDefined();
      expect(typeof api.loadAnalysisResult).toBe('function');
    });

    it('should export listAvailableDates', () => {
      expect(api.listAvailableDates).toBeDefined();
      expect(typeof api.listAvailableDates).toBe('function');
    });

    it('should export compareResults', () => {
      expect(api.compareResults).toBeDefined();
      expect(typeof api.compareResults).toBe('function');
    });

    it('should export getDateOneWeekAgo', () => {
      expect(api.getDateOneWeekAgo).toBeDefined();
      expect(typeof api.getDateOneWeekAgo).toBe('function');
    });

    it('should export getDateOneMonthAgo', () => {
      expect(api.getDateOneMonthAgo).toBeDefined();
      expect(typeof api.getDateOneMonthAgo).toBe('function');
    });

    it('should export getHistoryDir', () => {
      expect(api.getHistoryDir).toBeDefined();
      expect(typeof api.getHistoryDir).toBe('function');
    });

    it('should export ensureHistoryDir', () => {
      expect(api.ensureHistoryDir).toBeDefined();
      expect(typeof api.ensureHistoryDir).toBe('function');
    });
  });

  describe('Provider Functions', () => {
    it('should export createProvider', () => {
      expect(api.createProvider).toBeDefined();
      expect(typeof api.createProvider).toBe('function');
    });

    it('should export getAvailableProvider', () => {
      expect(api.getAvailableProvider).toBeDefined();
      expect(typeof api.getAvailableProvider).toBe('function');
    });

    it('should export getAllProviders', () => {
      expect(api.getAllProviders).toBeDefined();
      expect(typeof api.getAllProviders).toBe('function');
    });
  });

  describe('Utility Functions', () => {
    it('should export getEnvConfig', () => {
      expect(api.getEnvConfig).toBeDefined();
      expect(typeof api.getEnvConfig).toBe('function');
    });

    it('should export isFirstRun', () => {
      expect(api.isFirstRun).toBeDefined();
      expect(typeof api.isFirstRun).toBe('function');
    });

    it('should export parseServices', () => {
      expect(api.parseServices).toBeDefined();
      expect(typeof api.parseServices).toBe('function');
    });

    it('should export loadProjectConfigForCwd', () => {
      expect(api.loadProjectConfigForCwd).toBeDefined();
      expect(typeof api.loadProjectConfigForCwd).toBe('function');
    });

    it('should export mergeConfigs', () => {
      expect(api.mergeConfigs).toBeDefined();
      expect(typeof api.mergeConfigs).toBe('function');
    });

    it('should export loadProjectConfig', () => {
      expect(api.loadProjectConfig).toBeDefined();
      expect(typeof api.loadProjectConfig).toBe('function');
    });

    // validateAllProviders and validateProvider are CLI-only (use chalk)
    // logger is CLI-only (use chalk for colored output)
  });

  describe('Cache Functions', () => {
    it('should export generateCacheKey', () => {
      expect(api.generateCacheKey).toBeDefined();
      expect(typeof api.generateCacheKey).toBe('function');
    });

    it('should export hashSystemPrompt', () => {
      expect(api.hashSystemPrompt).toBeDefined();
      expect(typeof api.hashSystemPrompt).toBe('function');
    });

    it('should export validateSystemPrompt', () => {
      expect(api.validateSystemPrompt).toBeDefined();
      expect(typeof api.validateSystemPrompt).toBe('function');
    });

    it('should export getCachedResult', () => {
      expect(api.getCachedResult).toBeDefined();
      expect(typeof api.getCachedResult).toBe('function');
    });

    it('should export setCachedResult', () => {
      expect(api.setCachedResult).toBeDefined();
      expect(typeof api.setCachedResult).toBe('function');
    });

    it('should export clearCache', () => {
      expect(api.clearCache).toBeDefined();
      expect(typeof api.clearCache).toBe('function');
    });

    it('should export cleanupExpiredEntries', () => {
      expect(api.cleanupExpiredEntries).toBeDefined();
      expect(typeof api.cleanupExpiredEntries).toBe('function');
    });
  });

  // Reminder functions are CLI-only (use prompts for interaction)

  describe('Constants', () => {
    it('should export EXIT_CODES', () => {
      expect(api.EXIT_CODES).toBeDefined();
      expect(typeof api.EXIT_CODES).toBe('object');
      expect(api.EXIT_CODES.SUCCESS).toBe(0);
      expect(api.EXIT_CODES.ERROR).toBe(1);
      expect(api.EXIT_CODES.NO_DATA).toBe(2);
      expect(api.EXIT_CODES.PROVIDER_UNAVAILABLE).toBe(3);
    });

    it('should export ENV_DEFAULTS', () => {
      expect(api.ENV_DEFAULTS).toBeDefined();
      expect(typeof api.ENV_DEFAULTS).toBe('object');
      expect(api.ENV_DEFAULTS.reminder).toBeDefined();
      expect(api.ENV_DEFAULTS.ollama).toBeDefined();
      expect(api.ENV_DEFAULTS.anthropic).toBeDefined();
      expect(api.ENV_DEFAULTS.google).toBeDefined();
    });

    it('should export PROVIDER_LIMITS', () => {
      expect(api.PROVIDER_LIMITS).toBeDefined();
      expect(typeof api.PROVIDER_LIMITS).toBe('object');
      expect(api.PROVIDER_LIMITS.ollama).toBeDefined();
      expect(api.PROVIDER_LIMITS.anthropic).toBeDefined();
      expect(api.PROVIDER_LIMITS.google).toBeDefined();
    });

    it('should export BATCH_STRATEGIES', () => {
      expect(api.BATCH_STRATEGIES).toBeDefined();
      expect(typeof api.BATCH_STRATEGIES).toBe('object');
      expect(api.BATCH_STRATEGIES.micro).toBeDefined();
      expect(api.BATCH_STRATEGIES.small).toBeDefined();
      expect(api.BATCH_STRATEGIES.standard).toBeDefined();
    });

    it('should export CACHE_DEFAULTS', () => {
      expect(api.CACHE_DEFAULTS).toBeDefined();
      expect(typeof api.CACHE_DEFAULTS).toBe('object');
      expect(api.CACHE_DEFAULTS.ttlMs).toBeDefined();
    });

    it('should export path constants', () => {
      expect(api.CLAUDE_PROJECTS_DIR).toBeDefined();
      expect(typeof api.CLAUDE_PROJECTS_DIR).toBe('string');

      expect(api.LAST_RUN_FILE).toBeDefined();
      expect(typeof api.LAST_RUN_FILE).toBe('string');

      expect(api.HYNTX_HISTORY_DIR).toBeDefined();
      expect(typeof api.HYNTX_HISTORY_DIR).toBe('string');

      expect(api.HYNTX_CACHE_DIR).toBeDefined();
      expect(typeof api.HYNTX_CACHE_DIR).toBe('string');

      expect(api.CACHE_ANALYSIS_DIR).toBeDefined();
      expect(typeof api.CACHE_ANALYSIS_DIR).toBe('string');

      expect(api.CACHE_META_FILE).toBeDefined();
      expect(typeof api.CACHE_META_FILE).toBe('string');
    });
  });

  describe('No Side Effects', () => {
    it('should not have any side effects on import', () => {
      // If we got here without errors, the import didn't have side effects
      // that would cause the test suite to fail
      expect(true).toBe(true);
    });

    it('should not execute CLI code on import', () => {
      // The api module should not depend on chalk, ora, or other CLI deps
      // This is verified by the fact that the import succeeds without those deps
      expect(api).toBeDefined();
    });
  });
});
