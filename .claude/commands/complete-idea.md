---
description: Mark an idea as completed when all related tasks are done
---

# Complete Idea

Move a fully implemented idea from `ideas/accepted/` to `ideas/completed/`. This provides a quick way to check which ideas are done without reading file contents.

## Workflow

1. **Find the idea**:
   - Accept IDEA-XXX ID as parameter
   - Locate file in `ideas/accepted/` directory
   - Read and parse frontmatter and content

2. **Check related tasks**:
   - Look for "Related Tasks" section in the idea file
   - For each linked task in backlog/:
     - Check if task file still exists (deleted = completed)
     - Or check if task has status: completed in frontmatter
   - Verify ALL related tasks are completed

3. **Validate completion**:
   - If no related tasks: Ask user to confirm the idea was implemented directly
   - If some tasks incomplete: Report which tasks are still pending and abort
   - If all tasks complete: Proceed to mark as completed

4. **Update idea file**:
   - Set `status: completed`
   - Set `completed_date` to current date
   - Add completion note to "Validation Notes" section

5. **Move file**:
   - Move from `ideas/accepted/` to `ideas/completed/`
   - Preserve filename
   - Do not delete `ideas/accepted/` even if it becomes empty (keep a placeholder file like `ideas/accepted/README.md` so git preserves the directory)

6. **Report completion**:
   - Confirm the move
   - Show completed_date

## Task Completion Detection

Tasks are considered complete when:

- Task file no longer exists in backlog/ (was removed after implementation)
- Task references appear in git history as completed
- User explicitly confirms task was implemented

## Benefits

- **Quick status check**: `ls ideas/completed/` shows all done ideas
- **No file parsing needed**: Directory location indicates status
- **Clear separation**: In-progress vs done ideas are visually distinct
- **Audit trail**: completed_date provides implementation timeline

## Output Format

```text
Checking IDEA-XXX ({title}):

Related tasks:
- add-feature-a.md ✓ (not in backlog - completed)
- add-feature-b.md ✓ (not in backlog - completed)

All 2 tasks completed.

✓ Updated status: completed
✓ Set completed_date: 2025-12-25
✓ Moved to ideas/completed/IDEA-XXX-{slug}.md

Idea IDEA-XXX is now marked as completed.
```

## Error Cases

### Idea not found

```text
Error: IDEA-XXX not found in ideas/accepted/

Check if:
- The ID is correct (use /list-ideas accepted)
- The idea is still in on-validation/ (not yet accepted)
- The idea was already completed or rejected
```

### Tasks still pending

```text
Cannot complete IDEA-XXX ({title}):

Pending tasks:
- add-feature-c.md (still in backlog/)

Complete all related tasks first, or remove them from the idea's Related Tasks section if they're no longer needed.
```

### No related tasks

```text
IDEA-XXX ({title}) has no related tasks in backlog.

This could mean:
1. Tasks were completed and removed
2. Idea was implemented without creating tasks
3. /feed-backlog was never run for this idea

Confirm this idea is fully implemented? [y/n]
```

## Execute Now

1. Find and read the specified idea file from `ideas/accepted/`
2. Parse the "Related Tasks" section
3. Check each task's completion status
4. If all complete (or user confirms): update frontmatter and move file
5. Report completion status
