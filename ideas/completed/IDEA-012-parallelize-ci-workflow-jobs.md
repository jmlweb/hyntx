---
id: IDEA-012
title: Parallelize CI Workflow Jobs
status: accepted
category: improvement
created_date: 2025-12-25
validated_date: 2025-12-25
effort: low
impact: medium
rejection_reason: null
---

# Parallelize CI Workflow Jobs

## Description

The current CI workflow runs all quality checks sequentially in a single job: typecheck → lint → format → test → build. These steps take approximately 2-3 minutes total. Since typecheck, lint, and format checks are independent of each other, they can run in parallel as separate jobs, reducing overall CI time by 30-40%.

## Motivation

- **Faster Feedback Loop**: Developers wait for CI results before merging PRs; faster CI means faster iteration
- **Resource Efficiency**: GitHub Actions runners can execute parallel jobs simultaneously
- **Independence**: Typecheck, lint, and format checks have no dependencies on each other
- **Industry Best Practice**: Parallel CI jobs are standard in modern CI/CD pipelines
- **Cost Neutral**: GitHub Actions bills per minute; parallel jobs don't increase cost when total time is reduced

## Proposed Solution

Restructure `.github/workflows/ci.yml` to use parallel jobs:

```yaml
jobs:
  install:
    name: Install Dependencies
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22.x
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - uses: actions/cache/save@v4
        with:
          path: node_modules
          key: deps-${{ github.sha }}

  typecheck:
    name: Type Check
    needs: install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - uses: actions/cache/restore@v4
        with:
          path: node_modules
          key: deps-${{ github.sha }}
      - run: pnpm typecheck

  lint:
    name: Lint
    needs: install
    runs-on: ubuntu-latest
    steps:
      # Same setup pattern
      - run: pnpm lint

  format:
    name: Format Check
    needs: install
    runs-on: ubuntu-latest
    steps:
      # Same setup pattern
      - run: pnpm format:check

  test:
    name: Test
    needs: install
    runs-on: ubuntu-latest
    steps:
      # Same setup pattern
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4

  build:
    name: Build
    needs: [typecheck, lint, format, test]
    runs-on: ubuntu-latest
    steps:
      # Same setup pattern
      - run: pnpm build
```

## Acceptance Criteria

- [ ] CI workflow uses parallel jobs for independent checks
- [ ] Typecheck, lint, and format run in parallel after dependency installation
- [ ] Test job runs in parallel with quality checks
- [ ] Build job only runs after all checks pass
- [ ] Total CI time reduced by at least 25%
- [ ] No regression in CI reliability
- [ ] Concurrency settings still cancel outdated runs

## Technical Considerations

- **Cache Strategy**: Use `actions/cache/save` and `actions/cache/restore` to share `node_modules` between jobs
- **Job Dependencies**: Use `needs:` to express job dependencies correctly
- **Failure Handling**: If any parallel job fails, dependent jobs are skipped automatically
- **Concurrency**: Keep existing `concurrency` settings for canceling outdated runs
- **Matrix Alternative**: Could use matrix strategy, but explicit jobs provide clearer status checks

## Validation Notes

**Validated**: 2025-12-25

**Decision**: ACCEPTED

**Reasoning**:

- Low effort with measurable CI time reduction (30-40%)
- Faster developer feedback loop improves DX
- Industry standard practice for modern CI/CD pipelines
- Cost neutral - parallel jobs reduce total billable minutes
- No risk - explicit job dependencies ensure correct execution order
- Aligns with maintenance phase focus on developer experience

**Priority**: P3 (nice-to-have improvement, not blocking)

## Related Tasks

- `parallelize-ci-workflow-jobs.md` - P3, Phase 3 (task file removed after completion)
