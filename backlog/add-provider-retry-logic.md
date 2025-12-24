# Add Retry Logic with Exponential Backoff

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: provider-factory.md
- **Estimation**: 1-2 hours

## Description

Add retry logic with exponential backoff for transient network failures in cloud providers (Anthropic, Google). Currently, if a request fails, it fails immediately without retry.

## Objective

Improve reliability by automatically retrying transient failures with exponential backoff.

## Scope

- Includes: Adding retry utility function
- Includes: Integrating retry in Anthropic and Google providers
- Excludes: Ollama provider (local, different failure modes)
- Excludes: Rate limiting (separate task)

## Files to Create/Modify

- `src/utils/retry.ts` - New retry utility
- `src/utils/retry.test.ts` - Tests for retry logic
- `src/providers/anthropic.ts` - Integrate retry
- `src/providers/google.ts` - Integrate retry

## Implementation

### 1. Create Retry Utility

```typescript
// src/utils/retry.ts
type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: (error: unknown) => boolean;
};

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableErrors: isTransientError,
};

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors, timeouts, 5xx errors, 429 rate limits
    const message = error.message.toLowerCase();
    return (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      message.includes('429') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503') ||
      message.includes('504')
    );
  }
  return false;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxRetries || !opts.retryableErrors(error)) {
        throw error;
      }

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt),
        opts.maxDelayMs,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export { withRetry, isTransientError, type RetryOptions };
```

### 2. Integrate in Providers

```typescript
// In anthropic.ts and google.ts
import { withRetry } from '../utils/retry.js';

// Wrap fetch calls
const response = await withRetry(() =>
  fetch(url, options).then((res) => {
    if (!res.ok && res.status >= 500) {
      throw new Error(`Server error: ${res.status}`);
    }
    return res;
  }),
);
```

## Acceptance Criteria

- [ ] Retry utility implemented with exponential backoff
- [ ] Transient errors are automatically retried (up to 3 times)
- [ ] Non-transient errors fail immediately
- [ ] Delay doubles with each retry (1s, 2s, 4s)
- [ ] Maximum delay is capped at 30s
- [ ] Tests cover retry scenarios
- [ ] Anthropic provider uses retry
- [ ] Google provider uses retry

## Test Cases

- Retry on network error (succeeds on 2nd attempt)
- Retry on 503 error (succeeds on 3rd attempt)
- No retry on 400 error (client error)
- Maximum retries exceeded throws original error
- Exponential backoff timing is correct

## References

- Technical Validation Report (December 2024)
- AWS best practices for exponential backoff
