# Validate Ideas (Batch)

Review and validate all pending ideas in a single session.

## Instructions

When the user runs `/validate-ideas`:

### Step 1 - Fetch All Pending Ideas

```bash
gh issue list --label "idea:pending" --json number,title,body --limit 50
```

If no pending ideas, inform the user and exit.

### Step 2 - Analyze Each Idea

For each pending idea:

1. Read the issue content
2. Evaluate effort and impact
3. Determine recommendation (accept/reject)
4. Note reasoning

### Step 3 - Present Summary Table

Display all ideas with recommendations:

```text
Pending Ideas Analysis:

| #   | Title                          | Effort | Impact | Recommendation |
|-----|--------------------------------|--------|--------|----------------|
| #12 | Add JSON schema validation     | Low    | High   | Accept         |
| #15 | Generate TS types from schemas | Medium | High   | Accept         |
| #18 | Dark mode for docs             | High   | Low    | Reject         |
| #20 | Add logging utility            | Low    | Medium | Accept         |

Details:
- #12: Quick win, improves data integrity
- #15: Significant DX improvement, worth the effort
- #18: High effort for cosmetic change, out of scope
- #20: Useful utility, easy to implement
```

### Step 4 - Ask for Confirmation

Options:

1. **Apply all** - Accept/reject all as recommended
2. **Select** - Let user choose which to apply
3. **Cancel** - Make no changes

### Step 5 - Apply Decisions

For each confirmed decision, execute the same logic as `/validate-idea`:

```bash
# For accepted ideas
gh issue edit N \
  --remove-label "idea:pending" \
  --add-label "idea:accepted,effort:low,impact:high"

gh issue comment N --body "## Validation: ACCEPTED..."

# For rejected ideas
gh issue edit N \
  --remove-label "idea:pending" \
  --add-label "idea:rejected"

gh issue comment N --body "## Validation: REJECTED..."

gh issue close N
```

### Step 6 - Show Summary

```text
Validation complete:

Accepted: #12, #15, #20
Rejected: #18

3 ideas ready for /feed-backlog
1 idea rejected and closed
```

## Efficiency Tips

- Process ideas in priority order (quick wins first)
- Group similar ideas for consistent evaluation
- Note dependencies between ideas
- Flag potential duplicates

## Example

```text
/validate-ideas

Found 4 pending ideas. Analyzing...

| #   | Title                      | Effort | Impact | Rec.   |
|-----|----------------------------|--------|--------|--------|
| #12 | JSON schema validation     | Low    | High   | Accept |
| #15 | Generate TS types          | Medium | High   | Accept |
| #18 | Dark mode for docs         | High   | Low    | Reject |
| #20 | Add logging utility        | Low    | Medium | Accept |

Apply all recommendations? [Yes/Select/Cancel]
> Yes

Done! 3 accepted, 1 rejected.
```
