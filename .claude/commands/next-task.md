# Next Task

Pick the next highest-priority task, work on it, and close it.

## Instructions

When the user runs `/next-task`:

### Step 1 - Find the Next Task

Get open issues sorted by priority:

```bash
gh issue list --state open --json number,title,labels,body --limit 50
```

Filter for task issues (have `type:` label, not `idea` label).

Priority order (pick the first available):

1. `priority:critical` - Do these first
2. `priority:high` - Important tasks
3. `priority:medium` - Normal tasks
4. `priority:low` - When nothing else is available

If multiple issues share the same priority, pick the oldest one (lowest issue number).

### Step 2 - Assign and Start

Assign the issue to yourself and show what you're working on:

```bash
gh issue edit <number> --add-assignee @me
```

Display:

- Issue number and title
- Priority and type labels
- Full description/body

### Step 3 - Assess Complexity

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

### Step 4 - Implement the Task

**For simple tasks:**

1. Read task specification thoroughly
2. Implement directly using Read + Edit tools
3. Write tests if required by acceptance criteria

**For complex tasks:**

1. Invoke `/do-task` skill with task description
2. Let subagents handle implementation

### Step 5 - Verify

Run verification commands:

```bash
pnpm check    # Types + lint + format
pnpm test     # Run tests
pnpm build    # Ensure it builds
```

**All checks must pass before closing.**

If checks fail:

- Fix the issues
- Re-run verification
- Only proceed when all pass

### Step 6 - Complete and Close

After implementation:

1. Show a summary of changes made
2. Close the issue with a comment:

```bash
gh issue close <number> --comment "Completed: <brief summary of what was done>"
```

3. Create commit using `/commit` skill

### Step 7 - Report

```text
Task #42 completed!

Changes:
- Added Zod schema for config validation
- Updated parser to validate on load
- Added tests for validation errors

Issue closed.
Commit: feat(config): add validation schema
```

## Edge Cases

- **No open tasks**: Inform the user there are no pending tasks
- **Implementation blocked**: Ask the user for clarification, don't close the issue
- **Task too complex**: Break it down into subtasks if needed, create new issues

## Example Output

```text
Next Task: #42 - Add validation to config parser

Priority: high | Type: feature

Description:
Add schema validation for the configuration file...

---

Working on this now...

[Implementation happens]

---

Task #42 completed!

Changes:
- Added Zod schema for config validation
- Updated parser to validate on load
- Added tests for validation errors

Issue closed.
```
