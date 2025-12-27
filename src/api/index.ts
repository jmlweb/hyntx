/**
 * Hyntx Library API
 *
 * Public ESM library exports for programmatic usage.
 * This file provides zero-dependency access to core functionality
 * without any CLI-specific dependencies (chalk, ora, boxen, etc.).
 */

// =============================================================================
// Core Analysis Functions
// =============================================================================

export { analyzePrompts } from '../core/analyzer.js';
export {
  claudeProjectsExist,
  extractProjectName,
  groupByDay,
  parseDate,
  readLogs,
} from '../core/log-reader.js';
export { sanitize, sanitizePrompts } from '../core/sanitizer.js';

// =============================================================================
// History Functions
// =============================================================================

export {
  compareResults,
  ensureHistoryDir,
  getDateOneMonthAgo,
  getDateOneWeekAgo,
  getHistoryDir,
  listAvailableDates,
  loadAnalysisResult,
  saveAnalysisResult,
} from '../core/history.js';

// =============================================================================
// Provider Functions
// =============================================================================

export {
  createProvider,
  getAllProviders,
  getAvailableProvider,
} from '../providers/index.js';

// =============================================================================
// Utility Functions
// =============================================================================

export { getEnvConfig, isFirstRun, parseServices } from '../utils/env.js';
export {
  loadProjectConfig,
  loadProjectConfigForCwd,
  mergeConfigs,
} from '../utils/project-config.js';

// =============================================================================
// Cache Functions
// =============================================================================

export {
  cleanupExpiredEntries,
  clearCache,
  generateCacheKey,
  getCachedResult,
  hashSystemPrompt,
  setCachedResult,
  validateSystemPrompt,
} from '../cache/index.js';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  AnalysisPattern,
  // Core types
  AnalysisProvider,
  AnalysisResult,
  AnalysisStats,
  AnthropicConfig,
  BatchStrategy,
  BatchStrategyType,
  BeforeAfter,
  CachedBatchResult,
  // Cache types
  CacheMetadata,
  CacheOptions,
  // Log types
  ClaudeMessage,
  // CLI types (for library users who might need them)
  CliOptions,
  ComparisonChanges,
  ComparisonResult,
  DayGroup,
  EnvConfig,
  ExitCode,
  ExtractedPrompt,
  FilePosition,
  GoogleConfig,
  // History types
  HistoryEntry,
  HistoryMetadata,
  IssueMetadata,
  IssueTaxonomy,
  JsonErrorResponse,
  ListHistoryOptions,
  LogEntry,
  LogReadResult,
  // Watcher types
  LogWatcher,
  MinimalResult,
  // Configuration types
  OllamaConfig,
  OutputFormat,
  PatternChange,
  PatternSeverity,
  ProjectContext,
  PromptAnalysis,
  PromptEvent,
  ProviderLimits,
  // Provider types
  ProviderType,
  // Schema types
  SchemaType,
  SchemaVersion,
  ShellConfigResult,
  // Shell types
  ShellType,
  WatcherOptions,
} from '../types/index.js';

// Re-export sanitizer types
export type {
  SanitizePromptsResult,
  SanitizeResult,
} from '../core/sanitizer.js';

// Re-export log reader types
export type { ReadLogsOptions } from '../core/log-reader.js';

// Re-export provider types
export type { FallbackCallback } from '../providers/index.js';

// =============================================================================
// Constants
// =============================================================================

export {
  BATCH_STRATEGIES,
  CACHE_DEFAULTS,
  ENV_DEFAULTS,
  EXIT_CODES,
  PROVIDER_LIMITS,
} from '../types/index.js';
export {
  CACHE_ANALYSIS_DIR,
  CACHE_META_FILE,
  CLAUDE_PROJECTS_DIR,
  HYNTX_CACHE_DIR,
  HYNTX_HISTORY_DIR,
  LAST_RUN_FILE,
} from '../utils/paths.js';
