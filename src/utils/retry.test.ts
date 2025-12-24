import { describe, expect, it, vi } from 'vitest';

import { isTransientError, withRetry } from './retry.js';

describe('isTransientError', () => {
  it('returns true for network errors', () => {
    expect(isTransientError(new Error('network error'))).toBe(true);
    expect(isTransientError(new Error('Network request failed'))).toBe(true);
  });

  it('returns true for timeout errors', () => {
    expect(isTransientError(new Error('Request timeout'))).toBe(true);
    expect(isTransientError(new Error('Connection timeout'))).toBe(true);
  });

  it('returns true for connection reset errors', () => {
    expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
    expect(isTransientError(new Error('econnreset: connection reset'))).toBe(
      true,
    );
  });

  it('returns true for connection refused errors', () => {
    expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
  });

  it('returns true for DNS errors', () => {
    expect(isTransientError(new Error('ENOTFOUND'))).toBe(true);
  });

  it('returns true for abort errors', () => {
    expect(isTransientError(new Error('The operation was aborted'))).toBe(true);
  });

  it('returns true for 5xx server errors', () => {
    expect(isTransientError(new Error('Server error: 500'))).toBe(true);
    expect(isTransientError(new Error('Bad gateway: 502'))).toBe(true);
    expect(isTransientError(new Error('Service unavailable: 503'))).toBe(true);
    expect(isTransientError(new Error('Gateway timeout: 504'))).toBe(true);
  });

  it('returns true for rate limiting (429)', () => {
    expect(isTransientError(new Error('Rate limited: 429'))).toBe(true);
    expect(isTransientError(new Error('Too many requests 429'))).toBe(true);
  });

  it('returns false for auth errors (401, 403)', () => {
    expect(isTransientError(new Error('Unauthorized: 401'))).toBe(false);
    expect(isTransientError(new Error('Forbidden: 403'))).toBe(false);
  });

  it('returns false for parse errors', () => {
    expect(isTransientError(new Error('JSON parse error'))).toBe(false);
    expect(isTransientError(new Error('Failed to parse response'))).toBe(false);
  });

  it('returns false for schema errors', () => {
    expect(isTransientError(new Error('Schema validation failed'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isTransientError('string error')).toBe(false);
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError({ message: 'error' })).toBe(false);
  });

  it('returns false for generic errors without transient indicators', () => {
    expect(isTransientError(new Error('Something went wrong'))).toBe(false);
    expect(isTransientError(new Error('Invalid input'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('returns result on first attempt success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on transient error and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times before succeeding', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws immediately on non-transient error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('parse error'));

    await expect(withRetry(fn)).rejects.toThrow('parse error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      withRetry(fn, { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('network error');

    // Initial attempt + 2 retries = 3 total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('calculates exponential backoff correctly', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));

    // We can verify the delays indirectly by checking the timing pattern
    // with very short delays to make the test fast
    const startTime = Date.now();
    await expect(
      withRetry(fn, {
        maxRetries: 3,
        baseDelayMs: 10,
        maxDelayMs: 1000,
      }),
    ).rejects.toThrow('network error');
    const elapsed = Date.now() - startTime;

    // With baseDelayMs=10 and 3 retries: 10 + 20 + 40 = 70ms minimum
    // Give some buffer for execution time
    expect(elapsed).toBeGreaterThanOrEqual(50);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('respects maxDelayMs cap', async () => {
    const startTime = Date.now();
    const fn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      withRetry(fn, {
        maxRetries: 2,
        baseDelayMs: 100,
        maxDelayMs: 50, // Cap at 50ms
      }),
    ).rejects.toThrow('network error');

    const elapsed = Date.now() - startTime;

    // With baseDelayMs=100 and maxDelayMs=50, delays are capped:
    // attempt 0: min(100*1, 50) = 50ms
    // attempt 1: min(100*2, 50) = 50ms
    // Total: 100ms max (plus execution overhead)
    expect(elapsed).toBeLessThan(200);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses custom isRetryable function', async () => {
    const customIsRetryable = vi.fn().mockReturnValue(true);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom error'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, {
      isRetryable: customIsRetryable,
      baseDelayMs: 1,
      maxDelayMs: 10,
    });

    expect(result).toBe('success');
    expect(customIsRetryable).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'custom error' }),
    );
  });

  it('uses default options when none provided', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('network error'));

    await expect(
      withRetry(fn, { baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('network error');

    // Default maxRetries is 3, so 4 total attempts
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('handles async function that throws', async () => {
    const fn = vi.fn().mockImplementation(() => {
      return Promise.reject(new Error('async error 503'));
    });

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow('async error 503');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('preserves error type on final throw', async () => {
    class CustomError extends Error {
      constructor(
        message: string,
        public readonly code: number,
      ) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const customError = new CustomError('Server error 500', 500);
    const fn = vi.fn().mockRejectedValue(customError);

    await expect(
      withRetry(fn, { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10 }),
    ).rejects.toThrow(customError);
  });

  it('does not retry when isRetryable returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('custom error'));

    await expect(
      withRetry(fn, {
        isRetryable: () => false,
        maxRetries: 3,
      }),
    ).rejects.toThrow('custom error');

    // Should not retry since isRetryable returns false
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
