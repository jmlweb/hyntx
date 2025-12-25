# Add Security Workflow for GitHub Actions

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: None
- **Estimation**: 1-2 hours
- **Source**: IDEA-009 - Add Security Workflow for GitHub Actions

## Description

Add a dedicated GitHub Actions security workflow to automatically detect vulnerabilities in dependencies. The workflow will run npm audit on pushes and pull requests to main, plus weekly scheduled scans for continuous monitoring.

## Objective

Provide automated vulnerability detection for npm dependencies, preventing vulnerable packages from being merged and ensuring ongoing security awareness through scheduled scans.

## Scope

- Includes:
  - Create `.github/workflows/security.yml`
  - npm audit with `--audit-level=moderate`
  - Triggers: push to main, PRs to main, weekly cron schedule
  - Optional Snyk integration with graceful failure

- Excludes:
  - Code security scanning (SAST)
  - Container scanning
  - Secret scanning (handled by GitHub)

## Files to Create/Modify

- `.github/workflows/security.yml` (create)
- `docs/RELEASE.md` (update if needed)

## Implementation

1. Create `.github/workflows/security.yml` with:
   - Triggers: `push` to main, `pull_request` to main, `schedule` (weekly)
   - pnpm setup using `pnpm/action-setup@v4` with version 9.15.4
   - `pnpm audit --audit-level=moderate` step
   - Optional Snyk step with `continue-on-error: true`

2. Workflow structure:

   ```yaml
   name: Security
   on:
     push:
       branches: [main]
     pull_request:
       branches: [main]
     schedule:
       - cron: '0 0 * * 0' # Sunday midnight UTC
   ```

3. Ensure workflow fails on moderate+ severity vulnerabilities

## Acceptance Criteria

- [ ] `.github/workflows/security.yml` exists
- [ ] Workflow triggers on push to main and pull requests
- [ ] Workflow includes weekly scheduled scan (cron: '0 0 \* \* 0')
- [ ] npm audit runs with `--audit-level=moderate`
- [ ] Workflow fails on moderate+ severity vulnerabilities
- [ ] Optional Snyk step included with `continue-on-error: true`
- [ ] Workflow uses correct pnpm version (9.15.4)
- [ ] Tests pass and linting passes

## Test Cases

- Verify workflow triggers on push to main
- Verify workflow triggers on PR to main
- Verify scheduled cron syntax is valid
- Test with a known vulnerable dependency (locally)

## References

- `docs/RELEASE.md` section 3 - Security workflow specification
- `.github/workflows/ci.yml` - Reference for pnpm setup
- IDEA-009 for full context
