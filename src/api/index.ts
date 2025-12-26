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
export { sanitize, sanitizePrompts } from '../core/sanitizer.js';
export {
  readLogs,
  claudeProjectsExist,
  extractProjectName,
  parseDate,
  groupByDay,
} from '../core/log-reader.js';

// =============================================================================
// History Functions
// =============================================================================

export {
  saveAnalysisResult,
  loadAnalysisResult,
  listAvailableDates,
  compareResults,
  getDateOneWeekAgo,
  getDateOneMonthAgo,
  getHistoryDir,
  ensureHistoryDir,
} from '../core/history.js';

// =============================================================================
// Provider Functions
// =============================================================================

export {
  createProvider,
  getAvailableProvider,
  getAllProviders,
} from '../providers/index.js';

// =============================================================================
// Utility Functions
// =============================================================================

export { getEnvConfig, isFirstRun, parseServices } from '../utils/env.js';
export {
  loadProjectConfigForCwd,
  mergeConfigs,
  loadProjectConfig,
} from '../utils/project-config.js';

// =============================================================================
// Cache Functions
// =============================================================================

export {
  generateCacheKey,
  hashSystemPrompt,
  validateSystemPrompt,
  getCachedResult,
  setCachedResult,
  clearCache,
  cleanupExpiredEntries,
} from '../cache/index.js';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Core types
  AnalysisProvider,
  AnalysisResult,
  AnalysisPattern,
  AnalysisStats,
  PromptAnalysis,
  BeforeAfter,
  PatternSeverity,
  // Provider types
  ProviderType,
  ProviderLimits,
  BatchStrategy,
  BatchStrategyType,
  // Log types
  ClaudeMessage,
  LogEntry,
  ExtractedPrompt,
  LogReadResult,
  DayGroup,
  SchemaVersion,
  // Configuration types
  OllamaConfig,
  AnthropicConfig,
  GoogleConfig,
  EnvConfig,
  ProjectContext,
  // History types
  HistoryEntry,
  HistoryMetadata,
  ComparisonResult,
  ComparisonChanges,
  PatternChange,
  ListHistoryOptions,
  // Cache types
  CacheMetadata,
  CachedBatchResult,
  CacheOptions,
  // Watcher types
  LogWatcher,
  WatcherOptions,
  PromptEvent,
  FilePosition,
  // CLI types (for library users who might need them)
  CliOptions,
  ExitCode,
  JsonErrorResponse,
  OutputFormat,
  // Shell types
  ShellType,
  ShellConfigResult,
  // Schema types
  SchemaType,
  IssueMetadata,
  IssueTaxonomy,
  MinimalResult,
} from '../types/index.js';

// Re-export sanitizer types
export type {
  SanitizeResult,
  SanitizePromptsResult,
} from '../core/sanitizer.js';

// Re-export log reader types
export type { ReadLogsOptions } from '../core/log-reader.js';

// Re-export provider types
export type { FallbackCallback } from '../providers/index.js';

// =============================================================================
// Constants
// =============================================================================

export {
  EXIT_CODES,
  ENV_DEFAULTS,
  PROVIDER_LIMITS,
  BATCH_STRATEGIES,
  CACHE_DEFAULTS,
} from '../types/index.js';

export {
  CLAUDE_PROJECTS_DIR,
  LAST_RUN_FILE,
  HYNTX_HISTORY_DIR,
  HYNTX_CACHE_DIR,
  CACHE_ANALYSIS_DIR,
  CACHE_META_FILE,
} from '../utils/paths.js';
