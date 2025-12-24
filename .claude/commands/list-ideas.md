---
description: List ideas filtered by status
---

# List Ideas

Display all ideas with optional filtering by status. Shows a formatted table with key metadata.

## Workflow

1. **Accept optional filter parameter**:
   - `on-validation` - only pending ideas
   - `accepted` - only accepted ideas
   - `rejected` - only rejected ideas
   - `all` or no parameter - all ideas from all directories

2. **Read idea files**:
   - Based on filter, read from appropriate directories:
     - `ideas/on-validation/`
     - `ideas/accepted/`
     - `ideas/rejected/`
   - Parse frontmatter from each file
   - Extract: id, title, status, category, effort, impact, created_date, validated_date, rejection_reason

3. **Sort ideas**:
   - Primary sort: by created_date (newest first)
   - Secondary sort: by status (on-validation, accepted, rejected)

4. **Display formatted table**:
   - Show summary count at top
   - Display table with columns: ID, Title, Status, Category, Effort, Impact, Created
   - For rejected ideas, show rejection_reason in expandable section

## Output Format

### For All Ideas or Filtered

```markdown
## Ideas List - {Filter}

Total: X ideas ({Y on-validation, Z accepted, W rejected})

| ID | Title | Status | Category | Effort | Impact | Created |
|----|-------|--------|----------|--------|--------|---------|
| IDEA-003 | Add CSV export | accepted | feature | low | medium | 2025-12-24 |
| IDEA-002 | Rewrite in Rust | rejected | refactor | high | low | 2025-12-24 |
| IDEA-001 | Add dark mode | on-validation | feature | - | - | 2025-12-23 |
```

### For Rejected Ideas (Show Reasons)

```markdown
## Ideas List - rejected

Total: 2 rejected ideas

| ID | Title | Category | Effort | Impact | Rejection Reason |
|----|-------|----------|--------|--------|------------------|
| IDEA-002 | Rewrite in Rust | refactor | high | low | Out of scope - TypeScript is core to project |
| IDEA-005 | Add blockchain | feature | high | low | Not aligned with project vision |
```

## Filter Options

| Filter | Directories Read | Use Case |
|--------|-----------------|----------|
| `on-validation` | `ideas/on-validation/` | See what needs validation |
| `accepted` | `ideas/accepted/` | See what's approved for backlog |
| `rejected` | `ideas/rejected/` | Review past decisions |
| `all` or none | All three directories | Complete overview |

## Execute Now

1. Determine filter from user input (default to "all")
2. Read idea files from appropriate directories
3. Parse frontmatter from each file
4. Sort by created_date (newest first)
5. Display formatted table with summary
6. For rejected filter, include rejection reasons
