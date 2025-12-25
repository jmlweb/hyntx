# Groom Tasks

Evaluate all open tasks for relevance and update priorities.

## Instructions

When the user runs `/groom-tasks`:

### Step 1 - Fetch All Open Tasks

```bash
gh issue list --state open --json number,title,labels,body,createdAt --limit 100
```

Filter for task issues (have `type:` label, not `idea` label).

### Step 2 - Evaluate Each Task

For each task, check:

**Relevance:**

- Is the task still needed?
- Has the functionality already been implemented?
- Has the requirement changed?

**Priority Accuracy:**

- Does the current priority still make sense?
- Are there new factors that affect priority?

**Specification Quality:**

- Is the description clear and actionable?
- Are acceptance criteria defined?

### Step 3 - Identify Actions

For each task, determine:

**Update if:**

- Priority needs adjustment
- Description needs clarification
- Labels are incorrect or missing

**Close if:**

- Already implemented (check codebase)
- No longer relevant
- Duplicate of another task

**Keep as-is if:**

- Specification is clear
- Priority is appropriate
- Still relevant

### Step 4 - Present Summary

```text
Task Grooming Analysis:

| #   | Title                    | Current  | Action           |
|-----|--------------------------|----------|------------------|
| #25 | Add validation           | medium   | Keep             |
| #26 | Dark mode support        | high     | Lower to medium  |
| #27 | Fix auth bug             | low      | Raise to high    |
| #28 | Rewrite in Rust          | medium   | Close (obsolete) |

Details:
- #26: Not urgent, can wait - suggest medium
- #27: Security issue, should be high priority
- #28: Out of scope, recommend closing

Apply these changes? [Yes/Select/Cancel]
```

### Step 5 - Apply Changes

For approved changes:

```bash
# Update priority
gh issue edit N --remove-label "priority:old" --add-label "priority:new"

# Close obsolete task
gh issue close N --comment "Closed during grooming: [reason]"
```

### Step 6 - Report Summary

```text
Grooming complete:

- Updated: 2 tasks
  - #26: priority:high -> priority:medium
  - #27: priority:low -> priority:high
- Closed: 1 task
  - #28: Obsolete (out of scope)
- Unchanged: 5 tasks

Use /next-task to continue working.
```

## Decision Criteria

### Raise Priority If:

- Security-related keywords (vulnerability, auth, XSS)
- Production blockers
- Bug affecting core functionality
- Issue has been open for too long

### Lower Priority If:

- "Nice to have" language
- Purely cosmetic changes
- Low-impact improvements
- Workaround exists

### Close If:

- Functionality already exists in codebase
- Task is duplicate of another
- Task is obsolete due to architectural changes
- Out of project scope

## Example

```text
/groom-tasks

Analyzing 8 open tasks...

| #   | Title                    | Priority | Action          |
|-----|--------------------------|----------|-----------------|
| #12 | Fix auth token leak      | medium   | Raise: critical |
| #15 | Add dark mode            | high     | Lower: medium   |
| #18 | Button not working       | low      | Raise: high     |
| #20 | Update README            | medium   | Keep            |
| #22 | Refactor to classes      | medium   | Close: obsolete |

Apply? [Yes/Select/Cancel]
> Yes

Done! 3 updated, 1 closed, 4 unchanged.
```
