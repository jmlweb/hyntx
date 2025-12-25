/**
 * Ollama AI provider implementation.
 *
 * This module provides integration with local Ollama instances for prompt analysis.
 * Features include:
 * - Availability checking with timeout and model verification
 * - Retry logic with exponential backoff for network errors
 * - Support for both raw JSON and markdown-wrapped responses
 */

import {
  type AnalysisProvider,
  type AnalysisResult,
  type OllamaConfig,
  type ProjectContext,
  type ProviderLimits,
  type BatchStrategyType,
  type SchemaType,
  BATCH_STRATEGIES,
} from '../types/index.js';
import { logger } from '../utils/logger.js';
import { buildUserPrompt, parseResponse } from './base.js';
import { SYSTEM_PROMPT_MINIMAL, SYSTEM_PROMPT_FULL } from './schemas.js';

/**
 * Maximum number of retry attempts for network errors.
 */
const MAX_RETRIES = 2;

/**
 * Timeout for availability check (3 seconds).
 */
const AVAILABILITY_TIMEOUT_MS = 3000;

/**
 * Timeout for analysis request (60 seconds).
 */
const ANALYSIS_TIMEOUT_MS = 60000;

/**
 * Base delay for exponential backoff (1 second).
 */
const BASE_RETRY_DELAY_MS = 1000;

/**
 * Model-to-strategy mapping for known Ollama models.
 * Maps model names to their optimal batch strategy.
 */
const MODEL_STRATEGY_MAP: Record<string, BatchStrategyType> = {
  // Micro (< 4GB)
  'llama3.2': 'micro',
  'phi3:mini': 'micro',
  'gemma3:4b': 'micro',
  'gemma2:2b': 'micro',

  // Small (4-7GB)
  'mistral:7b': 'small',
  'llama3:8b': 'small',
  'codellama:7b': 'small',

  // Standard (> 7GB)
  'llama3:70b': 'standard',
  mixtral: 'standard',
  'qwen2.5:14b': 'standard',
};

/**
 * Detects the optimal batch strategy for a given model.
 * Uses exact and partial matching against known model names.
 *
 * @param modelName - Name of the Ollama model
 * @returns Batch strategy type
 *
 * @example
 * ```typescript
 * detectBatchStrategy('llama3.2') // 'micro'
 * detectBatchStrategy('llama3.2:latest') // 'micro' (partial match)
 * detectBatchStrategy('unknown-model') // 'micro' (safe default)
 * ```
 */
export function detectBatchStrategy(modelName: string): BatchStrategyType {
  // Check exact match first
  if (MODEL_STRATEGY_MAP[modelName]) {
    return MODEL_STRATEGY_MAP[modelName];
  }

  // Check partial match (e.g., "llama3.2:latest" matches "llama3.2")
  for (const [pattern, strategy] of Object.entries(MODEL_STRATEGY_MAP)) {
    if (modelName.includes(pattern)) {
      return strategy;
    }
  }

  // Default to micro for unknown models (safest)
  return 'micro';
}

/**
 * Ollama provider for local AI analysis.
 * Implements the AnalysisProvider interface for Ollama instances.
 */
export class OllamaProvider implements AnalysisProvider {
  public readonly name = 'Ollama';
  private readonly config: OllamaConfig;
  private readonly batchStrategy: BatchStrategyType;
  private readonly schemaType: SchemaType;

  /**
   * Creates a new OllamaProvider instance.
   * Automatically detects the optimal batch strategy and schema type based on model name.
   *
   * @param config - Ollama configuration with model and host
   */
  constructor(config: OllamaConfig) {
    this.config = config;
    this.batchStrategy = detectBatchStrategy(config.model);
    this.schemaType = this.selectSchemaType();

    const strategy = BATCH_STRATEGIES[this.batchStrategy];
    logger.debug(
      `Detected batch strategy: ${this.batchStrategy} (${strategy.description}), schema type: ${this.schemaType}`,
      'ollama',
    );
  }

  /**
   * Selects the appropriate schema type based on model size.
   * Micro and small models use minimal schema for better reliability.
   * Standard models use full schema for detailed analysis.
   *
   * @returns Schema type identifier
   */
  private selectSchemaType(): SchemaType {
    // Micro and small models use minimal schema
    return ['micro', 'small'].includes(this.batchStrategy) ? 'minimal' : 'full';
  }

  /**
   * Returns dynamic batch limits based on detected model strategy.
   *
   * @returns Provider limits with model-specific constraints
   */
  public getBatchLimits(): ProviderLimits {
    const strategy = BATCH_STRATEGIES[this.batchStrategy];
    return {
      maxTokensPerBatch: strategy.maxTokensPerBatch,
      maxPromptsPerBatch: strategy.maxPromptsPerBatch,
      prioritization: 'longest-first',
    };
  }

  /**
   * Checks if the Ollama service is available and has the required model.
   * Uses a 3-second timeout to avoid hanging on unreachable services.
   *
   * @returns Promise that resolves to true if available, false otherwise
   */
  public async isAvailable(): Promise<boolean> {
    logger.debug(`Connecting to Ollama at ${this.config.host}`, 'ollama');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, AVAILABILITY_TIMEOUT_MS);

      const response = await fetch(`${this.config.host}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.debug(
          `Ollama API returned ${String(response.status)}`,
          'ollama',
        );
        return false;
      }

      const data = (await response.json()) as { models?: { name: string }[] };

      if (!data.models || !Array.isArray(data.models)) {
        logger.debug('Ollama returned invalid model list', 'ollama');
        return false;
      }

      // Check if the configured model is available
      const modelAvailable = data.models.some((model) =>
        model.name.includes(this.config.model),
      );

      if (modelAvailable) {
        logger.debug(
          `Model ${this.config.model} available (${String(data.models.length)} models found)`,
          'ollama',
        );
      } else {
        logger.debug(
          `Model ${this.config.model} not found in available models`,
          'ollama',
        );
      }

      return modelAvailable;
    } catch {
      // Network errors, timeouts, or JSON parse errors all indicate unavailability
      logger.debug('Ollama connection failed', 'ollama');
      return false;
    }
  }

  /**
   * Analyzes prompts using the Ollama service.
   * Implements retry logic with exponential backoff for network errors.
   *
   * @param prompts - Array of prompt strings to analyze
   * @param date - Date context for the analysis
   * @param context - Optional project context for analysis
   * @returns Promise resolving to AnalysisResult
   * @throws Error if analysis fails after retries or if response is invalid
   */
  public async analyze(
    prompts: readonly string[],
    date: string,
    context?: ProjectContext,
  ): Promise<AnalysisResult> {
    if (prompts.length === 0) {
      throw new Error('Cannot analyze empty prompts array');
    }

    const userPrompt = buildUserPrompt(prompts, date, context);
    const systemPrompt =
      this.schemaType === 'minimal'
        ? SYSTEM_PROMPT_MINIMAL
        : SYSTEM_PROMPT_FULL;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, ANALYSIS_TIMEOUT_MS);

        const response = await fetch(`${this.config.host}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            prompt: userPrompt,
            system: systemPrompt,
            stream: false,
            format: 'json',
            options: {
              temperature: 0.3,
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const status = String(response.status);
          throw new Error(
            `Ollama API request failed: ${status} ${response.statusText}`,
          );
        }

        const data = (await response.json()) as { response?: string };

        if (typeof data.response !== 'string') {
          throw new Error('Invalid response format from Ollama API');
        }

        // Parse and validate the response
        return parseResponse(data.response, date);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry parse errors - they won't succeed on retry
        if (
          lastError.message.includes('parse') ||
          lastError.message.includes('schema')
        ) {
          throw lastError;
        }

        // If this was the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        logger.debug(
          `Retry attempt ${String(attempt + 1)}/${String(MAX_RETRIES)}, waiting ${String(delay)}ms`,
          'ollama',
        );
        await sleep(delay);
      }
    }

    const attempts = String(MAX_RETRIES + 1);
    throw new Error(
      `Ollama analysis failed after ${attempts} attempts: ${lastError?.message ?? 'Unknown error'}`,
    );
  }
}

/**
 * Sleep utility for retry backoff.
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
