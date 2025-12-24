# Add Prettier Formatting and ESLint Fixing to Husky / lint-staged

## Metadata

- **Priority**: P1
- **Phase**: 2.5
- **Dependencies**: none
- **Estimation**: 30 minutes

## Description

Configure lint-staged with husky to automatically format code with Prettier and fix ESLint issues on staged files before commits. This ensures consistent code style and prevents formatting-related commit failures.

## Objective

Automatically fix formatting and linting issues on staged files before commits, making the development workflow smoother and preventing style violations from entering the repository.

## Scope

- Includes: Installing lint-staged
- Includes: Configuring lint-staged for TypeScript, JSON, and Markdown files
- Includes: Updating husky pre-commit hook to use lint-staged
- Includes: Verifying husky configuration is correct
- Excludes: Changing Prettier or ESLint configuration
- Excludes: Modifying commit-msg hook (already configured with commitlint)

## Files to Create/Modify

- `package.json` - Add lint-staged dependency and configuration
- `.husky/pre-commit` - Update to use lint-staged instead of running full checks

## Implementation

### 1. Install lint-staged

```bash
pnpm add -D lint-staged
```

### 2. Add lint-staged Configuration to package.json

Add `lint-staged` configuration object to package.json:

```json
{
  "lint-staged": {
    "*.ts": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"],
    "*.{js,mjs,cjs}": ["eslint --fix", "prettier --write"]
  }
}
```

**Pattern matching**:
- `*.ts` - TypeScript files: run ESLint fix and Prettier
- `*.{json,md,yml,yaml}` - Config and docs: Prettier only
- `*.{js,mjs,cjs}` - JavaScript files: ESLint fix and Prettier

### 3. Update .husky/pre-commit Hook

Replace current content with lint-staged:

**Current**:
```
pnpm typecheck && pnpm lint
```

**New**:
```
pnpm lint-staged
```

**Rationale**: lint-staged runs on staged files only (faster), and typecheck should remain a separate manual check or CI step since it requires full project analysis.

### 4. Verify and Fix Husky Configuration

Ensure husky is properly configured:

- ✅ `package.json` has `"prepare": "husky"` script (already present)
- ✅ `.husky/pre-commit` exists and is executable (may need to fix permissions)
- ✅ `.husky/commit-msg` exists and is executable (may need to fix permissions)

**Verify current state**:
```bash
ls -la .husky/
```

**Fix executable permissions** (if needed):
```bash
chmod +x .husky/pre-commit
chmod +x .husky/commit-msg
```

**Note**: Husky hooks must be executable for git to run them. The `prepare` script should handle this, but verify it works.

### 5. Test the Configuration

Test that lint-staged works correctly:

```bash
# Stage a file with formatting issues
git add src/some-file.ts

# Try to commit (should trigger pre-commit hook)
git commit -m "test: verify lint-staged"

# Verify files were formatted
git diff --staged
```

## Acceptance Criteria

- [ ] lint-staged is installed as dev dependency
- [ ] `lint-staged` configuration added to package.json
- [ ] `.husky/pre-commit` updated to use `pnpm lint-staged`
- [ ] Pre-commit hook is executable
- [ ] Staged TypeScript files are automatically formatted with Prettier and fixed by ESLint
- [ ] Staged JSON/Markdown files are automatically formatted with Prettier
- [ ] Test commit successfully formats and fixes staged files

## Test Cases

- Create a TypeScript file with formatting issues (wrong quotes, missing semicolons)
- Stage the file and commit
- Verify the file is automatically formatted before commit
- Verify ESLint auto-fixes are applied
- Create a JSON file with incorrect formatting
- Stage and commit - verify Prettier formatting is applied

## References

- AGENTS.md - Code style rules
- docs/CODE-STYLE.md - TypeScript conventions
- docs/DEVELOPMENT.md - Development setup (mentions lint-staged pattern)
- [lint-staged documentation](https://github.com/okonet/lint-staged)
- [husky documentation](https://typicode.github.io/husky/)

