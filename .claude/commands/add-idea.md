# Add Idea

Create a new idea as a GitHub Issue pending validation.

## Instructions

When the user runs `/add-idea <description>`:

### Step 1 - Analyze the Idea

Parse the user's description to extract:

- A clear, concise title (max 80 chars)
- Expanded description with context
- Category suggestion: `feature`, `improvement`, `refactor`, `fix`, `documentation`, or `other`

### Step 2 - Create the Issue

```bash
gh issue create \
  --title "[IDEA] Title here" \
  --body "$(cat <<'EOF'
## Description

[Expanded description of the idea]

## Motivation

[Why this idea could be valuable]

## Proposed Approach

[High-level suggestion for implementation]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

---
*This is an idea pending validation. Use `/validate-idea #N` to evaluate it.*
EOF
)" \
  --label "idea,idea:pending"
```

### Step 3 - Confirm Creation

Display:

- Issue number and URL
- Title and labels
- Reminder that it needs validation

## Guidelines

**Good ideas include:**

- Clear problem or opportunity statement
- Potential benefit to users or developers
- Rough scope indication

**Be generous with idea creation:**

- Ideas are cheap to create
- Validation happens later
- Better to capture than forget

## Example

User: `/add-idea Add a CLI command to generate TypeScript types from JSON schemas`

Creates:

```text
Issue #15: [IDEA] Generate TypeScript types from JSON schemas

Labels: idea, idea:pending

Description:
Add a CLI command that reads JSON Schema files and generates
corresponding TypeScript type definitions...

Created! Use `/validate-idea #15` to evaluate this idea.
```
