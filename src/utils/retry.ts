/**
 * Retry utility with exponential backoff.
 *
 * Provides a reusable retry mechanism for transient failures
 * in network operations and API calls.
 */

/**
 * Configuration options for retry behavior.
 */
type RetryOptions = {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in milliseconds before first retry (default: 1000) */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds (default: 30000) */
  maxDelayMs: number;
  /** Function to determine if an error should trigger a retry */
  isRetryable: (error: unknown) => boolean;
};

/**
 * Default retry options.
 */
const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  isRetryable: isTransientError,
};

/**
 * Determines if an error is transient and should be retried.
 *
 * Transient errors include:
 * - Network errors (connection reset, timeout)
 * - Server errors (5xx status codes)
 * - Rate limiting (429 status)
 *
 * Non-transient errors (should NOT retry):
 * - Client errors (4xx except 429)
 * - Parse/schema validation errors
 * - Authentication errors (401, 403)
 *
 * @param error - The error to evaluate
 * @returns true if the error is transient and should be retried
 */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();

  // Network and timeout errors - always retry
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('abort')
  ) {
    return true;
  }

  // Server errors (5xx) - retry
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504')
  ) {
    return true;
  }

  // Rate limiting - retry with backoff
  if (message.includes('429')) {
    return true;
  }

  // Auth errors - don't retry
  if (message.includes('401') || message.includes('403')) {
    return false;
  }

  // Parse/schema errors - don't retry
  if (message.includes('parse') || message.includes('schema')) {
    return false;
  }

  return false;
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

/**
 * Executes a function with retry logic and exponential backoff.
 *
 * @param fn - The async function to execute
 * @param options - Optional retry configuration
 * @returns Promise resolving to the function result
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const isLastAttempt = attempt === opts.maxRetries;
      const shouldRetry = opts.isRetryable(error);

      if (isLastAttempt || !shouldRetry) {
        throw error;
      }

      // Calculate delay with exponential backoff: baseDelay * 2^attempt
      // attempt 0: 1s, attempt 1: 2s, attempt 2: 4s, etc.
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs,
      );

      await sleep(delay);
    }
  }

  // This should never be reached due to the throw in the loop,
  // but TypeScript needs it for type safety
  throw lastError;
}

export { isTransientError, type RetryOptions, sleep, withRetry };
