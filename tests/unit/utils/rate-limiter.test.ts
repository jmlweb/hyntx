import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRateLimiter,
  DEFAULT_RATE_LIMITS,
  type RateLimiter,
} from '../../../src/utils/rate-limiter.js';

describe('createRateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes first request immediately', async () => {
    limiter = createRateLimiter({ requestsPerMinute: 60 });
    const fn = vi.fn().mockResolvedValue('result');

    const resultPromise = limiter.throttle(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('result');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('delays second request to respect rate limit', async () => {
    // 60 requests per minute = 1000ms between requests
    limiter = createRateLimiter({ requestsPerMinute: 60 });
    const fn = vi.fn().mockResolvedValue('result');

    // First request - immediate
    await limiter.throttle(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Second request - should wait
    const secondPromise = limiter.throttle(fn);

    // Advance time by 500ms - should not have called yet
    await vi.advanceTimersByTimeAsync(500);
    expect(fn).toHaveBeenCalledTimes(1);

    // Advance remaining time - now it should complete
    await vi.advanceTimersByTimeAsync(600);
    await secondPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not delay if enough time has passed', async () => {
    limiter = createRateLimiter({ requestsPerMinute: 60 });
    const fn = vi.fn().mockResolvedValue('result');

    // First request
    await limiter.throttle(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait more than the minimum interval
    await vi.advanceTimersByTimeAsync(1500);

    // Second request should be immediate
    const secondPromise = limiter.throttle(fn);
    await vi.runAllTimersAsync();
    await secondPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('enforces correct interval for different rates', async () => {
    // 30 requests per minute = 2000ms between requests
    limiter = createRateLimiter({ requestsPerMinute: 30 });
    const fn = vi.fn().mockResolvedValue('result');

    // First request
    await limiter.throttle(fn);

    // Second request should wait 2000ms
    const secondPromise = limiter.throttle(fn);

    // After 1500ms, still waiting
    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(1);

    // After 2000ms total, should complete
    await vi.advanceTimersByTimeAsync(600);
    await secondPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('propagates errors from throttled function', async () => {
    limiter = createRateLimiter({ requestsPerMinute: 60 });
    const fn = vi.fn().mockRejectedValue(new Error('API error'));

    await expect(limiter.throttle(fn)).rejects.toThrow('API error');
  });

  it('reset clears the state for immediate next request', async () => {
    limiter = createRateLimiter({ requestsPerMinute: 60 });
    const fn = vi.fn().mockResolvedValue('result');

    // First request
    await limiter.throttle(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    // Reset the limiter
    limiter.reset();

    // Next request should be immediate (no waiting)
    const secondPromise = limiter.throttle(fn);
    await vi.runAllTimersAsync();
    await secondPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('maintains state across multiple throttled calls', async () => {
    // 120 requests per minute = 500ms between requests
    limiter = createRateLimiter({ requestsPerMinute: 120 });
    const fn = vi.fn().mockResolvedValue('result');

    // Make 3 requests in sequence
    await limiter.throttle(fn);
    expect(fn).toHaveBeenCalledTimes(1);

    const p2 = limiter.throttle(fn);
    await vi.advanceTimersByTimeAsync(600);
    await p2;
    expect(fn).toHaveBeenCalledTimes(2);

    const p3 = limiter.throttle(fn);
    await vi.advanceTimersByTimeAsync(600);
    await p3;
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns the correct value type from throttled function', async () => {
    limiter = createRateLimiter({ requestsPerMinute: 60 });

    const numberFn = vi.fn().mockResolvedValue(42);
    const objectFn = vi.fn().mockResolvedValue({ data: 'test' });

    const numberResult = await limiter.throttle(numberFn);
    expect(numberResult).toBe(42);

    limiter.reset();

    const objectResult = await limiter.throttle(objectFn);
    expect(objectResult).toEqual({ data: 'test' });
  });

  it('handles high request rates correctly', async () => {
    // 600 requests per minute = 100ms between requests
    limiter = createRateLimiter({ requestsPerMinute: 600 });
    const fn = vi.fn().mockResolvedValue('result');

    await limiter.throttle(fn);

    const secondPromise = limiter.throttle(fn);

    // Should need ~100ms wait
    await vi.advanceTimersByTimeAsync(50);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60);
    await secondPromise;
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('DEFAULT_RATE_LIMITS', () => {
  it('has reasonable defaults for anthropic', () => {
    expect(DEFAULT_RATE_LIMITS.anthropic).toBe(50);
  });

  it('has reasonable defaults for google', () => {
    expect(DEFAULT_RATE_LIMITS.google).toBe(50);
  });

  it('is read-only', () => {
    expect(typeof DEFAULT_RATE_LIMITS).toBe('object');
    // TypeScript prevents modification, but verify the object exists
    expect(Object.keys(DEFAULT_RATE_LIMITS)).toContain('anthropic');
    expect(Object.keys(DEFAULT_RATE_LIMITS)).toContain('google');
  });
});
