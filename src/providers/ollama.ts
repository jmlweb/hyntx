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
} from '../types/index.js';
import { SYSTEM_PROMPT, buildUserPrompt, parseResponse } from './base.js';

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
 * Ollama provider for local AI analysis.
 * Implements the AnalysisProvider interface for Ollama instances.
 */
export class OllamaProvider implements AnalysisProvider {
  public readonly name = 'Ollama';
  private readonly config: OllamaConfig;

  /**
   * Creates a new OllamaProvider instance.
   *
   * @param config - Ollama configuration with model and host
   */
  constructor(config: OllamaConfig) {
    this.config = config;
  }

  /**
   * Checks if the Ollama service is available and has the required model.
   * Uses a 3-second timeout to avoid hanging on unreachable services.
   *
   * @returns Promise that resolves to true if available, false otherwise
   */
  public async isAvailable(): Promise<boolean> {
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
        return false;
      }

      const data = (await response.json()) as { models?: { name: string }[] };

      if (!data.models || !Array.isArray(data.models)) {
        return false;
      }

      // Check if the configured model is available
      return data.models.some((model) =>
        model.name.includes(this.config.model),
      );
    } catch {
      // Network errors, timeouts, or JSON parse errors all indicate unavailability
      return false;
    }
  }

  /**
   * Analyzes prompts using the Ollama service.
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

        const response = await fetch(`${this.config.host}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: this.config.model,
            prompt: userPrompt,
            system: SYSTEM_PROMPT,
            stream: false,
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
