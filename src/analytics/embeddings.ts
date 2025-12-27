/**
 * Ollama Embeddings Client
 *
 * Provides client for generating text embeddings using Ollama's local models.
 * Supports batch processing and error handling for embedding generation.
 */

import { logger } from '../utils/logger-base.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for Ollama embeddings client.
 */
export type EmbeddingConfig = {
  readonly host: string;
  readonly model: string;
  readonly batchSize: number;
  readonly timeoutMs: number;
};

/**
 * Response from Ollama embeddings API.
 */
type OllamaEmbeddingResponse = {
  readonly embedding: number[];
};

// =============================================================================
// Defaults
// =============================================================================

const DEFAULT_CONFIG: EmbeddingConfig = {
  host: 'http://localhost:11434',
  model: 'nomic-embed-text',
  batchSize: 10,
  timeoutMs: 30000,
} as const;

// =============================================================================
// Main Class
// =============================================================================

/**
 * Client for generating embeddings using Ollama's local models.
 *
 * @example
 * ```typescript
 * const client = new OllamaEmbeddingClient();
 * const available = await client.isAvailable();
 *
 * if (available) {
 *   const embedding = await client.generateEmbedding("Hello world");
 *   console.log(embedding.length); // 768 for nomic-embed-text
 * }
 * ```
 */
export class OllamaEmbeddingClient {
  private readonly config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Check if Ollama is available and the embedding model is loaded.
   *
   * @returns True if Ollama is available, false otherwise
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, 5000);

      const response = await fetch(`${this.config.host}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return false;
      }

      const data = (await response.json()) as { models?: { name: string }[] };
      const modelName = this.config.model;

      // Check if the model exists in the list
      const hasModel = data.models?.some((m) => m.name === modelName) ?? false;

      if (!hasModel) {
        const modelNames = data.models?.map((m) => m.name) ?? [];
        logger.debug(
          `Embedding model '${modelName}' not found in Ollama. Available models: ${modelNames.join(', ')}`,
        );
      }

      return hasModel;
    } catch {
      return false;
    }
  }

  /**
   * Generate embedding for a single text.
   *
   * @param text - Text to generate embedding for
   * @returns Embedding vector (768-dimensional for nomic-embed-text)
   * @throws Error if Ollama is not available or request fails
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.config.timeoutMs);

    try {
      const response = await fetch(`${this.config.host}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt: text,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(
          `Ollama embeddings request failed: ${response.statusText}`,
        );
      }

      const data = (await response.json()) as OllamaEmbeddingResponse;
      return data.embedding;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(
          `Ollama embeddings request timed out after ${String(this.config.timeoutMs)}ms`,
        );
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batches.
   *
   * Processes texts in batches to avoid overwhelming Ollama.
   * Failed embeddings are logged but don't stop the batch.
   *
   * @param texts - Array of texts to generate embeddings for
   * @param batchSize - Optional batch size override
   * @returns Array of embeddings (same length as input, null for failed items)
   *
   * @example
   * ```typescript
   * const texts = ["prompt 1", "prompt 2", "prompt 3"];
   * const embeddings = await client.generateBatchEmbeddings(texts);
   * console.log(embeddings.length); // 3
   * ```
   */
  async generateBatchEmbeddings(
    texts: readonly string[],
    batchSize?: number,
  ): Promise<(number[] | null)[]> {
    const actualBatchSize = batchSize ?? this.config.batchSize;
    const results: (number[] | null)[] = [];

    for (let i = 0; i < texts.length; i += actualBatchSize) {
      const batch = texts.slice(i, i + actualBatchSize);
      const batchResults = await Promise.allSettled(
        batch.map((text) => this.generateEmbedding(text)),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          const errorMessage =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          logger.debug(`Failed to generate embedding: ${errorMessage}`);
          results.push(null);
        }
      }

      // Small delay between batches to avoid overloading Ollama
      if (i + actualBatchSize < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): EmbeddingConfig {
    return { ...this.config };
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new Ollama embeddings client with optional configuration.
 *
 * @param config - Optional configuration overrides
 * @returns New OllamaEmbeddingClient instance
 */
export function createEmbeddingClient(
  config?: Partial<EmbeddingConfig>,
): OllamaEmbeddingClient {
  return new OllamaEmbeddingClient(config);
}
