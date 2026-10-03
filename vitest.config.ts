import { defineConfig } from 'vitest/config';
import baseConfig from '@jmlweb/vitest-config';

export default defineConfig({
  test: {
    ...baseConfig.test,
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],
    testTimeout: 30000,
    typecheck: {
      enabled: false,
    },
    reporters: ['default'],
    coverage: {
      ...baseConfig.test?.coverage,
      thresholds: undefined,
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.config.*', '**/*.test.ts'],
    },
    passWithNoTests: true,
  },
});
