# Dummy npm Deployment - Package Name Reservation

## Metadata

- **Priority**: P0
- **Phase**: 0 (Pre-Foundation)
- **Dependencies**: none
- **Estimation**: 1-2 hours

## Description

Perform a dummy deployment of the `hyntx` package to npm to reserve the package name and prevent name squatting. This is a minimal deployment with placeholder functionality to secure the package name before the full release.

## Objective

Reserve the `hyntx` package name on npm registry to ensure it's available when the project is ready for its first official release. This prevents potential name conflicts and ensures brand consistency.

## Scope

- Includes: Package verification, minimal build, npm publishing, post-publish verification
- Excludes: Full feature implementation, CI/CD automation, changelog generation, GitHub releases

## Files to Create/Modify

- `package.json` - Verify configuration (may need minor adjustments)
- `.npmignore` - Create if needed to exclude unnecessary files
- `README.md` - Ensure basic README exists (for npm display)

## Implementation

### Prerequisites

1. **npm Account Setup**:
   - Create account at [npmjs.com](https://www.npmjs.com/signup) if not exists
   - Verify email address
   - Enable two-factor authentication (recommended)

2. **Package Name Verification**:

   ```bash
   npm view hyntx
   # Should return 404 if name is available
   ```

3. **npm Authentication**:
   ```bash
   npm whoami
   # If not logged in:
   npm login
   ```

### Steps

1. **Verify Package Configuration**:
   - Check `package.json` has correct `name`, `version`, `description`
   - Verify `bin` field points to `./dist/index.js`
   - Verify `files` field includes only `dist`
   - Ensure `license` is set (MIT)

2. **Create `.npmignore` (if needed)**:
   - Exclude source files (`src/`, `*.ts`)
   - Exclude development files (configs, tests, docs)
   - Keep only `dist/`, `README.md`, `LICENSE`, `package.json`

3. **Build Package**:

   ```bash
   pnpm build
   # Verify dist/index.js exists and has shebang
   ```

4. **Verify Package Contents**:

   ```bash
   pnpm size
   # Check package size

   npm pack --dry-run
   # Preview what will be published
   ```

5. **Test Local Installation**:

   ```bash
   npm link
   # Test executable
   which hyntx
   hyntx --version  # or --help if version not implemented
   npm unlink -g hyntx
   ```

6. **Publish to npm**:

   ```bash
   # Ensure version is appropriate (0.0.1 is fine for dummy deployment)
   npm version 0.0.1 --no-git-tag-version

   # Publish as public package
   pnpm publish --access public
   ```

7. **Post-Publish Verification**:

   ```bash
   # Verify package exists
   npm view hyntx

   # Test installation from npm
   npm install -g hyntx
   hyntx --version  # or --help

   # Uninstall
   npm uninstall -g hyntx
   ```

### Version Strategy

- Use version `0.0.1` (current version) for dummy deployment
- This is a placeholder version, not a functional release
- Future versions (0.0.2, 0.1.0, etc.) will be functional releases

### Package Contents

For dummy deployment, the package should include:

- ✅ `dist/index.js` - Built executable (even if minimal)
- ✅ `package.json` - Package metadata
- ✅ `README.md` - Basic description
- ✅ `LICENSE` - MIT license
- ❌ Source files (`src/`)
- ❌ Development configs
- ❌ Tests
- ❌ Documentation (except README)

## Acceptance Criteria

- [ ] npm account created and authenticated
- [ ] Package name `hyntx` verified as available
- [ ] Package builds successfully (`pnpm build`)
- [ ] `.npmignore` created (if needed) to exclude unnecessary files
- [ ] Package size verified and reasonable (< 1MB)
- [ ] Local installation test passes (`npm link`)
- [ ] Package published to npm successfully
- [ ] Package visible on npm registry (`npm view hyntx`)
- [ ] Global installation from npm works (`npm install -g hyntx`)
- [ ] Executable works (even if minimal functionality)

## Test Cases

1. **Name Availability Check**:
   - Run `npm view hyntx`
   - Should return 404 (name available) before publishing
   - Should return package info after publishing

2. **Local Build Test**:
   - Run `pnpm build`
   - Verify `dist/index.js` exists
   - Verify shebang is present (`#!/usr/bin/env node`)

3. **Package Preview**:
   - Run `npm pack --dry-run`
   - Verify only necessary files are included
   - Verify no source files or dev configs

4. **Local Installation**:
   - Run `npm link`
   - Verify `hyntx` command is available
   - Run `hyntx --help` or `hyntx --version`
   - Unlink successfully

5. **npm Installation**:
   - Install from npm: `npm install -g hyntx`
   - Verify executable works
   - Uninstall successfully

## Notes

- This is a **dummy deployment** - the package doesn't need to be fully functional
- The goal is to **reserve the name**, not provide a working tool
- Future releases will add full functionality
- Consider adding a note in README that this is a placeholder/reservation release
- After publishing, the package name is reserved and cannot be taken by others

## References

- `docs/RELEASE.md` - Comprehensive release documentation
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [npm Package Name Best Practices](https://docs.npmjs.com/cli/v10/using-npm/package-name-guidelines)
