# Parallelize CI Workflow Jobs

## Metadata

- **Priority**: P3
- **Phase**: 3
- **Dependencies**: None
- **Estimation**: 1-2 hours
- **Source**: IDEA-012 - Parallelize CI Workflow Jobs

## Description

Restructure the CI workflow to run independent quality checks in parallel. Currently, all checks run sequentially in a single job (typecheck → lint → format → test → build), taking 2-3 minutes. By parallelizing independent jobs, we can reduce CI time by 30-40%.

## Objective

Improve developer experience by providing faster CI feedback, enabling quicker iteration on pull requests.

## Scope

- Includes:
  - Restructure `.github/workflows/ci.yml` to use parallel jobs
  - Implement dependency caching between jobs
  - Maintain existing concurrency settings
- Excludes:
  - Changes to the actual check commands
  - Modifications to test configuration
  - Changes to other workflows

## Files to Create/Modify

- `.github/workflows/ci.yml` - Main CI workflow file

## Implementation

1. **Create install job**:
   - Checkout code
   - Setup pnpm and Node.js
   - Install dependencies with `--frozen-lockfile`
   - Cache `node_modules` using `actions/cache/save`

2. **Create parallel quality jobs** (all depend on install):
   - `typecheck`: Restore cache, run `pnpm typecheck`
   - `lint`: Restore cache, run `pnpm lint`
   - `format`: Restore cache, run `pnpm format:check`
   - `test`: Restore cache, run `pnpm test:coverage`, upload to Codecov

3. **Create build job**:
   - Depends on all quality jobs passing
   - Restore cache, run `pnpm build`

4. **Preserve existing settings**:
   - Keep `concurrency` settings for canceling outdated runs
   - Maintain Node.js version (22.x)
   - Keep Codecov integration

## Acceptance Criteria

- [ ] CI workflow uses parallel jobs for independent checks
- [ ] Typecheck, lint, and format run in parallel after dependency installation
- [ ] Test job runs in parallel with quality checks
- [ ] Build job only runs after all checks pass
- [ ] Total CI time reduced by at least 25%
- [ ] No regression in CI reliability
- [ ] Concurrency settings still cancel outdated runs
- [ ] Cache is properly shared between jobs

## Test Cases

- Push to branch and verify parallel job execution in GitHub Actions
- Verify failing job correctly prevents build from running
- Verify cache is restored correctly in dependent jobs
- Measure CI time before and after to confirm improvement

## References

- IDEA-012 - Full idea specification
- [GitHub Actions: Using jobs in a workflow](https://docs.github.com/en/actions/using-jobs)
- [actions/cache](https://github.com/actions/cache)
