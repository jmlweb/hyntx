---
description: Add a new task to backlog and update roadmap
---

# Add Task to Backlog

Add a new task to `backlog/` and update `docs/ROADMAP.md`.

## Workflow

1. **Ask for task details** using AskUserQuestion:
   - Description: What should this task accomplish?
   - Priority: High (P1) / Medium (P2) / Low (P3)

2. **Generate task file**:
   - Ensure `backlog/` exists (create it if missing). Never delete the `backlog/` directory; keep a placeholder file (for example `backlog/README.md`) so git preserves the folder even when it has no tasks.
   - Filename: kebab-case from description (e.g., `add-dark-mode.md`)
   - Location: `backlog/<filename>.md`
   - Phase: P1 → Phase 2, P2 → Phase 3, P3 → Phase 4

3. **Update docs/ROADMAP.md**:
   - Add entry in corresponding phase section
   - Include link to backlog file

## Task Template

Use this template for the generated file:

```markdown
# {Title}

## Metadata

- **Priority**: {P1/P2/P3}
- **Phase**: {2/3/4}
- **Dependencies**: TBD
- **Estimation**: TBD

## Description

{Expanded description based on user input}

## Objective

{Inferred from description}

## Scope

- Includes: {Main deliverables}
- Excludes: Out of scope items

## Files to Create/Modify

- TBD

## Implementation

TBD

## Acceptance Criteria

- [ ] Implementation complete
- [ ] Tests pass
- [ ] Linting passes

## Test Cases

- TBD

## References

- See docs/ROADMAP.md for context
```

## Priority Mapping

| Selection | Priority | Phase | ROADMAP Section            |
| --------- | -------- | ----- | -------------------------- |
| High      | P1       | 2     | Phase 2: Core Functional   |
| Medium    | P2       | 3     | Phase 3: CLI and Providers |
| Low       | P3       | 4     | Phase 4: Advanced Features |

## Execute Now

Ask the user for description and priority, then create the task file and update docs/ROADMAP.md.
