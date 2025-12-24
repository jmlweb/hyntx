# Add Rate Limiting for Cloud Providers

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: provider-factory.md
- **Estimation**: 1-2 hours

## Description

Add rate limiting for Anthropic and Google API calls to prevent 429 errors during batch processing. Currently, requests are made as fast as possible, which can trigger rate limits on cloud providers.

## Objective

Prevent rate limit errors by throttling API requests to stay within provider limits.

## Scope

- Includes: Creating rate limiter utility
- Includes: Integrating rate limiting in cloud providers
- Excludes: Ollama provider (local, no rate limits)
- Excludes: Dynamic rate adjustment based on 429 responses (future enhancement)

## Files to Create/Modify

- `src/utils/rate-limiter.ts` - New rate limiter utility
- `src/utils/rate-limiter.test.ts` - Tests
- `src/providers/anthropic.ts` - Integrate rate limiting
- `src/providers/google.ts` - Integrate rate limiting

## Implementation

### 1. Create Rate Limiter

```typescript
// src/utils/rate-limiter.ts
type RateLimiterOptions = {
  requestsPerMinute: number;
};

function createRateLimiter(options: RateLimiterOptions) {
  const minIntervalMs = 60000 / options.requestsPerMinute;
  let lastRequestTime = 0;

  return async function throttle<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;

    if (timeSinceLastRequest < minIntervalMs) {
      const waitTime = minIntervalMs - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    lastRequestTime = Date.now();
    return fn();
  };
}

export { createRateLimiter, type RateLimiterOptions };
```

### 2. Provider Rate Limits

Based on typical API limits:

```typescript
// Anthropic: ~60 requests per minute (conservative)
const anthropicLimiter = createRateLimiter({ requestsPerMinute: 50 });

// Google: ~60 requests per minute (conservative)
const googleLimiter = createRateLimiter({ requestsPerMinute: 50 });
```

### 3. Integrate in Providers

```typescript
// In provider class
private rateLimiter = createRateLimiter({ requestsPerMinute: 50 });

async analyze(prompts: string[], date: string): Promise<AnalysisResult> {
  // Wrap API call with rate limiter
  return this.rateLimiter(() => this.makeApiCall(prompts, date));
}
```

## Acceptance Criteria

- [ ] Rate limiter utility implemented
- [ ] Anthropic provider respects rate limits
- [ ] Google provider respects rate limits
- [ ] Rate is configurable per provider
- [ ] Tests verify throttling behavior
- [ ] No 429 errors during normal batch processing

## Test Cases

- Rapid requests are throttled to configured rate
- Single request doesn't wait
- Rate limiter state persists across calls
- Different providers can have different rates

## Configuration

Consider making rate limits configurable via environment variables:

```bash
HYNTX_ANTHROPIC_RPM=50
HYNTX_GOOGLE_RPM=50
```

## References

- Technical Validation Report (December 2024)
- Anthropic API rate limits documentation
- Google AI rate limits documentation
