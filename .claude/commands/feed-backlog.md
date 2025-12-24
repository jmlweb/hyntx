---
description: Extract tasks from accepted ideas and add to backlog
---

# Feed Backlog from Ideas

Convert accepted ideas into actionable backlog tasks using the existing `add-task` skill. Ensures traceability between ideas and implementation tasks.

## Workflow

1. **Read all accepted ideas**:
   - Scan `ideas/accepted/` directory
   - Parse frontmatter and content
   - Identify ideas that don't have associated tasks yet

2. **Check for existing tasks**:
   - For each idea, search backlog/ for files containing IDEA-XXX reference
   - Skip ideas that already have tasks
   - Report which ideas already have tasks

3. **Convert acceptance criteria to tasks**:
   - For each new idea:
     - Extract acceptance criteria from idea file
     - Break down into discrete, actionable tasks
     - Map idea impact/effort to task priority:
       - High impact + low/medium effort → P1
       - Medium impact + low/medium effort → P2
       - Low impact or high effort → P3

4. **Create tasks using add-task skill**:
   - For each task derived from idea:
     - Use `Skill` tool to invoke `add-task`
     - Include reference to source IDEA-XXX in task description
     - Set appropriate priority based on impact/effort
     - Add to ROADMAP.md in correct phase

5. **Update idea files**:
   - Add "Related Tasks" section to idea file
   - List all created backlog tasks with links
   - Add note in "Validation Notes" about backlog tasks created

## Priority Mapping

Map idea metrics to task priority:

```text
Impact  | Effort | Priority | Reasoning
--------|--------|----------|----------
high    | low    | P1       | Quick wins, high value
high    | medium | P1       | Core features, worth investment
high    | high   | P2       | Major features, requires planning
medium  | low    | P2       | Nice enhancements
medium  | medium | P2       | Standard improvements
medium  | high   | P3       | Lower priority enhancements
low     | low    | P3       | Minor improvements
low     | medium | P3       | Low value, defer
low     | high   | P3       | Avoid or reject
```

## Task Description Template

When creating tasks from ideas, include reference:

```markdown
# {Task Title}

## Metadata

- **Priority**: {P1/P2/P3}
- **Phase**: {2/3/4}
- **Dependencies**: TBD
- **Estimation**: TBD
- **Source**: IDEA-XXX - {idea title}

## Description

{Derived from idea's acceptance criteria}

{Rest of task template...}
```

## Output Format

Show progress and results:

```markdown
## Feed Backlog Summary

Total accepted ideas: X
Ideas with existing tasks: Y
New ideas to process: Z

### Creating Tasks

Processing IDEA-001 (Add CSV export):
✓ Created task: add-csv-reporter.md (P2, Phase 4)
✓ Updated idea file with task reference

Processing IDEA-003 (Dark mode toggle):

- Already has tasks: add-theme-system.md, add-dark-mode-ui.md
- Skipping

### Results

Created: N new tasks
Skipped: M ideas (already have tasks)
Updated: K idea files with task references
```

## Execute Now

1. Read all ideas from `ideas/accepted/`
2. For each idea:
   - Check if tasks already exist (search backlog for IDEA-XXX)
   - If no tasks, break down acceptance criteria
   - Determine priority from impact/effort
   - Use `add-task` skill to create each task
   - Update idea file with task references
3. Report summary of created tasks
