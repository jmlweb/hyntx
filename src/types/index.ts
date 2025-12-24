/**
 * Hyntx - TypeScript Type Definitions
 *
 * This module contains all shared type definitions for the Hyntx system.
 * All types are designed to be composable and type-safe.
 */

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

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported AI provider types.
 */
export type ProviderType = 'ollama' | 'anthropic' | 'google';

/**
 * Context limits for each provider.
 * Used for intelligent batching of prompts.
 */
export type ProviderLimits = {
  readonly maxTokensPerBatch: number;
  readonly prioritization: 'longest-first' | 'chronological';
};

/**
 * Provider limits by type.
 */
export const PROVIDER_LIMITS: Record<ProviderType, ProviderLimits> = {
  ollama: { maxTokensPerBatch: 30_000, prioritization: 'longest-first' },
  anthropic: { maxTokensPerBatch: 100_000, prioritization: 'chronological' },
  google: { maxTokensPerBatch: 500_000, prioritization: 'chronological' },
} as const;

/**
 * Interface for AI analysis providers.
 * All providers must implement this interface.
 */
export type AnalysisProvider = {
  readonly name: string;
  isAvailable(): Promise<boolean>;
  analyze(prompts: readonly string[], date: string): Promise<AnalysisResult>;
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
