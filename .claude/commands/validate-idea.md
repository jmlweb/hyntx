# Validate Idea

Evaluate a pending idea and decide whether to accept or reject it.

## Instructions

When the user runs `/validate-idea #N`:

### Step 1 - Fetch the Idea

```bash
gh issue view N --json number,title,body,labels
```

Verify it has the `idea:pending` label. If not, inform user.

### Step 2 - Analyze the Idea

Evaluate against project context:

1. Read relevant files:
   - `README.md`, `AGENTS.md` for project goals
   - Existing codebase structure

2. Check for duplicates:
   - Search existing issues for similar concepts
   - Check if functionality already exists in codebase

3. Assess feasibility:
   - Technical complexity
   - Dependencies required
   - Integration with existing architecture

### Step 3 - Estimate Effort and Impact

**Effort levels:**

| Level  | Time     | Scope                            |
| ------ | -------- | -------------------------------- |
| Low    | <2 hours | Single file, minimal testing     |
| Medium | 2-8 hrs  | Multiple files, moderate testing |
| High   | >8 hours | Significant changes, extensive   |

**Impact levels:**

| Level  | Description                              |
| ------ | ---------------------------------------- |
| Low    | Nice to have, minimal user benefit       |
| Medium | Noticeable improvement, moderate benefit |
| High   | Game changer, significant benefit        |

### Step 4 - Apply Decision

**If ACCEPTED:**

```bash
gh issue edit N \
  --remove-label "idea:pending" \
  --add-label "idea:accepted,effort:medium,impact:high"

gh issue comment N --body "$(cat <<'EOF'
## Validation: ACCEPTED

**Effort:** [level] | **Impact:** [level]

**Reasoning:** [Why accepted]

*Ready for /feed-backlog*
EOF
)"
```

**If REJECTED:**

```bash
gh issue edit N \
  --remove-label "idea:pending" \
  --add-label "idea:rejected"

gh issue comment N --body "$(cat <<'EOF'
## Validation: REJECTED

**Reason:** [Why rejected]
EOF
)"

gh issue close N
```

## Decision Guidelines

**Accept when:**

- High impact + low effort (quick wins)
- Aligns with current project goals
- Solves real pain point
- Not duplicated

**Reject when:**

- Low ROI (low impact + high effort)
- Out of scope for project
- Duplicate of existing work
- Infeasible or unmaintainable
