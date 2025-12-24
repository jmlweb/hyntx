/**
 * Google AI provider implementation.
 *
 * This module provides integration with the Google Gemini API for prompt analysis.
 * Features include:
 * - Availability checking by validating API key
 * - Retry logic with exponential backoff for network errors
 * - Support for Gemini GenerateContent API
 */

import {
  type AnalysisProvider,
  type AnalysisResult,
  type GoogleConfig,
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
 * Google Generative AI API base URL.
 */
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Google provider for Gemini API analysis.
 * Implements the AnalysisProvider interface for Google's Gemini API.
 */
export class GoogleProvider implements AnalysisProvider {
  public readonly name = 'Google';
  private readonly config: GoogleConfig;

  /**
   * Creates a new GoogleProvider instance.
   *
   * @param config - Google configuration with model and API key
   */
  constructor(config: GoogleConfig) {
    this.config = config;
  }

  /**
   * Checks if the Google Gemini API is available by validating the API key.
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

      const url = `${API_BASE_URL}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      // Make a minimal request to validate the API key
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: 'Hi' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 1,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 200 = success, key is valid
      // 400 = bad request but key is valid
      // 401/403 = unauthorized, key is invalid
      // 429 = rate limited but key is valid
      return response.ok || response.status === 429 || response.status === 400;
    } catch {
      // Network errors, timeouts, or other issues indicate unavailability
      return false;
    }
  }

  /**
   * Analyzes prompts using the Google Gemini API.
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

        const url = `${API_BASE_URL}/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            systemInstruction: {
              parts: [{ text: SYSTEM_PROMPT }],
            },
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const status = String(response.status);
          const errorBody = await response.text();
          throw new Error(
            `Google API request failed: ${status} ${response.statusText} - ${errorBody}`,
          );
        }

        const data = (await response.json()) as {
          candidates?: {
            content?: {
              parts?: { text?: string }[];
            };
          }[];
        };

        // Extract text from the response content
        const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textContent) {
          throw new Error('Invalid response format from Google API');
        }

        // Parse and validate the response
        return parseResponse(textContent, date);
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
      `Google analysis failed after ${attempts} attempts: ${lastError?.message ?? 'Unknown error'}`,
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
