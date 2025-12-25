# List Ideas

Display ideas filtered by status.

## Instructions

When the user runs `/list-ideas [status]`:

### Status Options

- `/list-ideas` or `/list-ideas all` - Show all ideas
- `/list-ideas pending` - Show only pending validation
- `/list-ideas accepted` - Show only accepted
- `/list-ideas rejected` - Show only rejected
- `/list-ideas completed` - Show only completed

### Step 1 - Fetch Ideas

Based on status filter:

```bash
# All ideas
gh issue list --label "idea" --state all --json number,title,labels,createdAt,state --limit 100

# Pending only
gh issue list --label "idea:pending" --json number,title,labels,createdAt --limit 50

# Accepted only
gh issue list --label "idea:accepted" --json number,title,labels,createdAt --limit 50

# Rejected only
gh issue list --label "idea:rejected" --state closed --json number,title,labels,createdAt --limit 50

# Completed only
gh issue list --label "idea:completed" --state closed --json number,title,labels,createdAt --limit 50
```

### Step 2 - Format Output

Display as a formatted table:

```text
Ideas (pending):

| #   | Title                          | Effort | Impact | Created    |
|-----|--------------------------------|--------|--------|------------|
| #22 | Add Vitest config package      | -      | -      | 2025-12-25 |
| #23 | CLI improvements               | -      | -      | 2025-12-25 |

2 ideas pending validation
```

For accepted ideas, include effort/impact from labels:

```text
Ideas (accepted):

| #   | Title                          | Effort | Impact | Created    |
|-----|--------------------------------|--------|--------|------------|
| #12 | JSON schema validation         | Low    | High   | 2025-12-20 |
| #15 | Generate TS types              | Medium | High   | 2025-12-21 |

2 ideas ready for /feed-backlog
```

### Step 3 - Show Summary Stats

At the end, show overview:

```text
Summary:
- Pending: 2
- Accepted: 3
- Rejected: 2
- Completed: 10
- Total: 17
```

## Sorting

- Default: Newest first (by creation date)
- Accepted ideas: Can sort by priority (effort/impact matrix)

## Example

```text
/list-ideas

Ideas Overview:

PENDING (2):
| #   | Title                     | Created    |
|-----|---------------------------|------------|
| #22 | Add Vitest config         | 2025-12-25 |
| #23 | CLI improvements          | 2025-12-25 |

ACCEPTED (2):
| #   | Title                     | Effort | Impact | Created    |
|-----|---------------------------|--------|--------|------------|
| #12 | JSON schema validation    | Low    | High   | 2025-12-20 |
| #15 | Generate TS types         | Medium | High   | 2025-12-21 |

REJECTED (1):
| #   | Title                     | Reason                    |
|-----|---------------------------|---------------------------|
| #18 | Dark mode for docs        | Out of scope              |

Summary: 2 pending, 2 accepted, 1 rejected, 10 completed (15 total)
```
