# Release Plan

This document outlines the complete process for releasing Hyntx as a public npm package, including CI/CD setup, package optimization, and Node.js CLI executable requirements.

---

## Table of Contents

1. [CI/CD with GitHub Actions](#cicd-with-github-actions)
2. [Publishing to npm](#publishing-to-npm)
3. [Version Management Deep Dive](#version-management-deep-dive)
4. [Package Size Optimization](#package-size-optimization)
5. [Node CLI Executable Requirements](#node-cli-executable-requirements)
6. [Release Checklist](#release-checklist)

---

## CI/CD with GitHub Actions

### Overview

GitHub Actions workflows will automate:

- **Testing**: Run tests on every push and PR
- **Quality Checks**: Linting, type checking, formatting
- **Build Verification**: Ensure production builds succeed
- **Automated Releases**: Version bumping and npm publishing on tags

### Workflow Structure

```
.github/
└── workflows/
    ├── ci.yml          # Continuous Integration (test, lint, build)
    ├── release.yml     # Automated releases on version tags
    └── security.yml    # Security scanning (optional)
```

### 1. Continuous Integration Workflow

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    name: Test & Quality Checks
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [22.x]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: matrix.node-version == '22.x'
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: false
```

### 2. Release Workflow

**File**: `.github/workflows/release.yml`

````yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'

jobs:
  release:
    name: Build and Publish
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22.x
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Build
        run: pnpm build

      - name: Extract version from tag
        id: version
        run: echo "VERSION=${GITHUB_REF#refs/tags/v}" >> $GITHUB_OUTPUT

      - name: Update package.json version
        run: |
          npm version ${{ steps.version.outputs.VERSION }} --no-git-tag-version
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add package.json
          git commit -m "chore: bump version to ${{ steps.version.outputs.VERSION }}"
          git push

      - name: Publish to npm
        run: pnpm publish --access public --no-git-checks
        # Trusted Publishing (OIDC) does not require an npm token.
        # Configure this repo as a "Trusted Publisher" for the package on npm.

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          name: Release ${{ steps.version.outputs.VERSION }}
          body: |
            ## Changes

            See [CHANGELOG.md](../CHANGELOG.md) for details.

            ## Installation

            ```bash
            npm install -g hyntx
            ```
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
````

### 3. Security Workflow (Optional)

**File**: `.github/workflows/security.yml`

```yaml
name: Security

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0' # Weekly

jobs:
  security:
    name: Security Scan
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run npm audit
        run: pnpm audit --audit-level=moderate

      - name: Run Snyk (if configured)
        uses: snyk/actions/node@master
        continue-on-error: true
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Required GitHub Secrets

Configure these in **Settings → Secrets and variables → Actions**:

| Secret Name     | Description                        | Required For  |
| --------------- | ---------------------------------- | ------------- |
| `CODECOV_TOKEN` | Codecov token for coverage reports | CI (optional) |
| `SNYK_TOKEN`    | Snyk token for security scanning   | Security      |

### Configure npm Trusted Publishing (Recommended)

Instead of storing a long-lived `NPM_TOKEN`, configure **Trusted Publishing** for your npm package:

1. Go to `npmjs.com` → your package → **Settings** → **Trusted Publishers**
2. Add **GitHub Actions** as a trusted publisher
3. Select this repo and the workflow file: `.github/workflows/release.yml`

After this, publishing from GitHub Actions will use **OIDC** and no npm token secret is required.

### (Optional) Token-based publishing

If you need to publish outside GitHub Actions (local/manual or from an unsupported CI), create a **granular** npm access token and use it as `NPM_TOKEN` for that environment only.

---

## Publishing to npm

### Prerequisites

1. **npm Account**: Create account at [npmjs.com](https://www.npmjs.com/signup)
2. **Package Name Availability**: Verify `hyntx` is available (already checked in package.json)
3. **Two-Factor Authentication**: Enable 2FA on npm account (recommended)

### Version Management

Hyntx follows [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

See [Version Management Deep Dive](#version-management-deep-dive) for comprehensive versioning strategy.

### Publishing Process

#### Manual Publishing (Initial Release)

```bash
# 1. Ensure you're logged in
npm whoami

# 2. Login if needed
npm login

# 3. Run quality checks
pnpm check
pnpm test
pnpm build

# 4. Update version in package.json
npm version patch|minor|major

# 5. Create git tag
git tag v$(node -p "require('./package.json').version")
git push origin main --tags

# 6. Publish to npm
pnpm publish --access public
```

#### Automated Publishing (Recommended)

Use the GitHub Actions release workflow:

```bash
# 1. Update CHANGELOG.md with changes
# 2. Commit changes
git add CHANGELOG.md
git commit -m "docs: update changelog for v0.1.0"

# 3. Create and push version tag
git tag v0.1.0
git push origin v0.1.0

# GitHub Actions will automatically:
# - Run tests
# - Build the package
# - Update package.json version
# - Publish to npm
# - Create GitHub release
```

### Post-Publish Verification

After publishing, verify the package:

```bash
# Test installation
npm install -g hyntx

# Verify executable
hyntx --version

# Test in clean environment
npx hyntx --help
```

### Package Visibility

- **Public**: Package is visible to everyone (recommended for CLI tools)
- **Private**: Requires npm paid plan

Current setting: `--access public` in release workflow.

---

## Version Management Deep Dive

### Philosophy: Simple but Effective

The goal is **minimal cognitive overhead** with **maximum automation**. You should only think about versioning when making releases, not during development.

**Core Principles**:

1. **Conventional Commits** → Automatic version detection
2. **Single source of truth** → `package.json` version
3. **Automated workflows** → CI/CD handles bumping and publishing
4. **Clear communication** → Changelog generated from commits

---

### 1. Semantic Versioning Fundamentals

#### Version Format: `MAJOR.MINOR.PATCH`

```
1.2.3
│ │ │
│ │ └─ Patch: Bug fixes, patches (backward compatible)
│ └─── Minor: New features (backward compatible)
└───── Major: Breaking changes (incompatible)
```

#### Decision Tree

```
Is it a breaking change?
├─ YES → Bump MAJOR (1.0.0 → 2.0.0)
└─ NO
   ├─ Is it a new feature?
   │  ├─ YES → Bump MINOR (1.0.0 → 1.1.0)
   │  └─ NO → Bump PATCH (1.0.0 → 1.0.1)
```

#### What Counts as Breaking?

✅ **Breaking Changes** (MAJOR):

- Removing public APIs
- Changing function signatures
- Removing CLI flags/options
- Changing default behavior
- Dropping Node.js version support
- Changing configuration file format

✅ **New Features** (MINOR):

- Adding new CLI flags
- Adding new public APIs
- Adding new configuration options
- Performance improvements (non-breaking)
- New provider support

✅ **Bug Fixes** (PATCH):

- Fixing crashes
- Fixing incorrect behavior
- Documentation corrections
- Dependency updates (non-breaking)
- Security patches

#### Examples for Hyntx

| Change                     | Version Bump | Example       |
| -------------------------- | ------------ | ------------- |
| Remove `--output` flag     | MAJOR        | 0.1.0 → 1.0.0 |
| Add `--json` output format | MINOR        | 0.1.0 → 0.2.0 |
| Fix date parsing bug       | PATCH        | 0.1.0 → 0.1.1 |
| Change default model       | MAJOR        | 0.1.0 → 1.0.0 |
| Add Google provider        | MINOR        | 0.1.0 → 0.2.0 |
| Fix typo in error message  | PATCH        | 0.1.0 → 0.1.1 |

---

### 2. Conventional Commits Integration

**Conventional Commits** format your commit messages to enable automatic version detection:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

#### Commit Types → Version Bumps

| Commit Type        | Version Bump | Example                                 |
| ------------------ | ------------ | --------------------------------------- |
| `feat:`            | MINOR        | `feat(cli): add --json output`          |
| `fix:`             | PATCH        | `fix(reader): handle empty logs`        |
| `perf:`            | PATCH        | `perf(analyzer): optimize batching`     |
| `refactor:`        | PATCH        | `refactor(providers): simplify factory` |
| `docs:`            | PATCH        | `docs: update README installation`      |
| `style:`           | PATCH        | `style: format code with prettier`      |
| `test:`            | PATCH        | `test: add coverage for sanitizer`      |
| `chore:`           | PATCH        | `chore: update dependencies`            |
| `BREAKING CHANGE:` | MAJOR        | `feat!: remove deprecated API`          |

#### Breaking Change Indicators

Two ways to indicate breaking changes:

**Option 1: Footer**

```
feat(api): add new endpoint

BREAKING CHANGE: Removes deprecated /v1 endpoint
```

**Option 2: Exclamation mark**

```
feat(api)!: remove deprecated endpoint
```

Both trigger a **MAJOR** version bump.

#### Real-World Examples

```bash
# Patch release (bug fix)
git commit -m "fix(sanitizer): redact AWS secret keys"

# Minor release (new feature)
git commit -m "feat(cli): add --project filter option"

# Major release (breaking change)
git commit -m "feat(cli)!: change --date format to ISO 8601

BREAKING CHANGE: --date now requires YYYY-MM-DD format instead of MM/DD/YYYY"

# Or with exclamation
git commit -m "feat(cli)!: remove --verbose flag"
```

---

### 3. Automated Version Management

#### Option A: Semantic Release (Recommended)

**Semantic Release** automatically:

- Detects version from commits
- Bumps `package.json`
- Creates git tags
- Generates changelog
- Publishes to npm

**Installation**:

```bash
pnpm add -D semantic-release @semantic-release/changelog @semantic-release/git
```

**Configuration**: `.releaserc.json`

```json
{
  "branches": ["main"],
  "plugins": [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        "changelogFile": "CHANGELOG.md"
      }
    ],
    "@semantic-release/npm",
    [
      "@semantic-release/git",
      {
        "assets": ["CHANGELOG.md", "package.json"],
        "message": "chore(release): ${nextRelease.version} [skip ci]"
      }
    ],
    "@semantic-release/github"
  ]
}
```

**GitHub Actions Integration**:

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write # enable OIDC for npm Trusted Publishing + provenance
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.4

      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

      - run: pnpm dlx semantic-release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Workflow**:

1. Make commits with conventional format
2. Push to `main`
3. Semantic Release analyzes commits
4. If changes detected, automatically:
   - Bumps version
   - Creates tag
   - Generates changelog
   - Publishes to npm
   - Creates GitHub release

**No manual versioning needed!**

#### Option B: Manual with Automation (Current Approach)

For projects that want more control, use the current tag-based workflow:

**Workflow**:

```bash
# 1. Make commits (use conventional format)
git commit -m "feat(cli): add --json output"

# 2. When ready to release, create tag
git tag v0.2.0

# 3. Push tag (triggers release workflow)
git push origin v0.2.0
```

**GitHub Actions** extracts version from tag and publishes.

**Pros**: Full control, explicit releases
**Cons**: Manual version decision, no auto-changelog

---

### 4. Pre-Release Versions

For alpha, beta, and release candidates:

#### Pre-Release Format

```
1.0.0-alpha.1
1.0.0-beta.2
1.0.0-rc.3
```

#### Creating Pre-Releases

**With Semantic Release**:

```bash
# Create pre-release branch
git checkout -b beta

# Configure .releaserc.json
{
  "branches": [
    "main",
    { "name": "beta", "prerelease": "beta" }
  ]
}

# Push to beta branch
git push origin beta
# Creates: 1.0.0-beta.1
```

**Manual**:

```bash
# Tag as pre-release
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1

# npm will publish as pre-release
npm install hyntx@beta
```

#### Pre-Release Workflow

```
main branch
  ↓
beta branch (1.0.0-beta.1, 1.0.0-beta.2, ...)
  ↓
rc branch (1.0.0-rc.1, 1.0.0-rc.2, ...)
  ↓
main (1.0.0) ← Final release
```

---

### 5. Changelog Management

#### Automatic Changelog Generation

**With Semantic Release**:

Automatically generates `CHANGELOG.md` from commits:

```markdown
# Changelog

## [1.2.0](https://github.com/user/hyntx/compare/v1.1.0...v1.2.0) (2025-01-20)

### Features

- **cli**: add --json output format ([abc123](https://github.com/user/hyntx/commit/abc123))
- **providers**: add Google Gemini support ([def456](https://github.com/user/hyntx/commit/def456))

### Bug Fixes

- **sanitizer**: redact AWS secret keys ([ghi789](https://github.com/user/hyntx/commit/ghi789))
```

**Manual with `standard-version`**:

```bash
pnpm add -D standard-version

# Add to package.json
{
  "scripts": {
    "release": "standard-version"
  }
}

# Run
pnpm release
# Bumps version, generates changelog, creates tag
```

#### Manual Changelog Template

If generating manually, follow this structure:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- New feature X

### Changed

- Improved Y

### Fixed

- Bug Z

## [1.0.0] - 2025-01-20

### Added

- Initial release
- CLI with basic analysis
- Ollama provider support
```

---

### 6. Version Bumping Strategies

#### Strategy 1: Continuous (Recommended for Active Projects)

**When**: Project has regular releases (weekly/monthly)

**Approach**: Release whenever meaningful changes accumulate

```bash
# Week 1: Bug fixes
git commit -m "fix: ..."
git commit -m "fix: ..."
# Release: 0.1.0 → 0.1.1

# Week 2: New feature
git commit -m "feat: ..."
# Release: 0.1.1 → 0.2.0

# Week 3: More features
git commit -m "feat: ..."
git commit -m "feat: ..."
# Release: 0.2.0 → 0.3.0
```

**Pros**: Users get updates frequently, smaller releases
**Cons**: More releases to manage

#### Strategy 2: Milestone-Based

**When**: Project has clear milestones or phases

**Approach**: Release when milestone is complete

```bash
# Milestone: "Multi-provider support"
git commit -m "feat(providers): add Anthropic"
git commit -m "feat(providers): add Google"
git commit -m "docs: update provider docs"
# Release: 0.1.0 → 0.2.0 (milestone complete)
```

**Pros**: Clear release purpose, fewer releases
**Cons**: Longer wait between releases

#### Strategy 3: Calendar-Based

**When**: Project needs predictable release schedule

**Approach**: Release on fixed schedule (e.g., first Monday of month)

```bash
# First Monday of month: Review commits, release
# Accumulated changes determine version bump
```

**Pros**: Predictable, easier planning
**Cons**: May delay important fixes

---

### 7. Version Management Tools

#### Recommended: Semantic Release

**Best for**: Fully automated, zero-config versioning

```bash
pnpm add -D semantic-release
```

**Setup**: 5 minutes
**Maintenance**: Zero (after setup)
**Control**: Low (automatic)

#### Alternative: standard-version

**Best for**: More control, still automated

```bash
pnpm add -D standard-version
```

**Setup**: 2 minutes
**Maintenance**: Low (run command)
**Control**: Medium (you decide when to run)

#### Alternative: Manual (Current)

**Best for**: Maximum control, learning

```bash
# Manual version bump
npm version patch|minor|major
git tag v$(node -p "require('./package.json').version")
git push origin main --tags
```

**Setup**: 0 minutes
**Maintenance**: High (manual every release)
**Control**: High (full control)

---

### 8. Best Practices

#### ✅ DO

1. **Use Conventional Commits** consistently

   ```bash
   feat(cli): add --json output
   fix(reader): handle empty logs
   ```

2. **Bump version immediately before release**
   - Don't commit version bumps in feature branches
   - Bump in release commit or via automation

3. **Keep changelog up-to-date**
   - Update `CHANGELOG.md` with each release
   - Or use automatic generation

4. **Tag releases immediately**

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

5. **Communicate breaking changes clearly**
   - Use `BREAKING CHANGE:` footer
   - Document migration path
   - Give users time to adapt

#### ❌ DON'T

1. **Don't skip versions**

   ```bash
   # ❌ Bad: Skip from 0.1.0 to 0.3.0
   # ✅ Good: 0.1.0 → 0.2.0 → 0.3.0
   ```

2. **Don't bump version for every commit**

   ```bash
   # ❌ Bad: Version bump in every commit
   # ✅ Good: Version bump only on release
   ```

3. **Don't mix versioning strategies**

   ```bash
   # ❌ Bad: Sometimes manual, sometimes auto
   # ✅ Good: Pick one strategy and stick to it
   ```

4. **Don't forget to update changelog**

   ```bash
   # ❌ Bad: Release without changelog
   # ✅ Good: Always update changelog
   ```

5. **Don't use pre-release versions in production**
   ```bash
   # ❌ Bad: npm install hyntx@1.0.0-beta.1 (in production)
   # ✅ Good: Use stable versions in production
   ```

---

### 9. Recommended Workflow for Hyntx

**Recommended**: **Semantic Release** (fully automated)

**Why**:

- Project uses Conventional Commits (already in AGENTS.md)
- Reduces cognitive overhead
- Automatic changelog generation
- Zero maintenance after setup

**Setup Steps**:

1. Install dependencies:

   ```bash
   pnpm add -D semantic-release @semantic-release/changelog @semantic-release/git
   ```

2. Create `.releaserc.json` (see section 3)

3. Update `.github/workflows/release.yml` to use semantic-release

4. Make commits with conventional format

5. Push to `main` → Automatic release!

**Alternative** (if you prefer control): Keep current tag-based workflow, but add `standard-version` for changelog generation.

---

### 10. Version Decision Helper

When in doubt, use this decision tree:

```
1. Did you remove or change existing functionality?
   YES → MAJOR
   NO → Continue

2. Did you add new functionality?
   YES → MINOR
   NO → Continue

3. Did you fix bugs or make improvements?
   YES → PATCH
   NO → No release needed
```

**Still unsure?** Default to **PATCH**. It's safer to under-version than over-version.

---

### 11. Version History Example

Here's how a real project might evolve:

```
0.0.1  Initial release (basic functionality)
0.0.2  Fix: Handle empty logs
0.0.3  Fix: Date parsing bug
0.1.0  Feat: Add --project filter
0.1.1  Fix: Project filter edge case
0.1.2  Fix: Memory leak in analyzer
0.2.0  Feat: Add Google provider
0.2.1  Fix: Google API error handling
0.3.0  Feat: Add --json output format
1.0.0  BREAKING: Remove deprecated --verbose flag
1.0.1  Fix: JSON output formatting
1.1.0  Feat: Add --dry-run mode
```

Notice:

- **PATCH**: Bug fixes, small improvements
- **MINOR**: New features, backward compatible
- **MAJOR**: Breaking changes (rare, but important)

---

### 12. Quick Reference

| Task                  | Command                                       |
| --------------------- | --------------------------------------------- |
| Check current version | `node -p "require('./package.json').version"` |
| Bump patch            | `npm version patch`                           |
| Bump minor            | `npm version minor`                           |
| Bump major            | `npm version major`                           |
| Create tag            | `git tag v1.0.0`                              |
| Push tag              | `git push origin v1.0.0`                      |
| List tags             | `git tag -l`                                  |
| Delete tag            | `git tag -d v1.0.0`                           |
| View version history  | `git log --oneline --decorate`                |

---

## Package Size Optimization

### Current Configuration

**package.json** already includes:

```json
{
  "files": ["dist"]
}
```

This ensures only the `dist/` directory is published.

### .gitignore Review

Current `.gitignore` already excludes:

- ✅ `dist/` (build output)
- ✅ `node_modules/`
- ✅ `coverage/`
- ✅ `*.tsbuildinfo`
- ✅ Environment files
- ✅ IDE files

**No changes needed** - current `.gitignore` is optimal.

### .npmignore

Create `.npmignore` to explicitly exclude files from npm package:

**File**: `.npmignore`

```
# Source files (not needed in package)
src/
*.ts
!*.d.ts

# Development files
*.test.ts
*.test.js
*.config.*
tsconfig.json
vitest.config.ts
eslint.config.js
prettier.config.js
tsup.config.ts

# Documentation (keep README.md and LICENSE)
docs/
CHANGELOG.md
docs/ROADMAP.md
AGENTS.md
backlog/

# CI/CD
.github/

# Development scripts
next-tasks.sh

# Lock files (pnpm-lock.yaml is fine, but be explicit)
package-lock.json
yarn.lock

# Coverage and test files
coverage/
.nyc_output/
*.lcov

# Environment files
.env*
*.env

# IDE files
.vscode/
.idea/
*.sublime-*

# OS files
.DS_Store
Thumbs.db

# Git
.git/
.gitignore
.gitattributes
```

**Note**: `package.json` `files` field takes precedence. `.npmignore` is a safety net.

### Package Size Targets

| Target | Size    | Notes                    |
| ------ | ------- | ------------------------ |
| Ideal  | < 500KB | Minimal dependencies     |
| Good   | < 1MB   | Acceptable for CLI tools |
| Max    | < 5MB   | Warning threshold        |

### Size Verification

Add to `package.json` scripts:

```json
{
  "scripts": {
    "size": "npm pack --dry-run 2>&1 | tail -1"
  }
}
```

Check size before publishing:

```bash
pnpm size
```

### Tree-Shaking

Current `tsup.config.ts` already enables:

```typescript
{
  treeshake: true,  // ✅ Enabled
  splitting: false, // ✅ Single bundle (CLI doesn't need code splitting)
}
```

**No changes needed** - tree-shaking is already optimized.

### Dependency Audit

Review dependencies for size:

```bash
# Check dependency sizes
pnpm why <package-name>

# Analyze bundle
pnpm add -D bundle-phobia-cli
npx bundle-phobia hyntx
```

Current dependencies are minimal:

- `chalk`, `boxen` - Terminal formatting (small)
- `date-fns` - Date utilities (tree-shakeable)
- `glob` - File matching (small)
- `prompts` - Interactive CLI (small)

---

## Node CLI Executable Requirements

### 1. Shebang in Entry Point

**Current Status**: ✅ Already configured

The `tsup.config.ts` includes:

```typescript
banner: {
  js: '#!/usr/bin/env node',
}
```

This adds the shebang to `dist/index.js` automatically.

**Verification**:

```bash
pnpm build
head -1 dist/index.js
# Should output: #!/usr/bin/env node
```

### 2. bin Field in package.json

**Current Status**: ✅ Already configured

```json
{
  "bin": {
    "hyntx": "./dist/index.js"
  }
}
```

This tells npm to create a `hyntx` executable that points to `dist/index.js`.

### 3. Executable Permissions

npm automatically sets executable permissions during installation.

**Manual Verification** (after `pnpm build`):

```bash
# Check permissions
ls -l dist/index.js
# Should show: -rwxr-xr-x (executable)

# If not executable, fix:
chmod +x dist/index.js
```

**Note**: The shebang (`#!/usr/bin/env node`) is what makes it executable, not file permissions. npm handles permissions during `npm install -g`.

### 4. Cross-Platform Compatibility

#### Windows

- ✅ **Shebang**: `#!/usr/bin/env node` works on Windows via Git Bash, WSL, or npm's shim
- ✅ **Line Endings**: Ensure `.gitattributes` or build process uses LF (not CRLF)

**File**: `.gitattributes`

```
* text=auto eol=lf
*.js text eol=lf
*.ts text eol=lf
*.json text eol=lf
*.md text eol=lf
```

#### Unix-like (macOS, Linux)

- ✅ Works natively with shebang
- ✅ Executable permissions handled by npm

### 5. Testing CLI Installation

#### Local Testing (Before Publishing)

```bash
# Build
pnpm build

# Test local installation
npm link

# Verify executable
which hyntx
hyntx --version

# Unlink
npm unlink -g hyntx
```

#### Global Installation Test

```bash
# Install from local tarball
pnpm pack
npm install -g hyntx-0.0.1.tgz

# Test
hyntx --help

# Uninstall
npm uninstall -g hyntx
```

### 6. ESM Module Requirements

Since Hyntx uses ESM (`"type": "module"`), ensure:

- ✅ **Entry point**: `dist/index.js` is ESM
- ✅ **Shebang**: Must come before any imports
- ✅ **Node.js version**: `>=22.0.0` (specified in `engines`)

**Current Status**: ✅ All requirements met

---

## Release Checklist

### Pre-Release

- [ ] All tests passing (`pnpm test`)
- [ ] Quality checks passing (`pnpm check`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Package size verified (`pnpm size`)
- [ ] `CHANGELOG.md` updated
- [ ] Version bumped in `package.json`
- [ ] `README.md` reviewed and updated
- [ ] License file present (`LICENSE`)
- [ ] `.npmignore` created and reviewed
- [ ] `.gitignore` excludes build artifacts
- [ ] GitHub Actions workflows configured
- [ ] npm token added to GitHub Secrets

### Release

- [ ] Create version tag: `git tag v0.1.0`
- [ ] Push tag: `git push origin v0.1.0`
- [ ] Monitor GitHub Actions release workflow
- [ ] Verify npm publication: `npm view hyntx`
- [ ] Test installation: `npm install -g hyntx`
- [ ] Verify executable: `hyntx --version`

### Post-Release

- [ ] Create GitHub Release (if not automated)
- [ ] Update documentation links (if needed)
- [ ] Announce release (social media, blog, etc.)
- [ ] Monitor npm download stats
- [ ] Monitor GitHub Issues for installation problems

---

## Version Tagging Convention

Use semantic versioning tags:

```bash
# Patch release (bug fixes)
git tag v0.0.2

# Minor release (new features)
git tag v0.1.0

# Major release (breaking changes)
git tag v1.0.0
```

**Format**: `v{MAJOR}.{MINOR}.{PATCH}`

**See [Version Management Deep Dive](#version-management-deep-dive) for comprehensive versioning strategy, automated workflows, and best practices.**

---

## Troubleshooting

### "Package name already taken"

- Check if `hyntx` is available: `npm view hyntx`
- If taken, update `package.json` name and republish

### "npm publish failed: 403 Forbidden"

- Verify npm login: `npm whoami`
- Check npm token permissions
- Ensure 2FA is configured correctly

### "Executable not found after install"

- Verify `bin` field in `package.json`
- Check shebang in `dist/index.js`
- Verify Node.js version: `node --version` (must be >=22.0.0)

### "GitHub Actions release failed"

- Ensure the job has `permissions: id-token: write`
- Ensure the npm package is configured with this repo/workflow as a **Trusted Publisher**
- Check workflow logs for the npm OIDC/token-exchange error details

---

## Additional Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning](https://semver.org/)
- [Node.js ESM Guide](https://nodejs.org/api/esm.html)

---

**Last Updated**: 2025-01-20
