---
description: Pick next task from roadmap, execute it, and complete the full workflow
---

# Next Task

Automatically pick the next task from `ROADMAP.md`, execute it, and complete the full workflow (implement → verify → cleanup → commit).

## Workflow

### 1. Select Next Task

Read `ROADMAP.md` and select the next task following priority order:

- P0 (Critical) → P1 (High) → P2 (Medium) → P3 (Low)
- Within same priority, follow the order listed in roadmap
- Skip tasks whose dependencies are not completed

**Check dependencies**: Read the task file to verify all dependencies are marked as completed in roadmap.

### 2. Assess Complexity

Read `backlog/<task-name>.md` and assess complexity:

**Simple** (execute directly):

- Single file changes
- Clear implementation path
- No architectural decisions
- Following existing patterns
- < 100 lines of code expected

**Complex** (delegate to /do-task):

- Multi-file changes
- Requires planning/architecture decisions
- New patterns or integrations
- Security-sensitive code
- Database changes

### 3. Execute Task

**For simple tasks**:

1. Read task specification thoroughly
2. Implement directly using Read + Edit tools
3. Write tests if required by acceptance criteria

**For complex tasks**:

1. Invoke `/do-task` skill with task description
2. Let subagents handle implementation

### 4. Verify

Run verification commands:

```bash
pnpm check    # Types + lint + format
pnpm test     # Run tests
pnpm build    # Ensure it builds
```

**All checks must pass before proceeding to cleanup.**

If checks fail:

- Fix the issues
- Re-run verification
- Only proceed when all pass

### 5. Cleanup

Once verified:

1. **Delete task file**: `rm backlog/<task-name>.md`
2. **Update ROADMAP.md**: Remove the task entry or mark as completed
3. **Create commit** using `/commit` skill with message format:
   ```
   feat(<module>): implement <task description>
   ```

## Decision Tree

```
1. Read ROADMAP.md
2. Find first incomplete task (P0 first)
3. Check dependencies → all completed?
   No → Skip, try next task
   Yes → Continue
4. Read backlog/<task>.md
5. Assess complexity:
   Simple → Execute directly
   Complex → Invoke /do-task
6. Run pnpm check && pnpm test && pnpm build
   Pass → Continue
   Fail → Fix and retry
7. Delete backlog/<task>.md
8. Update ROADMAP.md (remove task entry)
9. /commit with descriptive message
10. Report completion to user
```

## Example Execution

```
Orchestrator:
1. Reads ROADMAP.md → Next task: "tipos-base.md" (P0, no deps)
2. Reads backlog/tipos-base.md → Simple (single file, type definitions)
3. Implements src/types/index.ts directly
4. Runs pnpm check → Pass
5. Runs pnpm test → Pass
6. Runs pnpm build → Pass
7. Deletes backlog/tipos-base.md
8. Updates ROADMAP.md (removes tipos-base entry)
9. Creates commit: "feat(types): implement TypeScript type system"
10. Reports: "✓ Completed: tipos-base.md"
```

## Error Handling

- **Dependency not met**: Skip task, report which dependency is missing
- **Verification fails**: Fix issues, do not proceed to cleanup until passing
- **No tasks available**: Report "All tasks completed" or "Remaining tasks have unmet dependencies"

## Execute Now

1. Read ROADMAP.md to find next task
2. Verify dependencies are met
3. Assess complexity and execute appropriately
4. Complete full workflow (verify → cleanup → commit)
