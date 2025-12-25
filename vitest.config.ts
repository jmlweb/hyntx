import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      // Keep src/**/*.test.ts for backward compatibility during migration
      'src/**/*.test.ts',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'tests/e2e/**/*.test.ts', // E2E tests excluded from CI (require Ollama)
      'tests/e2e/**', // Exclude entire e2e directory
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.*',
        'tests/e2e/**',
        'tests/**/*.test.ts', // Exclude tests from coverage
      ],
    },
    testTimeout: 30000, // Integration tests may need more time
    passWithNoTests: true,
  },
});
