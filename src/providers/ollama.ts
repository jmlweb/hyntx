/**
 * Ollama AI provider implementation with improved retry and validation.
 */

import {
  type AnalysisProvider,
  type AnalysisResult,
  BATCH_STRATEGIES,
  type BatchStrategyType,
  type OllamaConfig,
  type ProjectContext,
  type ProviderLimits,
  type SchemaType,
} from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import {
  validateSemantics,
  autoCorrectResult,
} from '../core/semantic-validator.js';
import {
  buildUserPrompt,
  parseBatchIndividualResponse,
  parseResponse,
} from './base.js';
import {
  SYSTEM_PROMPT_BATCH_INDIVIDUAL,
  SYSTEM_PROMPT_FULL,
  SYSTEM_PROMPT_MINIMAL,
} from './schemas.js';

const MAX_RETRIES = 2;
const TEMPERATURE_LEVELS = [0.3, 0.1, 0.0] as const;
const AVAILABILITY_TIMEOUT_MS = 3000;
const ANALYSIS_TIMEOUT_MS = 60000;
const BASE_RETRY_DELAY_MS = 1000;

const MODEL_STRATEGY_MAP: Record<string, BatchStrategyType> = {
  'llama3.2': 'micro',
  'phi3:mini': 'micro',
  'gemma3:4b': 'micro',
  'gemma2:2b': 'micro',
  'mistral:7b': 'small',
  'llama3:8b': 'small',
  'codellama:7b': 'small',
  'llama3:70b': 'standard',
  mixtral: 'standard',
  'qwen2.5:14b': 'standard',
};

export function detectBatchStrategy(modelName: string): BatchStrategyType {
  if (MODEL_STRATEGY_MAP[modelName]) return MODEL_STRATEGY_MAP[modelName];
  for (const [pattern, strategy] of Object.entries(MODEL_STRATEGY_MAP)) {
    if (modelName.includes(pattern)) return strategy;
  }
  return 'micro';
}

export class OllamaProvider implements AnalysisProvider {
  public readonly name = 'Ollama';
  private readonly config: OllamaConfig;
  private readonly batchStrategy: BatchStrategyType;
  private readonly schemaType: SchemaType;

  constructor(config: OllamaConfig) {
    this.config = config;
    this.batchStrategy = detectBatchStrategy(config.model);
    this.schemaType = this.selectSchemaType();
    const strategy = BATCH_STRATEGIES[this.batchStrategy];
    logger.debug(
      `Detected strategy: ${this.batchStrategy} (${strategy.description}), schema: ${this.schemaType}`,
      'ollama',
    );
  }

  private selectSchemaType(): SchemaType {
    if (this.config.schemaOverride) {
      return this.config.schemaOverride === 'individual'
        ? 'individual'
        : 'full';
    }
    return ['micro', 'small'].includes(this.batchStrategy)
      ? 'individual'
      : 'full';
  }

  public getBatchLimits(): ProviderLimits {
    const strategy = BATCH_STRATEGIES[this.batchStrategy];
    const maxPromptsPerBatch =
      this.schemaType === 'individual' ? 1 : strategy.maxPromptsPerBatch;
    return {
      maxTokensPerBatch: strategy.maxTokensPerBatch,
      maxPromptsPerBatch,
      prioritization: 'longest-first',
    };
  }

  public async isAvailable(): Promise<boolean> {
    logger.debug(`Connecting to Ollama at ${this.config.host}`, 'ollama');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        AVAILABILITY_TIMEOUT_MS,
      );
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
      const modelAvailable = data.models.some((m) =>
        m.name.includes(this.config.model),
      );
      logger.debug(
        modelAvailable
          ? `Model ${this.config.model} available`
          : `Model ${this.config.model} not found`,
        'ollama',
      );
      return modelAvailable;
    } catch {
      logger.debug('Ollama connection failed', 'ollama');
      return false;
    }
  }

  /**
   * Analyzes prompts with temperature fallback and semantic validation.
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
      this.schemaType === 'individual'
        ? SYSTEM_PROMPT_BATCH_INDIVIDUAL
        : this.schemaType === 'minimal'
          ? SYSTEM_PROMPT_MINIMAL
          : SYSTEM_PROMPT_FULL;

    let lastError: Error | undefined;
    let lastParseError: Error | undefined;

    // Outer loop: network retries
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Inner loop: temperature fallback for parse errors
      for (const temperature of TEMPERATURE_LEVELS) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(
            () => controller.abort(),
            ANALYSIS_TIMEOUT_MS,
          );

          const response = await fetch(`${this.config.host}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: this.config.model,
              prompt: userPrompt,
              system: systemPrompt,
              stream: false,
              format: 'json',
              options: { temperature },
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(
              `Ollama API failed: ${response.status} ${response.statusText}`,
            );
          }

          const data = (await response.json()) as { response?: string };
          if (typeof data.response !== 'string') {
            throw new Error('Invalid response format from Ollama API');
          }

          // Parse response
          let result: AnalysisResult;
          if (this.schemaType === 'individual') {
            result = parseBatchIndividualResponse(data.response, date, prompts);
          } else {
            result = parseResponse(data.response, date, undefined, prompts);
          }

          // Semantic validation
          const validation = validateSemantics(result, prompts);
          if (!validation.valid) {
            logger.debug(
              'Semantic validation failed, attempting auto-correction',
              'ollama',
            );
            result = autoCorrectResult(result, validation);
          }

          return result;
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));

          // Parse errors: try lower temperature
          if (err.message.includes('parse') || err.message.includes('schema')) {
            lastParseError = err;
            logger.debug(
              `Parse failed at temp ${temperature}, trying lower`,
              'ollama',
            );
            continue; // Try next temperature
          }

          // Network errors: break inner loop, retry outer
          lastError = err;
          break;
        }
      }

      // If we exhausted temperatures due to parse errors, throw
      if (lastParseError && !lastError) {
        throw lastParseError;
      }

      // If this was the last network retry, break
      if (attempt === MAX_RETRIES) break;

      // Exponential backoff for network errors
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
      logger.debug(
        `Retry ${attempt + 1}/${MAX_RETRIES}, waiting ${delay}ms`,
        'ollama',
      );
      await sleep(delay);
    }

    throw new Error(
      `Ollama analysis failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message ?? lastParseError?.message ?? 'Unknown error'}`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
