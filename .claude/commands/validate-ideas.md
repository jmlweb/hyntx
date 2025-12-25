---
description: Review ideas in on-validation and move them if appropriate
---

# Validate Ideas

Batch review all ideas currently in `ideas/on-validation/` and suggest moving them to `ideas/accepted/` or `ideas/rejected/` based on current project context.

## Workflow

1. **List all pending ideas**:
   - Read all files in `ideas/on-validation/`
   - Parse frontmatter and descriptions
   - Count total pending ideas

2. **Analyze each idea**:
   - Read current docs/ROADMAP.md for context
   - Read AGENTS.md for project goals
   - Evaluate each idea against:
     - Current project phase and priorities
     - Existing backlog tasks
     - Technical feasibility
     - Impact vs effort ratio

3. **Generate recommendations**:
   - For each idea, suggest: accept or reject
   - Provide reasoning based on analysis
   - Assign effort and impact estimates
   - Draft rejection reasons for rejected ideas

4. **Present to user**:
   - Show summary table of all ideas with recommendations
   - For each idea, display:
     - ID and title
     - Recommendation (accept/reject)
     - Reasoning
     - Suggested effort/impact (if accepting)

5. **Execute decisions**:
   - Ask user to approve/modify recommendations
   - For each approved action:
     - Update idea frontmatter
     - Move file to appropriate directory
   - Report final counts (accepted, rejected, still pending)

## Analysis Criteria

### Context to Consider

- **Current roadmap phase**: What phase is the project in?
- **Existing tasks**: Does this duplicate or conflict with backlog?
- **Recent completed work**: Has context changed?
- **Technical debt**: Does this address or add to debt?

### Prioritization Matrix

```text
High Impact, Low Effort  → ACCEPT (Quick wins)
High Impact, High Effort → ACCEPT if aligns with roadmap
Low Impact, Low Effort   → ACCEPT if nice-to-have
Low Impact, High Effort  → REJECT (Poor ROI)
```

### Red Flags for Rejection

- Duplicates existing functionality
- Out of project scope
- Blocked by missing dependencies
- Conflicts with code style or architecture
- Security/quality concerns

## Output Format

Show a table like this:

```markdown
## Validation Summary

Total ideas in validation: X

| ID       | Title           | Recommendation | Effort | Impact | Reasoning                           |
| -------- | --------------- | -------------- | ------ | ------ | ----------------------------------- |
| IDEA-001 | Add dark mode   | Accept         | medium | high   | Aligns with Phase 4, user-requested |
| IDEA-002 | Rewrite in Rust | Reject         | high   | low    | Out of scope, TypeScript is core    |
| IDEA-003 | Add CSV export  | Accept         | low    | medium | Natural extension of reporters      |
```

## Execute Now

1. Read all ideas from `ideas/on-validation/`
2. Analyze against current project context (docs/ROADMAP.md, backlog/)
3. Generate recommendations for each idea
4. Present summary table to user
5. Ask for approval to proceed
6. Update and move approved ideas
7. Report final results
