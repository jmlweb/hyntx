# Feed Backlog

Convert accepted ideas into actionable tasks (GitHub Issues).

## Instructions

When the user runs `/feed-backlog`:

### Step 1 - Fetch Accepted Ideas

```bash
gh issue list --label "idea:accepted" --json number,title,body,labels --limit 50
```

If no accepted ideas, inform user and exit.

### Step 2 - Analyze Each Idea

For each accepted idea:

1. Read the full issue content
2. Extract acceptance criteria
3. Determine task breakdown (if needed)
4. Map effort/impact to priority:

| Effort | Impact | Priority |
| ------ | ------ | -------- |
| Low    | High   | critical |
| Low    | Medium | high     |
| Low    | Low    | medium   |
| Medium | High   | high     |
| Medium | Medium | medium   |
| Medium | Low    | low      |
| High   | High   | high     |
| High   | Medium | medium   |
| High   | Low    | low      |

5. Determine task type:
   - feature/improvement -> `type:feature`
   - refactor -> `type:chore`
   - fix -> `type:bug`
   - documentation -> `type:chore`

### Step 3 - Present Conversion Plan

```text
Ready to convert 3 accepted ideas to tasks:

| Idea  | Title                      | Tasks | Priority |
|-------|----------------------------|-------|----------|
| #12   | JSON schema validation     | 1     | critical |
| #15   | Generate TS types          | 2     | high     |
| #20   | Add logging utility        | 1     | medium   |

Breakdown:
- #12 -> 1 task: "Implement JSON schema validation"
- #15 -> 2 tasks: "Create type generator CLI", "Add tests for generator"
- #20 -> 1 task: "Add logging utility package"

Proceed? [Yes/No]
```

### Step 4 - Create Tasks

For each task:

```bash
gh issue create \
  --title "Task title here" \
  --body "$(cat <<'EOF'
## Description

[Task description derived from idea]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Source

Derived from idea #N: [Idea title]

---
*Created via /feed-backlog*
EOF
)" \
  --label "type:feature,priority:high"
```

### Step 5 - Update Idea Issues

After creating tasks, update the original idea:

```bash
gh issue comment N --body "$(cat <<'EOF'
## Converted to Backlog

This idea has been converted to the following task(s):
- #X: Task title 1
- #Y: Task title 2

The idea will remain open until all tasks are completed.
Use `/complete-idea #N` when done.
EOF
)"
```

### Step 6 - Show Summary

```text
Backlog updated!

Created tasks:
- #25: Implement JSON schema validation (from #12)
- #26: Create type generator CLI (from #15)
- #27: Add tests for generator (from #15)
- #28: Add logging utility package (from #20)

Ideas updated with task references.
Use /next-task to start working!
```

## Task Breakdown Guidelines

**Single task when:**

- Clear, atomic deliverable
- Can be completed in one session
- No logical sub-parts

**Multiple tasks when:**

- Multiple components needed
- Separate testing required
- Can be parallelized
- Different skill sets needed

## Example

```text
/feed-backlog

Found 2 accepted ideas:

| Idea | Title              | Effort | Impact | Priority |
|------|--------------------|--------|--------|----------|
| #12  | Schema validation  | Low    | High   | critical |
| #15  | TS type generator  | Medium | High   | high     |

Tasks to create:
1. #12 -> "Implement JSON schema validation" (priority:critical)
2. #15 -> "Create type generator CLI" (priority:high)
3. #15 -> "Add generator tests" (priority:high)

Create these 3 tasks? [Yes/No]
> Yes

Created:
- #25: Implement JSON schema validation
- #26: Create type generator CLI
- #27: Add generator tests

Ideas #12 and #15 updated with task references.
```
