# Complete Idea

Mark an accepted idea as completed after all its tasks are done.

## Instructions

When the user runs `/complete-idea #N`:

### Step 1 - Fetch the Idea

```bash
gh issue view N --json number,title,body,labels,state
```

Verify:

- Has `idea:accepted` label
- Is still open

### Step 2 - Find Related Tasks

Search for tasks that reference this idea:

```bash
gh issue list --search "idea #N in:body" --state all --json number,title,state
```

Also check the idea's body/comments for task references.

### Step 3 - Verify Task Completion

Check if all related tasks are closed. If any are still open:

```text
Cannot complete idea #N:

Open tasks:
- #25: Implement validation (still open)

Complete all related tasks first.
```

### Step 4 - Mark as Completed

If all tasks are closed (or user confirms direct implementation):

```bash
gh issue edit N \
  --remove-label "idea:accepted" \
  --add-label "idea:completed"

gh issue comment N --body "$(cat <<'EOF'
## Idea Completed

All tasks derived from this idea have been implemented.

**Completed on:** $(date +%Y-%m-%d)
EOF
)"

gh issue close N
```

### Step 5 - Confirm

```text
Idea #N completed!

- Status: idea:completed
- Closed on: 2025-12-26
- Related tasks: #25, #26, #27 (all closed)
```

## Edge Cases

**No related tasks found:**

```text
Idea #N has no linked tasks.

This could mean:
1. Tasks were completed and closed
2. Idea was implemented without creating tasks
3. /feed-backlog was never run for this idea

Confirm this idea is fully implemented? [y/n]
```

**Idea not found or wrong status:**

```text
Error: Issue #N is not an accepted idea.

Current status: idea:pending (or idea:completed, etc.)

Use /list-ideas accepted to see ideas ready for completion.
```

## Idea Lifecycle

```text
/add-idea       -> Creates idea (idea:pending)
/validate-idea  -> Accepts or rejects (idea:accepted | idea:rejected)
/feed-backlog   -> Creates tasks from accepted ideas
/next-task      -> Implements tasks
/complete-idea  -> Closes the cycle (idea:completed)
```
