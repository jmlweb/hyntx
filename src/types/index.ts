/**
 * Hyntx - TypeScript Type Definitions
 *
 * This module contains all shared type definitions for the Hyntx system.
 * All types are designed to be composable and type-safe.
 */

// =============================================================================
// Re-exports from other modules
// =============================================================================

export type { MinimalResult } from '../core/aggregator.js';
export type {
  IssueMetadata,
  IssueTaxonomy,
  SchemaType,
} from '../providers/schemas.js';

// =============================================================================
// Schema and Log Types
// =============================================================================

/**
 * Schema version for Claude Code JSONL logs.
 * Used for graceful degradation when log format changes.
 */
export type SchemaVersion = {
  readonly major: number;
  readonly minor: number;
  readonly detected: string;
};

/**
 * Message structure in Claude Code JSONL logs.
 * Represents a single entry in the conversation log.
 */
export type ClaudeMessage = {
  readonly type: 'user' | 'assistant' | 'system';
  readonly message: {
    readonly role: 'user' | 'assistant' | 'system';
    readonly content: string;
  };
  readonly timestamp: string;
  readonly sessionId: string;
  readonly cwd: string;
};

/**
 * Log entry type alias for JSONL files.
 * Used in test utilities and log parsing.
 */
export type LogEntry = ClaudeMessage;

/**
 * Data extracted from Claude Code messages.
 * Contains the sanitized prompt and metadata.
 */
export type ExtractedPrompt = {
  readonly content: string;
  readonly timestamp: string;
  readonly sessionId: string;
  readonly project: string;
  readonly date: string;
};

/**
 * Result of reading logs from the filesystem.
 */
export type LogReadResult = {
  readonly prompts: readonly ExtractedPrompt[];
  readonly warnings: readonly string[];
};

/**
 * Grouping of prompts by day for analysis.
 */
export type DayGroup = {
  readonly date: string;
  readonly prompts: readonly ExtractedPrompt[];
  readonly projects: readonly string[];
};

// =============================================================================
// Analysis Types
// =============================================================================

/**
 * Before/after rewrite example for a pattern.
 * Shows concrete improvement for a detected issue.
 */
export type BeforeAfter = {
  readonly before: string;
  readonly after: string;
};

/**
 * Severity levels for detected patterns.
 */
export type PatternSeverity = 'low' | 'medium' | 'high';

/**
 * Category for individual prompt analysis.
 * Used in batch-individual hybrid mode.
 */
export type PromptCategory =
  | 'vague-request'
  | 'missing-context'
  | 'too-broad'
  | 'unclear-goal'
  | 'other';

/**
 * Individual prompt analysis result.
 * Used in batch-individual hybrid mode to return per-prompt results.
 */
export type IndividualPromptResult = {
  readonly status: 'correct' | 'problems';
  readonly problems: readonly string[];
  readonly categories: readonly PromptCategory[];
  readonly example: string;
  readonly suggestion: string;
};

/**
 * Detected improvement pattern from analysis.
 * Each pattern includes concrete examples and actionable suggestions.
 */
export type AnalysisPattern = {
  readonly id: string;
  readonly name: string;
  readonly frequency: number;
  readonly severity: PatternSeverity;
  readonly examples: readonly string[];
  readonly suggestion: string;
  readonly beforeAfter: BeforeAfter;
};

/**
 * Statistics from the analysis.
 */
export type AnalysisStats = {
  readonly totalPrompts: number;
  readonly promptsWithIssues: number;
  readonly overallScore: number;
};

/**
 * Complete analysis result from a provider.
 * Contains patterns, statistics, and top suggestion.
 */
export type AnalysisResult = {
  readonly date: string;
  readonly patterns: readonly AnalysisPattern[];
  readonly stats: AnalysisStats;
  readonly topSuggestion: string;
};

/**
 * Prompt analysis without the date field.
 * Used for raw provider responses before date context is added.
 */
export type PromptAnalysis = Omit<AnalysisResult, 'date'>;

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported AI provider types.
 */
export type ProviderType = 'ollama' | 'anthropic' | 'google';

/**
 * Batch strategy type identifier.
 */
export type BatchStrategyType = 'micro' | 'small' | 'standard';

/**
 * Batch strategy configuration for different model sizes.
 */
export type BatchStrategy = {
  readonly maxTokensPerBatch: number;
  readonly maxPromptsPerBatch: number;
  readonly description: string;
};

/**
 * Available batch strategies by model size.
 */
export const BATCH_STRATEGIES: Record<BatchStrategyType, BatchStrategy> = {
  // For models < 4GB
  micro: {
    maxTokensPerBatch: 500,
    maxPromptsPerBatch: 3,
    description: 'For models < 4GB',
  },
  // For models 4-7GB
  small: {
    maxTokensPerBatch: 1_500,
    maxPromptsPerBatch: 10,
    description: 'For models 4-7GB',
  },
  // For models > 7GB
  standard: {
    maxTokensPerBatch: 3_000,
    maxPromptsPerBatch: 50,
    description: 'For models > 7GB',
  },
} as const;

/**
 * Context limits for each provider.
 * Used for intelligent batching of prompts.
 */
export type ProviderLimits = {
  readonly maxTokensPerBatch: number;
  readonly maxPromptsPerBatch?: number;
  readonly prioritization: 'longest-first' | 'chronological';
};

/**
 * Provider limits by type.
 */
export const PROVIDER_LIMITS: Record<ProviderType, ProviderLimits> = {
  // Small local models struggle with large inputs - limit to ~10 short prompts
  ollama: { maxTokensPerBatch: 3_000, prioritization: 'longest-first' },
  anthropic: { maxTokensPerBatch: 100_000, prioritization: 'chronological' },
  google: { maxTokensPerBatch: 500_000, prioritization: 'chronological' },
} as const;

/**
 * Configuration for a single analysis rule.
 * Allows enabling/disabling rules and overriding their severity.
 */
export type RuleConfig = {
  readonly enabled?: boolean;
  readonly severity?: PatternSeverity;
};

/**
 * Configuration for all analysis rules.
 * Maps rule IDs to their configuration.
 */
export type RulesConfig = Record<string, RuleConfig>;

/**
 * Project-specific context information.
 * Loaded from .hyntxrc.json files to provide additional context during analysis.
 */
export type ProjectContext = {
  readonly role?: string;
  readonly techStack?: readonly string[];
  readonly domain?: string;
  readonly guidelines?: readonly string[];
  readonly projectType?: string;
};

/**
 * Interface for AI analysis providers.
 * All providers must implement this interface.
 */
export type AnalysisProvider = {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  analyze(
    prompts: readonly string[],
    date: string,
    context?: ProjectContext,
  ): Promise<AnalysisResult>;
  getBatchLimits?(): ProviderLimits;
};

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Ollama provider configuration.
 */
export type OllamaConfig = {
  readonly model: string;
  readonly host: string;
  readonly schemaOverride?: 'batch' | 'individual';
};

/**
 * Anthropic provider configuration.
 */
export type AnthropicConfig = {
  readonly model: string;
  readonly apiKey: string;
};

/**
 * Google provider configuration.
 */
export type GoogleConfig = {
  readonly model: string;
  readonly apiKey: string;
};

/**
 * Complete configuration from environment variables.
 */
export type EnvConfig = {
  readonly services: readonly ProviderType[];
  readonly reminder: string;
  readonly ollama: OllamaConfig;
  readonly anthropic: AnthropicConfig;
  readonly google: GoogleConfig;
};

/**
 * Default values for environment configuration.
 */
export const ENV_DEFAULTS = {
  reminder: '7d',
  ollama: {
    model: 'llama3.2',
    host: 'http://localhost:11434',
  },
  anthropic: {
    model: 'claude-3-5-haiku-latest',
  },
  google: {
    model: 'gemini-2.0-flash-exp',
  },
} as const;

// =============================================================================
// Shell Configuration Types
// =============================================================================

/**
 * Result of shell config file update operation.
 */
export type ShellConfigResult = {
  readonly success: boolean;
  readonly shellFile: string;
  readonly message: string;
  readonly action: 'created' | 'updated' | 'skipped' | 'failed';
};

/**
 * Supported shell types for auto-configuration.
 */
export type ShellType = 'zsh' | 'bash' | 'fish' | 'unknown';

// =============================================================================
// CLI Types
// =============================================================================

/**
 * Exit codes for the CLI.
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  NO_DATA: 2,
  PROVIDER_UNAVAILABLE: 3,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Options parsed from CLI arguments.
 */
export type CliOptions = {
  readonly date: string;
  readonly from?: string;
  readonly to?: string;
  readonly project?: string;
  readonly output?: string;
  readonly verbose: boolean;
  readonly dryRun: boolean;
  readonly checkReminder: boolean;
  readonly help: boolean;
  readonly version: boolean;
};

// =============================================================================
// Reporter Types
// =============================================================================

/**
 * Output format for reports.
 */
export type OutputFormat = 'terminal' | 'markdown' | 'json';

/**
 * JSON error response structure.
 */
export type JsonErrorResponse = {
  readonly error: string;
  readonly code: string;
};

/**
 * Report context for formatting.
 */
export type ReportContext = {
  readonly result: AnalysisResult;
  readonly date: string;
  readonly projects: readonly string[];
};

// =============================================================================
// History Types
// =============================================================================

/**
 * Metadata about the analysis execution.
 */
export type HistoryMetadata = {
  readonly provider: string;
  readonly promptCount: number;
  readonly projects: readonly string[];
};

/**
 * Complete history entry stored in history files.
 */
export type HistoryEntry = {
  readonly result: AnalysisResult;
  readonly metadata: HistoryMetadata;
};

/**
 * Options for listing history entries.
 */
export type ListHistoryOptions = {
  readonly provider?: string;
  readonly project?: string;
  readonly minScore?: number;
  readonly maxScore?: number;
};

/**
 * Change detected in a pattern between two analyses.
 */
export type PatternChange = {
  readonly id: string;
  readonly name: string;
  readonly status: 'new' | 'resolved' | 'changed';
  readonly frequencyBefore?: number;
  readonly frequencyAfter?: number;
  readonly severityBefore?: PatternSeverity;
  readonly severityAfter?: PatternSeverity;
};

/**
 * All detected changes between two analyses.
 */
export type ComparisonChanges = {
  readonly scoreDelta: number;
  readonly newPatterns: readonly AnalysisPattern[];
  readonly resolvedPatterns: readonly AnalysisPattern[];
  readonly changedPatterns: readonly PatternChange[];
};

/**
 * Result of comparing two analysis results.
 */
export type ComparisonResult = {
  readonly before: AnalysisResult;
  readonly after: AnalysisResult;
  readonly changes: ComparisonChanges;
};

// =============================================================================
// Watcher Types
// =============================================================================

/**
 * Event emitted when a new prompt is detected in the logs.
 * Contains the extracted prompt and the file path where it was found.
 */
export type PromptEvent = {
  readonly prompt: ExtractedPrompt;
  readonly filePath: string;
};

/**
 * Options for configuring the log watcher.
 */
export type WatcherOptions = {
  readonly debounceMs?: number;
  readonly projectFilter?: string;
  readonly signal?: AbortSignal;
  readonly baseDir?: string;
};

/**
 * Tracks the current position in a file for incremental reading.
 * Used to only read new content when files are modified.
 */
export type FilePosition = {
  readonly path: string;
  readonly size: number;
  readonly lastModified: number;
};

/**
 * Interface for the log watcher.
 * Watches Claude Code JSONL files for new prompts in real-time.
 */
export type LogWatcher = {
  start(): Promise<void>;
  stop(): Promise<void>;
  on(event: 'prompt', callback: (event: PromptEvent) => void): void;
  on(event: 'error', callback: (error: Error) => void): void;
  on(event: 'ready', callback: () => void): void;
};

// =============================================================================
// Cache Types
// =============================================================================

/**
 * Metadata stored with cached analysis results.
 * Used for cache validation and invalidation.
 */
export type CacheMetadata = {
  readonly cachedAt: number;
  readonly promptCount: number;
  readonly model: string;
  readonly systemPromptHash: string;
};

/**
 * Complete cached batch result including metadata.
 * Stored as JSON files in the cache directory.
 */
export type CachedBatchResult = {
  readonly result: AnalysisResult;
  readonly metadata: CacheMetadata;
};

/**
 * Options for cache operations.
 */
export type CacheOptions = {
  readonly ttlMs: number;
};

/**
 * Default values for cache configuration.
 */
export const CACHE_DEFAULTS = {
  ttlMs: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
} as const;

// =============================================================================
// Incremental Results Storage Types
// =============================================================================

/**
 * Metadata for an individual prompt analysis result.
 * Used for cache validation and tracking analysis provenance.
 *
 * Note: systemPromptHash is included in the file hash (not stored here)
 * per PERFORMANCE_OPTIMIZATION.md Decision 1 & 4.
 */
export type PromptResultMetadata = {
  readonly promptHash: string;
  readonly date: string;
  readonly project?: string;
  readonly analyzedAt: number;
  readonly provider: string;
  readonly model: string;
  readonly schemaType: string;
};

/**
 * Complete cached result for an individual prompt.
 * Stored as JSON files in ~/.hyntx/results/<YYYY-MM-DD>/<hash>.json
 */
export type PromptResult = {
  readonly result: AnalysisResult;
  readonly metadata: PromptResultMetadata;
};

// =============================================================================
// Analytics and Data Science Types
// =============================================================================

/**
 * Descriptive statistics for a dataset.
 * Provides comprehensive statistical measures beyond simple averages.
 */
export type DescriptiveStats = {
  readonly count: number;
  readonly mean: number;
  readonly median: number;
  readonly stdDev: number;
  readonly variance: number;
  readonly min: number;
  readonly max: number;
  readonly range: number;
  readonly percentiles: {
    readonly p25: number;
    readonly p50: number;
    readonly p75: number;
    readonly p90: number;
    readonly p95: number;
  };
  readonly skewness: number;
  readonly kurtosis: number;
};

/**
 * Result of outlier detection analysis.
 */
export type OutlierResult = {
  readonly outliers: readonly number[];
  readonly outlierIndices: readonly number[];
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly method: 'iqr' | 'zscore';
};

/**
 * Specificity score for a prompt.
 * Measures how specific and detailed a prompt is.
 */
export type SpecificityScore = {
  readonly overall: number;
  readonly filePathCount: number;
  readonly functionMentions: number;
  readonly hasErrorMessage: boolean;
  readonly hasCodeSnippet: boolean;
  readonly actionVerbClarity: number;
  readonly wordCount: number;
  readonly characterCount: number;
};

/**
 * Lexical complexity metrics for text analysis.
 */
export type LexicalMetrics = {
  readonly uniqueWordRatio: number;
  readonly averageWordLength: number;
  readonly technicalTermDensity: number;
  readonly sentenceCount: number;
  readonly averageSentenceLength: number;
};

/**
 * A single cluster from clustering analysis.
 */
export type Cluster = {
  readonly id: number;
  readonly indices: readonly number[];
  readonly size: number;
};

/**
 * A labeled cluster with interpretation.
 */
export type LabeledCluster = Cluster & {
  readonly label: string;
  readonly keywords: readonly string[];
  readonly representativePrompt: string;
  readonly dominantIssue?: string;
};

/**
 * Result of clustering analysis.
 */
export type ClusterResult = {
  readonly clusters: readonly Cluster[];
  readonly centroids: readonly number[][];
  readonly k: number;
  readonly silhouetteScore: number;
  readonly inertia: number;
};

/**
 * Complete cluster analysis with labeled clusters.
 */
export type ClusterAnalysis = {
  readonly clusters: readonly LabeledCluster[];
  readonly metrics: {
    readonly silhouetteScore: number;
    readonly inertia: number;
    readonly optimalK: number;
  };
  readonly summary: {
    readonly totalPrompts: number;
    readonly avgClusterSize: number;
    readonly largestCluster: number;
    readonly smallestCluster: number;
  };
};

/**
 * Data point for trend analysis.
 */
export type TrendDataPoint = {
  readonly date: string;
  readonly score: number;
  readonly promptCount: number;
  readonly issueCount: number;
};

/**
 * Result of trend analysis using linear regression.
 */
export type TrendAnalysis = {
  readonly slope: number;
  readonly intercept: number;
  readonly rSquared: number;
  readonly direction: 'improving' | 'stable' | 'declining';
  readonly confidence: 'high' | 'medium' | 'low';
  readonly projectedScore: (days: number) => number;
};

/**
 * Result of improvement detection analysis.
 */
export type ImprovementResult = {
  readonly status: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  readonly recentAverage?: number;
  readonly historicalAverage?: number;
  readonly absoluteChange?: number;
  readonly percentChange?: number;
  readonly significantPatterns?: readonly PatternChange[];
  readonly message?: string;
};

/**
 * Forecast prediction with confidence intervals.
 */
export type ForecastPrediction = {
  readonly date: string;
  readonly predictedScore: number;
  readonly confidenceInterval: {
    readonly lower: number;
    readonly upper: number;
  };
};

/**
 * Result of forecasting analysis.
 */
export type ForecastResult = {
  readonly predictions: readonly ForecastPrediction[];
  readonly trend: TrendAnalysis;
};

/**
 * Enhanced statistics extending the basic AnalysisStats.
 * Backward compatible - all enhanced fields are optional.
 */
export type EnhancedAnalysisStats = AnalysisStats & {
  readonly descriptive?: DescriptiveStats;
  readonly specificity?: {
    readonly mean: number;
    readonly distribution: readonly number[];
  };
  readonly lexical?: {
    readonly avgComplexity: number;
    readonly avgWordCount: number;
  };
  readonly timing?: {
    readonly analysisStarted: number;
    readonly analysisCompleted: number;
    readonly durationMs: number;
    readonly tokensProcessed: number;
  };
};

/**
 * Enhanced analysis result with optional data science features.
 * Backward compatible - all enhanced fields are optional.
 */
export type EnhancedAnalysisResult = AnalysisResult & {
  readonly enhancedStats?: EnhancedAnalysisStats;
  readonly clusters?: ClusterAnalysis;
  readonly trend?: TrendAnalysis;
};
