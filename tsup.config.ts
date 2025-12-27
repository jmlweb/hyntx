import { defineConfig } from 'tsup';
import { createTsupCliConfig } from '@jmlweb/tsup-config-base';

export default defineConfig(
  createTsupCliConfig({
    entry: {
      index: 'src/index.ts',
      cli: 'src/cli.ts',
      'api/index': 'src/api/index.ts',
    },
    target: 'node22',
    shebang: 'cli',
    external: ['chalk', 'ora', 'boxen', 'figlet', 'prompts', 'cli-table3'],
    options: {
      sourcemap: process.env.SOURCE_MAP === 'true',
      treeshake: true,
    },
  }),
);
