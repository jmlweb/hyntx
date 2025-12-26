/**
 * Anthropic AI provider implementation.
 *
 * This module provides integration with the Anthropic Claude API for prompt analysis.
 * Features include:
 * - Availability checking by validating API key
 * - Retry logic with exponential backoff for network errors
 * - Support for Claude Messages API
 */

import {
  type AnalysisProvider,
  type AnalysisResult,
  type AnthropicConfig,
  type ProjectContext,
} from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import {
  createRateLimiter,
  DEFAULT_RATE_LIMITS,
  type RateLimiter,
} from '../utils/rate-limiter.js';
import { isTransientError, withRetry } from '../utils/retry.js';
import { buildUserPrompt, parseResponse } from './base.js';
import { SYSTEM_PROMPT_FULL } from './schemas.js';

/**
 * Maximum number of retry attempts for network errors.
 */
const MAX_RETRIES = 3;

/**
 * Timeout for availability check (5 seconds).
 */
const AVAILABILITY_TIMEOUT_MS = 5000;

/**
 * Timeout for analysis request (60 seconds).
 */
const ANALYSIS_TIMEOUT_MS = 60000;

/**
 * Base delay for exponential backoff (1 second).
 */
const BASE_DELAY_MS = 1000;

/**
 * Maximum delay cap for exponential backoff (30 seconds).
 */
const MAX_DELAY_MS = 30000;

/**
 * Anthropic API base URL.
 */
const API_BASE_URL = 'https://api.anthropic.com';

/**
 * Anthropic API version.
 */
const API_VERSION = '2023-06-01';

/**
 * Maximum tokens for the response.
 */
const MAX_TOKENS = 4096;

/**
 * Anthropic provider for Claude API analysis.
 * Implements the AnalysisProvider interface for Anthropic's Claude API.
 */
export class AnthropicProvider implements AnalysisProvider {
  public readonly name = 'Anthropic';
  private readonly config: AnthropicConfig;
  private readonly rateLimiter: RateLimiter;

  /**
   * Creates a new AnthropicProvider instance.
   *
   * @param config - Anthropic configuration with model and API key
   */
  constructor(config: AnthropicConfig) {
    this.config = config;
    this.rateLimiter = createRateLimiter({
      requestsPerMinute: DEFAULT_RATE_LIMITS.anthropic,
    });
  }

  /**
   * Checks if the Anthropic API is available by validating the API key.
   * Makes a minimal request to verify the key is valid.
   *
   * @returns Promise that resolves to true if available, false otherwise
   */
  public async isAvailable(): Promise<boolean> {
    // If no API key is configured, provider is not available
    if (!this.config.apiKey) {
      logger.debug('No API key configured', 'anthropic');
      return false;
    }

    logger.debug(
      `Validating API key with model ${this.config.model}`,
      'anthropic',
    );

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, AVAILABILITY_TIMEOUT_MS);

      // Make a minimal request to validate the API key
      // We use a simple message that will be cheap to process
      const response = await fetch(`${API_BASE_URL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 200 = success, key is valid
      // 400 = bad request but key is valid
      // 401 = unauthorized, key is invalid
      // 403 = forbidden, key is invalid or lacks permissions
      // 429 = rate limited but key is valid
      const isAvailable =
        response.ok || response.status === 429 || response.status === 400;

      logger.debug(
        `API responded with status ${String(response.status)} (available: ${String(isAvailable)})`,
        'anthropic',
      );

      return isAvailable;
    } catch {
      // Network errors, timeouts, or other issues indicate unavailability
      logger.debug('Connection failed', 'anthropic');
      return false;
    }
  }

  /**
   * Analyzes prompts using the Anthropic Claude API.
   * Implements retry logic with exponential backoff for network errors.
   * Rate limited to prevent 429 errors during batch processing.
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

    return this.rateLimiter.throttle(() =>
      withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            controller.abort();
          }, ANALYSIS_TIMEOUT_MS);

          try {
            const response = await fetch(`${API_BASE_URL}/v1/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.config.apiKey,
                'anthropic-version': API_VERSION,
              },
              body: JSON.stringify({
                model: this.config.model,
                max_tokens: MAX_TOKENS,
                system: SYSTEM_PROMPT_FULL,
                messages: [{ role: 'user', content: userPrompt }],
              }),
              signal: controller.signal,
            });

            if (!response.ok) {
              const status = String(response.status);
              const errorBody = await response.text();
              throw new Error(
                `Anthropic API request failed: ${status} ${response.statusText} - ${errorBody}`,
              );
            }

            const data = (await response.json()) as {
              content?: { type: string; text?: string }[];
            };

            // Extract text from the response content
            const textContent = data.content?.find(
              (block) => block.type === 'text',
            );
            if (!textContent?.text) {
              throw new Error('Invalid response format from Anthropic API');
            }

            // Parse and validate the response
            return parseResponse(textContent.text, date, undefined, prompts);
          } finally {
            clearTimeout(timeoutId);
          }
        },
        {
          maxRetries: MAX_RETRIES,
          baseDelayMs: BASE_DELAY_MS,
          maxDelayMs: MAX_DELAY_MS,
          isRetryable: isTransientError,
        },
      ),
    );
  }
}
