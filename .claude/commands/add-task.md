# Add Task

Create a new task as a GitHub Issue.

## Instructions

When the user runs `/add-task <description>`:

### Step 1 - Analyze the Task

Parse the user's description to determine:

- A clear, concise title (max 80 chars)
- A detailed description with acceptance criteria if applicable
- Task type: `type:feature`, `type:bug`, or `type:chore`
- Priority: `priority:critical`, `priority:high`, `priority:medium`, or `priority:low`

### Step 2 - Create the Issue

```bash
gh issue create \
  --title "Title here" \
  --body "$(cat <<'EOF'
## Description

[Task description]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

---
*Created via /add-task*
EOF
)" \
  --label "type:feature,priority:medium"
```

### Step 3 - Confirm Creation

Display:

- Issue number and URL
- Title, type, and priority labels
- Next steps

## Priority Guidelines

| Priority | Description                                          |
| -------- | ---------------------------------------------------- |
| critical | Blocks deployments, security issues, production bugs |
| high     | Important feature, significant bug, deadline-driven  |
| medium   | Standard work, normal feature requests               |
| low      | Nice-to-have, minor improvements, can wait           |

## Type Guidelines

| Type    | Description                                     |
| ------- | ----------------------------------------------- |
| feature | New functionality, new capability               |
| bug     | Something is broken or not working as expected  |
| chore   | Refactoring, dependencies, documentation, CI/CD |

## Example

User: `/add-task Add dark mode support to the CLI output`

Creates:

```text
Issue #25: Add dark mode support to CLI output

Labels: type:feature, priority:medium

Description:
Add dark mode support to the CLI output for better visibility
in dark terminal themes...

Created! Use /next-task to start working on it.
```
