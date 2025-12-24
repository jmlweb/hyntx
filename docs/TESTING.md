# Testing Strategy

## Overview

Hyntx uses Vitest for unit and integration testing with a focus on:

- Core business logic testing
- Provider behavior validation
- Edge case coverage
- Mocking external dependencies

---

## Test Structure

```text
hyntx/
├── src/
│   ├── core/
│   │   ├── log-reader.ts
│   │   └── log-reader.test.ts     # Co-located unit tests
│   └── ...
└── tests/
    ├── integration/               # Integration tests
    │   └── providers.test.ts
    └── fixtures/                  # Test data
        ├── sample-logs.jsonl
        └── mock-responses.json
```

---

## Running Tests

```bash
# Single run (unit tests only)
pnpm test

# Watch mode (development)
pnpm test:watch

# E2E tests (local-only, not run in CI)
pnpm test:e2e

# E2E tests in watch mode
pnpm test:e2e:watch

# All tests (unit + E2E)
pnpm test:all

# With coverage
pnpm test:coverage

# Specific file
pnpm test src/core/sanitizer.test.ts

# Pattern matching
pnpm test --grep "sanitizer"
```

**Note**: E2E tests (31 of 59 currently failing) are being actively improved. See `E2E_TEST_IMPLEMENTATION_NOTES.md` for status and implementation details.

---

## Test Categories

### Unit Tests

Test individual functions in isolation.

#### log-reader.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readLogs, parseDate, groupByDay } from './log-reader.js';

describe('parseDate', () => {
  it('parses "today" as current date', () => {
    const result = parseDate('today');
    expect(result.toDateString()).toBe(new Date().toDateString());
  });

  it('parses "yesterday" correctly', () => {
    const result = parseDate('yesterday');
    const expected = new Date();
    expected.setDate(expected.getDate() - 1);
    expect(result.toDateString()).toBe(expected.toDateString());
  });

  it('parses ISO date string', () => {
    const result = parseDate('2025-01-20');
    expect(result.toISOString().startsWith('2025-01-20')).toBe(true);
  });

  it('throws on invalid date', () => {
    expect(() => parseDate('invalid')).toThrow('Invalid date format');
  });
});

describe('groupByDay', () => {
  it('groups prompts by date', () => {
    const prompts = [
      {
        content: 'a',
        timestamp: new Date('2025-01-20'),
        sessionId: '1',
        projectName: 'app',
      },
      {
        content: 'b',
        timestamp: new Date('2025-01-20'),
        sessionId: '1',
        projectName: 'app',
      },
      {
        content: 'c',
        timestamp: new Date('2025-01-21'),
        sessionId: '2',
        projectName: 'app',
      },
    ];

    const groups = groupByDay(prompts);

    expect(groups).toHaveLength(2);
    expect(groups[0].prompts).toHaveLength(2);
    expect(groups[1].prompts).toHaveLength(1);
  });
});
```

#### sanitizer.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { sanitize, sanitizePrompts } from './sanitizer.js';

describe('sanitize', () => {
  it('redacts OpenAI API keys', () => {
    const input = 'Use key sk-abc123def456ghi789jkl012mno345pqr678';
    const { text, redacted } = sanitize(input);

    expect(text).toBe('Use key [REDACTED_KEY]');
    expect(redacted).toBe(1);
  });

  it('redacts Anthropic API keys', () => {
    const input = 'Key: sk-ant-api03-abc123-xyz789';
    const { text } = sanitize(input);

    expect(text).toBe('Key: [REDACTED_KEY]');
  });

  it('redacts AWS access keys', () => {
    const input = 'AWS key: AKIAIOSFODNN7EXAMPLE';
    const { text } = sanitize(input);

    expect(text).toBe('AWS key: [REDACTED_AWS]');
  });

  it('redacts Bearer tokens', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const { text } = sanitize(input);

    expect(text).toBe('Authorization: Bearer [REDACTED]');
  });

  it('redacts credentials in URLs', () => {
    const input = 'Connect to https://user:password@api.example.com';
    const { text } = sanitize(input);

    expect(text).toBe('Connect to https://[REDACTED]@api.example.com');
  });

  it('redacts email addresses', () => {
    const input = 'Contact user@example.com for help';
    const { text } = sanitize(input);

    expect(text).toBe('Contact [REDACTED_EMAIL] for help');
  });

  it('handles multiple secrets', () => {
    const input = 'Key: sk-abc123 Email: user@test.com';
    const { redacted } = sanitize(input);

    expect(redacted).toBe(2);
  });

  it('returns original text when no secrets', () => {
    const input = 'Regular text without secrets';
    const { text, redacted } = sanitize(input);

    expect(text).toBe(input);
    expect(redacted).toBe(0);
  });
});
```

#### analyzer.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { batchPrompts } from './analyzer.js';

describe('batchPrompts', () => {
  const limits = {
    maxTokensPerBatch: 100,
    prioritization: 'chronological' as const,
  };

  it('returns single batch for small input', () => {
    const prompts = ['short prompt', 'another one'];
    const batches = batchPrompts(prompts, limits);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual(prompts);
  });

  it('splits large input into multiple batches', () => {
    const prompts = [
      'a'.repeat(200), // ~50 tokens
      'b'.repeat(200), // ~50 tokens
      'c'.repeat(200), // ~50 tokens
    ];
    const batches = batchPrompts(prompts, limits);

    expect(batches.length).toBeGreaterThan(1);
  });

  it('handles oversized single prompt', () => {
    const prompts = ['x'.repeat(1000)]; // Exceeds batch limit
    const batches = batchPrompts(prompts, limits);

    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(1);
  });

  it('applies longest-first prioritization', () => {
    const limits = {
      maxTokensPerBatch: 1000,
      prioritization: 'longest-first' as const,
    };
    const prompts = ['short', 'medium length', 'this is the longest prompt'];

    const batches = batchPrompts(prompts, limits);
    const firstBatch = batches[0];

    expect(firstBatch[0]).toBe('this is the longest prompt');
  });
});
```

#### schema-validator.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import {
  detectSchemaVersion,
  isSchemaSupported,
  getSchemaWarning,
} from './schema-validator.js';

describe('detectSchemaVersion', () => {
  it('detects v1.0 schema', () => {
    const message = {
      type: 'user',
      message: { role: 'user', content: 'test' },
      timestamp: '2025-01-20T10:00:00Z',
    };

    const version = detectSchemaVersion(message);

    expect(version).toEqual({ major: 1, minor: 0 });
  });

  it('returns null for unknown schema', () => {
    const message = { unknownField: 'value' };
    const version = detectSchemaVersion(message);

    expect(version).toBeNull();
  });
});

describe('isSchemaSupported', () => {
  it('returns true for v1.0', () => {
    expect(isSchemaSupported({ major: 1, minor: 0 })).toBe(true);
  });

  it('returns false for unknown version', () => {
    expect(isSchemaSupported({ major: 2, minor: 0 })).toBe(false);
  });

  it('returns false for null', () => {
    expect(isSchemaSupported(null)).toBe(false);
  });
});
```

### Integration Tests

Test module interactions and external dependencies.

#### providers.test.ts

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailableProvider } from '../src/providers/index.js';
import type { EnvConfig } from '../src/types/index.js';

describe('Provider Factory', () => {
  const mockConfig: EnvConfig = {
    services: ['ollama', 'anthropic'],
    ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
    anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-ant-test' },
    google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    reminder: '7d',
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns first available provider', async () => {
    // Mock fetch for Ollama availability check
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }] }),
    } as Response);

    const provider = await getAvailableProvider(mockConfig);

    expect(provider.name).toBe('ollama');
  });

  it('falls back to next provider when first unavailable', async () => {
    const fallbackSpy = vi.fn();

    // Ollama unavailable
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('Connection refused'),
    );

    const provider = await getAvailableProvider(mockConfig, fallbackSpy);

    expect(fallbackSpy).toHaveBeenCalledWith('ollama', 'anthropic');
    expect(provider.name).toBe('anthropic');
  });

  it('throws when all providers unavailable', async () => {
    const config: EnvConfig = {
      ...mockConfig,
      services: ['ollama'],
      anthropic: { ...mockConfig.anthropic, apiKey: '' },
    };

    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Unavailable'));

    await expect(getAvailableProvider(config)).rejects.toThrow(
      'All providers unavailable',
    );
  });
});
```

---

## Mocking Strategies

### Mocking Fetch

```typescript
import { vi } from 'vitest';

// Mock successful Ollama response
vi.spyOn(global, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({
    response: JSON.stringify({
      patterns: [],
      stats: { totalPrompts: 5, promptsWithIssues: 0, overallScore: 9 },
      topSuggestion: 'Great prompts!',
    }),
  }),
} as Response);
```

### Mocking File System

```typescript
import { vi } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

// Setup mock
vi.mocked(fs.existsSync).mockReturnValue(true);
vi.mocked(fs.readFileSync).mockReturnValue('{"type":"user",...}');
```

### Mocking Environment

```typescript
import { vi, beforeEach, afterEach } from 'vitest';

describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('reads HYNTX_SERVICES', () => {
    process.env.HYNTX_SERVICES = 'ollama,anthropic';
    // Import and test
  });
});
```

---

## Test Fixtures

### Sample JSONL Log

```json
{"type":"user","message":{"role":"user","content":"fix auth bug"},"timestamp":"2025-01-20T10:00:00Z","sessionId":"abc123","cwd":"/app"}
{"type":"assistant","message":{"role":"assistant","content":"I'll help..."},"timestamp":"2025-01-20T10:00:05Z","sessionId":"abc123","cwd":"/app"}
{"type":"user","message":{"role":"user","content":"add tests"},"timestamp":"2025-01-20T10:05:00Z","sessionId":"abc123","cwd":"/app"}
```

### Mock Provider Response

```json
{
  "patterns": [
    {
      "id": "missing_context",
      "name": "Missing Technical Context",
      "frequency": 0.5,
      "severity": "medium",
      "examples": ["fix auth bug"],
      "suggestion": "Add error messages",
      "beforeAfter": {
        "before": "fix auth bug",
        "after": "Fix auth bug in login.ts with JWT validation error"
      }
    }
  ],
  "stats": {
    "totalPrompts": 2,
    "promptsWithIssues": 1,
    "overallScore": 7.5
  },
  "topSuggestion": "Add more context"
}
```

---

## Edge Cases to Cover

### Date Handling

- Invalid date strings (`"not-a-date"`)
- Edge dates (year boundaries, leap years)
- Date range where `from > to`
- Empty date range (no prompts in period)

### Batching

- Single prompt exceeds batch limit
- Exactly at batch limit
- Empty prompt array
- Mix of very short and very long prompts

### Schema Validation

- Missing required fields
- Extra unknown fields
- Null values
- Malformed JSON lines

### Provider Failures

- Network timeout
- API rate limiting (429)
- Invalid API key (401)
- Server error (500)
- Partial response (truncated JSON)

### File System

- Missing `~/.claude/projects/`
- Empty project directories
- Corrupted JSONL files
- Permission denied
- Very large files (>100MB)

---

## Coverage Goals

| Category     | Target |
| ------------ | ------ |
| Core modules | 90%+   |
| Providers    | 80%+   |
| Utils        | 85%+   |
| Overall      | 85%+   |

### Viewing Coverage

```bash
# Generate coverage report
pnpm test:coverage

# Open HTML report
open coverage/index.html
```

---

## E2E Testing

End-to-end tests validate the complete application workflow from log reading to report generation. These tests are local-only and excluded from CI/CD to avoid dependency on real Claude Code logs.

### Test Structure

```text
tests/
├── e2e/                           # E2E tests (local-only)
│   ├── core.e2e.test.ts          # Core module integration
│   ├── providers.e2e.test.ts     # Provider selection & fallback
│   ├── cli.e2e.test.ts           # CLI workflow
│   └── edge-cases.e2e.test.ts    # Edge cases & error handling
├── helpers/                       # Test utilities
│   └── test-utils.ts             # Mock data generators
└── fixtures/                      # Test data
    ├── sample-logs.jsonl         # Sample log entries
    └── mock-responses.json       # Mock provider responses
```

### Running E2E Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run E2E tests in watch mode
pnpm test:e2e:watch

# Run both unit and E2E tests
pnpm test:all
```

### E2E Test Isolation

E2E tests use temporary directories and environment variables to ensure complete isolation:

- **Custom Claude Projects Directory**: Set via `HYNTX_CLAUDE_PROJECTS_DIR` env variable
- **Mocked Provider Responses**: All API calls are mocked to avoid real provider calls
- **Temporary File System**: Tests create and cleanup temp directories automatically
- **Module Reset**: Each test resets modules to prevent state leakage

### Example E2E Test

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTempDir,
  cleanupTempDir,
  createMockProjectsDir,
  createUserMessage,
  createMockProviderResponse,
  createMockAnalysis,
} from '../helpers/test-utils.js';

describe('Full Analysis Workflow', () => {
  let tempDir: string;
  let projectsDir: string;
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetModules();
    process.env = { ...originalEnv };
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should analyze prompts end-to-end', async () => {
    // Create mock project structure
    projectsDir = createMockProjectsDir(tempDir, {
      'test-project': [
        createUserMessage('fix bug', '2025-01-20T10:00:00.000Z'),
        createUserMessage('add tests', '2025-01-20T11:00:00.000Z'),
      ],
    });

    // Set custom projects directory
    process.env.HYNTX_CLAUDE_PROJECTS_DIR = projectsDir;
    process.env.HYNTX_SERVICES = 'ollama';

    // Mock provider response
    const mockAnalysis = createMockAnalysis();
    const mockResponse = createMockProviderResponse(mockAnalysis);
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse);

    // Import after setting env variables
    const { readLogs } = await import('../../src/core/log-reader.js');
    const { analyzePrompts } = await import('../../src/core/analyzer.js');

    // Execute workflow
    const logResult = await readLogs({ date: '2025-01-20' });
    const analysis = await analyzePrompts(logResult.prompts, '2025-01-20');

    // Verify results
    expect(analysis.patterns).toBeDefined();
    expect(analysis.stats.totalPrompts).toBe(2);
  });
});
```

### Test Helpers

The `tests/helpers/test-utils.ts` module provides utilities for:

#### Directory Management

```typescript
const tempDir = createTempDir(); // Creates temp directory
cleanupTempDir(tempDir); // Cleanup after test
```

#### Mock Data Generation

```typescript
// Create user message
const message = createUserMessage('content', '2025-01-20T10:00:00.000Z');

// Create conversation
const conversation = createConversation(5); // 5 turns

// Create multi-day logs
const logs = createMultiDayLogs(7, 10); // 7 days, 10 per day
```

#### Mock Project Structure

```typescript
const projectsDir = createMockProjectsDir(tempDir, {
  'project-1': [createUserMessage('test', '2025-01-20T10:00:00.000Z')],
  'project-2': [createUserMessage('test', '2025-01-20T11:00:00.000Z')],
});
```

#### Mock Provider Responses

```typescript
const analysis = createMockAnalysis({ stats: { totalPrompts: 10 } });
const response = createMockProviderResponse(analysis);
vi.spyOn(global, 'fetch').mockResolvedValue(response);
```

### Important Notes

- **Local Only**: E2E tests are excluded from CI/CD pipelines
- **No Real APIs**: All provider calls are mocked
- **Isolation**: Tests use `vi.resetModules()` to ensure clean state
- **Cleanup**: Always cleanup temp directories in `afterEach`
- **Environment**: Reset `process.env` after each test

---

## CI Integration

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:coverage

      - uses: codecov/codecov-action@v4
        with:
          files: coverage/lcov.info
```

Note: E2E tests are NOT run in CI. They are for local development only.
