# Reprioritize

Analyze all open tasks and automatically reprioritize them.

## Instructions

When the user runs `/reprioritize`:

### Step 1 - Fetch All Open Issues

```bash
gh issue list --state open --json number,title,labels,body,createdAt --limit 100
```

Filter for task issues (have `type:` label, not `idea` label).

### Step 2 - Analyze Each Issue

For each issue, evaluate priority based on:

**Factors that increase priority:**

- Security-related keywords (vulnerability, security, auth, XSS, injection)
- Production/deployment blockers
- Bug vs feature (bugs generally higher than features)
- Issue age (older unresolved issues may need attention)
- Dependencies (if other issues depend on this one)

**Factors that decrease priority:**

- "Nice to have" language
- Purely cosmetic changes
- Low-impact improvements
- Already has workaround mentioned

### Step 3 - Propose Changes

Display a table showing:

- Current priority
- Suggested priority
- Reason for change (if any)

```text
Proposed Priority Changes:

| Issue | Title                    | Current  | Suggested | Reason                         |
|-------|--------------------------|----------|-----------|--------------------------------|
| #12   | Fix auth token leak      | medium   | critical  | Security-related (auth bypass) |
| #15   | Add dark mode            | high     | medium    | Feature request, not urgent    |
| #18   | Button click not working | low      | high      | Bug affecting user experience  |
| #20   | Update README            | (none)   | low       | Missing priority label         |
```

### Step 4 - Ask for Confirmation

Before applying changes, ask the user:

- "Apply all changes?"
- "Apply selected changes?" (let user pick)
- "Cancel"

### Step 5 - Apply Changes

For each approved change:

```bash
# Remove old priority label
gh issue edit <number> --remove-label "priority:old"

# Add new priority label
gh issue edit <number> --add-label "priority:new"
```

### Step 6 - Summary

Show final summary of changes made.

```text
Reprioritization complete:

Updated:
- #12: medium -> critical (security issue)
- #15: high -> medium (not urgent)
- #18: low -> high (blocking bug)
- #20: (none) -> low (added missing label)

4 issues updated.
```

## Priority Levels

| Priority | Description                                          |
| -------- | ---------------------------------------------------- |
| critical | Blocks deployments, security issues, production bugs |
| high     | Important feature, significant bug, deadline-driven  |
| medium   | Standard work, normal feature requests               |
| low      | Nice-to-have, minor improvements, can wait           |

## Edge Cases

- **No open issues**: Inform user there are no tasks to reprioritize
- **All correctly prioritized**: Confirm no changes needed
- **Missing priority labels**: Suggest adding appropriate priority

## Example Output

```text
/reprioritize

Analyzing 8 open issues...

Proposed changes:

| Issue | Title                    | Current | Suggested | Reason                      |
|-------|--------------------------|---------|-----------|------------------------------|
| #12   | Fix auth token leak      | medium  | critical  | Security vulnerability       |
| #15   | Add dark mode            | high    | medium    | Feature, not urgent          |
| #18   | Button click not working | low     | high      | Bug affecting core UX        |
| #20   | Update README            | (none)  | low       | Documentation, low impact    |

Apply these changes? [Yes/No/Select]
> Yes

Done! 4 issues reprioritized.
```
