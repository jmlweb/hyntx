import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Enable source maps for debugging: SOURCE_MAP=true pnpm build
  sourcemap: process.env.SOURCE_MAP === 'true',
  target: 'node22',
  shims: false,
  splitting: false,
  treeshake: true,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
