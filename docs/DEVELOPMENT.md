# Development Environment

## Prerequisites

| Tool     | Version  | Installation                                |
| -------- | -------- | ------------------------------------------- |
| Node.js  | 22.x LTS | Via nvm (see below)                         |
| nvm      | Latest   | [nvm-sh/nvm](https://github.com/nvm-sh/nvm) |
| pnpm     | 9.x      | Via Corepack (automatic)                    |
| Corepack | Bundled  | Included with Node.js 22+                   |

## Initial Setup

### 1. Install Node.js with nvm

The project includes an `.nvmrc` file for automatic version switching.

```bash
# Install and use the correct Node.js version
nvm install
nvm use
```

#### Automatic Version Switching

Add to your `~/.zshrc` or `~/.bashrc` to automatically switch Node.js version when entering the project:

```bash
# Auto-switch Node.js version based on .nvmrc
autoload -U add-zsh-hook

load-nvmrc() {
  local nvmrc_path="$(nvm_find_nvmrc)"
  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")
    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use
    fi
  elif [ -n "$(PWD=$OLDPWD nvm_find_nvmrc)" ] && [ "$(nvm version)" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}

add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

For bash, use the simpler version:

```bash
# Add to ~/.bashrc
cd() {
  builtin cd "$@" || return
  if [[ -f .nvmrc && -r .nvmrc ]]; then
    nvm use
  fi
}
```

### 2. Enable Corepack

Corepack manages pnpm version automatically:

```bash
corepack enable
```

### 3. Install Dependencies

```bash
pnpm install
```

### 4. Verify Setup

```bash
node --version  # Should show v22.x.x
pnpm --version  # Should show 9.x.x
pnpm build
pnpm start --help
```

---

## Package Manager Configuration

### package.json - Engine Requirements

```json
{
  "packageManager": "pnpm@9.15.4",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### .npmrc

```ini
engine-strict=true
auto-install-peers=true
```

---

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key Settings**:

- `strict: true` - All strict type-checking options
- `noUncheckedIndexedAccess` - Adds `undefined` to index access types
- `verbatimModuleSyntax` - Enforces explicit type-only imports
- `NodeNext` - Full ESM support for Node.js

---

## ESLint Configuration

Using ESLint 9 with flat config format.

### eslint.config.js

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

      // Import rules
      '@typescript-eslint/no-require-imports': 'error',

      // Naming conventions
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE'] },
        {
          selector: 'variable',
          modifiers: ['const', 'exported'],
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
        { selector: 'function', format: ['camelCase'] },
      ],
    },
  },
  {
    ignores: ['dist/', 'node_modules/', '*.config.js'],
  },
);
```

### Required Dependencies

```bash
pnpm add -D eslint @eslint/js typescript-eslint eslint-config-prettier
```

---

## Prettier Configuration

### prettier.config.js

```javascript
const config = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
  endOfLine: 'lf',
  proseWrap: 'preserve',
};

export default config;
```

### Required Dependencies

```bash
pnpm add -D prettier
```

---

## Build Configuration

### tsup.config.ts

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
  shims: false,
  splitting: false,
  treeshake: true,
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

---

## Testing Configuration

### vitest.config.ts (Unit Tests)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.config.*'],
    },
    testTimeout: 10000,
  },
});
```

### vitest.config.e2e.ts (E2E Tests)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.ts'],
    testTimeout: 30000,
  },
});
```

**Note**: E2E tests are local-only and excluded from CI/CD to avoid dependency on real Claude Code logs.

### Required Dependencies

```bash
pnpm add -D vitest @vitest/coverage-v8
```

---

## NPM Scripts

### package.json scripts

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "vitest run --config vitest.config.e2e.ts",
    "test:e2e:watch": "vitest --config vitest.config.e2e.ts",
    "test:all": "pnpm test && pnpm test:e2e",
    "check": "pnpm typecheck && pnpm lint && pnpm format:check",
    "prepare": "pnpm build"
  }
}
```

---

## Git Hooks (Optional)

### Using simple-git-hooks + lint-staged

```bash
pnpm add -D simple-git-hooks lint-staged
```

### package.json additions

```json
{
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged"
  },
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

Initialize hooks:

```bash
pnpm simple-git-hooks
```

---

## IDE Configuration

### .vscode/settings.json

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### .vscode/extensions.json

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss"
  ]
}
```

---

## Directory Structure

```text
hyntx/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── core/                 # Core business logic
│   ├── providers/            # AI provider implementations
│   ├── utils/                # Utility functions
│   └── types/                # TypeScript type definitions
├── tests/                    # Test files
├── dist/                     # Build output (gitignored)
├── docs/                     # Documentation
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── prettier.config.js
├── .nvmrc                    # Node.js version (nvm)
└── .npmrc
```

---

## .nvmrc

```text
22
```

This file pins the project to Node.js 22.x LTS. When using nvm with automatic switching enabled, the correct version is selected when entering the project directory.

---

## Quick Reference

| Command               | Description                            |
| --------------------- | -------------------------------------- |
| `pnpm dev`            | Watch mode with rebuild                |
| `pnpm build`          | Production build                       |
| `pnpm start`          | Run CLI                                |
| `pnpm check`          | Run all checks (types + lint + format) |
| `pnpm test`           | Run tests once (single run)            |
| `pnpm test:watch`     | Run tests in watch mode                |
| `pnpm test:e2e`       | Run E2E tests once                     |
| `pnpm test:e2e:watch` | Run E2E tests in watch mode            |
| `pnpm test:all`       | Run all tests (unit + E2E)             |
