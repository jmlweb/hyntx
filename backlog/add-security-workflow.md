# Add Security Workflow for GitHub Actions

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: None
- **Estimation**: 2-3 hours
- **Source**: IDEA-009 - Add Security Workflow for GitHub Actions

## Description

Implement `.github/workflows/security.yml` to automatically detect vulnerabilities in npm dependencies. The workflow should run on pushes to main, pull requests, and weekly scheduled scans. This complements the existing CI and release workflows by adding automated vulnerability scanning.

## Objective

Provide ongoing security monitoring for the project by automatically detecting known vulnerabilities in dependencies. This prevents vulnerable dependencies from being merged and provides proactive monitoring through weekly scans.

## Scope

- Includes:
  - Create `.github/workflows/security.yml` workflow file
  - Configure triggers: push to main, pull requests, weekly cron schedule
  - Implement npm audit scanning with moderate severity threshold
  - Optional Snyk integration with graceful failure handling
  - Use consistent pnpm version (9.15.4) matching other workflows
  - Update documentation with setup instructions
- Excludes:
  - Advanced security scanning beyond npm audit and optional Snyk
  - Dependency update automation
  - Security policy files

## Files to Create/Modify

- `.github/workflows/security.yml` (create)
- `docs/RELEASE.md` (update if needed for setup instructions)

## Implementation

1. **Create workflow file**:
   - Location: `.github/workflows/security.yml`
   - Use pnpm 9.15.4 (consistent with CI workflow)
   - Set up Node.js environment

2. **Configure triggers**:
   - Push to `main` branch
   - Pull requests to `main` branch
   - Weekly scheduled scan: `0 0 * * 0` (Sunday midnight UTC)

3. **Implement security checks**:
   - Run `pnpm audit --audit-level=moderate`
   - Fail workflow on moderate or higher severity issues
   - Optional Snyk step with `continue-on-error: true` if `SNYK_TOKEN` is configured

4. **Error handling**:
   - Workflow should fail on security issues
   - Snyk step should gracefully handle missing token
   - Provide clear error reporting for security issues

5. **Documentation**:
   - Reference `docs/RELEASE.md` section 3 for workflow specification
   - Document optional Snyk token setup if used

## Acceptance Criteria

- [ ] `.github/workflows/security.yml` exists
- [ ] Workflow triggers on push to main and pull requests
- [ ] Workflow includes weekly scheduled scan (cron: `0 0 * * 0`)
- [ ] npm audit runs with `--audit-level=moderate`
- [ ] Workflow fails on moderate+ severity vulnerabilities
- [ ] Optional Snyk step included with `continue-on-error: true`
- [ ] Workflow uses correct pnpm version (9.15.4)
- [ ] Documentation updated with setup instructions for SNYK_TOKEN (if used)
- [ ] Workflow runs successfully in GitHub Actions

## Test Cases

- Verify workflow triggers on push to main branch
- Verify workflow triggers on pull request
- Verify weekly cron schedule is configured correctly
- Test npm audit failure handling
- Test optional Snyk integration with and without token
- Verify workflow uses correct pnpm version

## References

- `docs/RELEASE.md` section 3 - Security workflow specification
- `.github/workflows/ci.yml` - Reference for pnpm setup and structure
- `package.json` - Contains package manager version
- IDEA-009 - Full idea specification
