import { defineConfig, Options } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'api/index': 'src/api/index.ts',
  },
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
  banner: ({ format }) => {
    if (format === 'esm') {
      // Only add shebang to CLI entry
      // This is a workaround since tsup doesn't provide entry name in banner context
      // We'll handle this via esbuildOptions instead
      return {};
    }
    return {};
  },
  esbuildOptions(options) {
    // Add shebang to all JS outputs initially
    // We'll manually add it to cli.js in a post-build step if needed
    options.banner = options.banner || {};
  },
  async onSuccess() {
    // Add shebang to cli.js after build
    const fs = await import('node:fs/promises');
    const cliPath = './dist/cli.js';
    const content = await fs.readFile(cliPath, 'utf-8');
    if (!content.startsWith('#!')) {
      await fs.writeFile(cliPath, `#!/usr/bin/env node\n${content}`);
      console.log('Added shebang to dist/cli.js');
    }
  },
  // Mark CLI dependencies as external for library builds
  // This ensures that chalk, ora, etc. are not bundled with the library API
  external: [
    // CLI-only dependencies should not be bundled
    'chalk',
    'ora',
    'boxen',
    'figlet',
    'prompts',
    'cli-table3',
  ],
});
