# Hyntx - Development Roadmap

This roadmap organizes implementation tasks following a Vertical Slicing approach.

---

## Current Phase: Maintenance

All foundational phases (0-4) have been completed. The project is now in maintenance mode.

### Pending Tasks

| Task                                                                                      | Priority | Phase | Source   |
| ----------------------------------------------------------------------------------------- | -------- | ----- | -------- |
| [Add Security Workflow](backlog/add-security-workflow.md)                                 | P2       | 3     | IDEA-009 |
| [Improve CLI Entry Point Test Coverage](backlog/improve-cli-entry-point-test-coverage.md) | P2       | 4     | IDEA-011 |
| [Parallelize CI Workflow Jobs](backlog/parallelize-ci-workflow-jobs.md)                   | P3       | 3     | IDEA-012 |
| [Parallel Log File Reading](backlog/parallel-log-file-reading.md)                         | P3       | 4     | IDEA-013 |

### Accepted Ideas Awaiting Implementation

No ideas awaiting implementation. All accepted ideas have been converted to backlog tasks.

---

## Completed Phases

### Phase 0: Pre-Foundation (3 tasks)

- npm package name reservation
- Unused dependencies removal
- Node version consistency fix

### Phase 1: Foundation (5 tasks)

- TypeScript type system
- Log schema validator
- Complete utilities
- Basic JSONL log reading
- Initial interactive setup

### Phase 2: Core Functional (5 tasks)

- Complete log reading with filters
- Secret sanitizer
- Provider base and Ollama
- Analyzer with Map-Reduce batching
- Terminal reporter

### Phase 2.5: Code Quality (4 tasks)

- ESLint enforcement rules
- Shell config permissions
- Type definitions to devDependencies
- Prettier/ESLint in Husky

### Phase 3: CLI and Providers (11 tasks)

- Basic CLI entry point
- Anthropic provider
- Google provider
- Multi-provider factory with fallback
- Provider retry logic
- Provider rate limiting
- JSON output format
- Multi-provider integration in CLI
- Verbose/debug mode
- Centralized logging system
- Configuration health check
- Security workflow (pending)

### Phase 4: Advanced Features (13 tasks)

- Reminder system
- Markdown format reporter
- Test coverage for setup/shell
- Log reader type safety refactor
- E2E testing infrastructure
- Complete CLI with all options
- Complete error handling
- Shell config edge case refactor
- Project-specific configuration file
- Fix E2E tests (main module detection)
- Analysis history and comparison
- Improve CLI entry point test coverage (pending)

**Total completed**: 39 tasks

---

## Workflow

```bash
pnpm check    # Types + lint + format
pnpm test     # Run tests
pnpm build    # Production build
```

### Adding New Tasks

1. Create idea with `/new-idea`
2. Validate with `/validate-idea`
3. Convert to tasks with `/feed-backlog`
4. Implement with `/next-task`

---

## Notes

- Each task is a complete "vertical slice"
- Dependencies are tracked in task files
- Use `/groom-tasks` to clean up outdated tasks
- Use `/reprioritize` to reorder based on dependencies
