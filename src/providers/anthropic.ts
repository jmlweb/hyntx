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
} from '../types/index.js';
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse } from './base.js';

/**
 * Maximum number of retry attempts for network errors.
 */
const MAX_RETRIES = 2;

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
const BASE_RETRY_DELAY_MS = 1000;

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

  /**
   * Creates a new AnthropicProvider instance.
   *
   * @param config - Anthropic configuration with model and API key
   */
  constructor(config: AnthropicConfig) {
    this.config = config;
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
      return false;
    }

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
      return response.ok || response.status === 429 || response.status === 400;
    } catch {
      // Network errors, timeouts, or other issues indicate unavailability
      return false;
    }
  }

  /**
   * Analyzes prompts using the Anthropic Claude API.
   * Implements retry logic with exponential backoff for network errors.
   *
   * @param prompts - Array of prompt strings to analyze
   * @param date - Date context for the analysis
   * @returns Promise resolving to AnalysisResult
   * @throws Error if analysis fails after retries or if response is invalid
   */
  public async analyze(
    prompts: readonly string[],
    date: string,
  ): Promise<AnalysisResult> {
    if (prompts.length === 0) {
      throw new Error('Cannot analyze empty prompts array');
    }

    const userPrompt = buildUserPrompt(prompts, date);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, ANALYSIS_TIMEOUT_MS);

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
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

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
        return parseResponse(textContent.text, date);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry parse errors - they won't succeed on retry
        if (
          lastError.message.includes('parse') ||
          lastError.message.includes('schema')
        ) {
          throw lastError;
        }

        // Don't retry auth errors
        if (
          lastError.message.includes('401') ||
          lastError.message.includes('403')
        ) {
          throw lastError;
        }

        // If this was the last attempt, throw the error
        if (attempt === MAX_RETRIES) {
          break;
        }

        // Exponential backoff: 1s, 2s, 4s, ...
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        await sleep(delay);
      }
    }

    const attempts = String(MAX_RETRIES + 1);
    throw new Error(
      `Anthropic analysis failed after ${attempts} attempts: ${lastError?.message ?? 'Unknown error'}`,
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
