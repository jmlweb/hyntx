import baseConfig from '@jmlweb/eslint-config-base';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...baseConfig,
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
      '.prettierrc.mjs',
      'tests/',
      'scripts/',
    ],
  },
);
