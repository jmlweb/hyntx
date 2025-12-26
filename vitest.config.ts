import { defineConfig } from 'vitest/config';
import baseConfig from '@jmlweb/vitest-config';

export default defineConfig({
  test: {
    ...baseConfig.test,
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'src/**/*.test.ts',
    ],
    exclude: [
      'node_modules/',
      'dist/',
      'tests/e2e/**/*.test.ts',
      'tests/e2e/**',
    ],
    testTimeout: 30000,
    typecheck: {
      enabled: false,
    },
    reporters: ['default'],
    coverage: {
      ...baseConfig.test?.coverage,
      thresholds: undefined,
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.*',
        'tests/e2e/**',
        'tests/**/*.test.ts',
      ],
    },
    passWithNoTests: true,
  },
});
