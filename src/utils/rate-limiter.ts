/**
 * Rate limiter utility for cloud provider API calls.
 *
 * Prevents 429 rate limit errors by throttling requests
 * to stay within provider-defined limits.
 */

/**
 * Configuration options for rate limiting.
 */
type RateLimiterOptions = {
  /** Maximum requests per minute allowed */
  requestsPerMinute: number;
};

/**
 * Rate limiter instance with throttle function.
 */
type RateLimiter = {
  /**
   * Wraps a function to respect rate limits.
   * Delays execution if necessary to stay within limits.
   *
   * @param fn - The async function to throttle
   * @returns Promise resolving to the function result
   */
  throttle: <T>(fn: () => Promise<T>) => Promise<T>;

  /**
   * Resets the rate limiter state.
   * Useful for testing or when starting a new batch.
   */
  reset: () => void;
};

/**
 * Creates a rate limiter that enforces a maximum request rate.
 *
 * The limiter uses a simple interval-based approach:
 * - Tracks the last request time
 * - Delays new requests to maintain the minimum interval
 * - Ensures requests are spaced evenly within the rate limit
 *
 * @param options - Rate limiting configuration
 * @returns RateLimiter instance
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter({ requestsPerMinute: 50 });
 *
 * // These calls will be spaced at least 1.2 seconds apart
 * const result1 = await limiter.throttle(() => fetch('/api/1'));
 * const result2 = await limiter.throttle(() => fetch('/api/2'));
 * ```
 */
function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  const minIntervalMs = 60000 / options.requestsPerMinute;
  let lastRequestTime = 0;

  async function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (lastRequestTime > 0 && timeSinceLastRequest < minIntervalMs) {
      const waitTime = minIntervalMs - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
    return fn();
  }

  function reset(): void {
    lastRequestTime = 0;
  }

  return { throttle, reset };
}

/**
 * Default rate limits for cloud providers (requests per minute).
 * Conservative values to avoid hitting rate limits.
 */
const DEFAULT_RATE_LIMITS = {
  anthropic: 50,
  google: 50,
} as const;

export {
  createRateLimiter,
  DEFAULT_RATE_LIMITS,
  type RateLimiter,
  type RateLimiterOptions,
};
