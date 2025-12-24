---
id: IDEA-009
title: Add Security Workflow for GitHub Actions
status: accepted
category: improvement
created_date: 2025-01-27
validated_date: 2025-01-27
effort: low
impact: medium
rejection_reason: null
---

# Add Security Workflow for GitHub Actions

## Description

While the project has CI and release workflows implemented (`.github/workflows/ci.yml` and `.github/workflows/release.yml`), the optional security workflow is missing. This idea proposes adding a dedicated security scanning workflow to automatically detect vulnerabilities in dependencies and provide ongoing security monitoring.

The security workflow would complement the existing CI/CD infrastructure by adding automated vulnerability scanning on pushes, pull requests, and scheduled weekly scans.

## Motivation

- **Dependency Security**: Automatically detect known vulnerabilities in npm dependencies
- **Proactive Monitoring**: Weekly scheduled scans catch new vulnerabilities even when code isn't actively changing
- **PR Safety**: Security checks on pull requests prevent vulnerable dependencies from being merged
- **Best Practices**: Security scanning is a standard practice for production npm packages
- **Documentation Alignment**: The workflow is already documented in `docs/RELEASE.md` section 3 but not implemented
- **Low Maintenance**: Once configured, requires minimal ongoing maintenance

## Proposed Solution

Implement `.github/workflows/security.yml` with the following features:

1. **Trigger Points**:
   - Push to `main` branch
   - Pull requests to `main` branch
   - Weekly scheduled scan (Sunday at midnight UTC)

2. **Security Checks**:
   - **npm audit**: Run `pnpm audit --audit-level=moderate` to detect known vulnerabilities
   - **Snyk Integration** (optional): Advanced vulnerability scanning if `SNYK_TOKEN` is configured
   - Fail workflow on moderate or higher severity issues

3. **Configuration**:
   - Use pnpm 9.15.4 (consistent with other workflows)
   - Optional Snyk integration with graceful failure if token not configured
   - Clear error reporting for security issues

## Acceptance Criteria

- [ ] `.github/workflows/security.yml` exists
- [ ] Workflow triggers on push to main and pull requests
- [ ] Workflow includes weekly scheduled scan (cron: '0 0 \* \* 0')
- [ ] npm audit runs with `--audit-level=moderate`
- [ ] Workflow fails on moderate+ severity vulnerabilities
- [ ] Optional Snyk step included with `continue-on-error: true`
- [ ] Workflow uses correct pnpm version (9.15.4)
- [ ] Documentation updated with setup instructions for SNYK_TOKEN (if used)

## Technical Considerations

- **Workflow Location**: `.github/workflows/security.yml`
- **pnpm Setup**: Use `pnpm/action-setup@v4` with version 9.15.4 (consistent with CI workflow)
- **npm Audit**: Use `pnpm audit --audit-level=moderate` to catch significant vulnerabilities
- **Snyk Integration**: Optional step that gracefully handles missing token
- **Scheduling**: Weekly cron job (`0 0 * * 0`) for Sunday midnight UTC
- **Error Handling**: Workflow should fail on security issues but continue on Snyk errors if token not configured
- **Performance**: Lightweight workflow, should complete quickly

## Benefits

- **Automated Vulnerability Detection**: Catch security issues before they reach production
- **Continuous Monitoring**: Weekly scans ensure ongoing security awareness
- **PR Protection**: Prevent merging code with known vulnerabilities
- **Low Overhead**: Minimal maintenance once configured
- **Professional Standards**: Security scanning is expected for production packages

## Implementation Notes

- Reference `docs/RELEASE.md` section 3 for the complete workflow specification
- The workflow template is already documented, just needs to be created
- Snyk integration is optional - workflow should work without it
- Consider starting with npm audit only, then adding Snyk if needed
- Test workflow in a feature branch before merging to main

## Related Documentation

- `docs/RELEASE.md` section 3 - Security workflow specification
- `.github/workflows/ci.yml` - Reference for pnpm setup and structure
- `package.json` - Contains package manager version

## Comparison with Existing Workflows

- **CI Workflow**: Runs on push/PR, focuses on code quality and tests
- **Release Workflow**: Runs on main push, handles publishing
- **Security Workflow** (this idea): Runs on push/PR + weekly schedule, focuses on dependency vulnerabilities

All three workflows complement each other for a complete CI/CD pipeline.
