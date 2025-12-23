---
description: Evaluate and reorder tasks in roadmap to ensure optimal implementation order respecting dependencies and priorities
---

# Reprioritize Tasks

Evaluate the order of tasks in `ROADMAP.md` and reorganize them to ensure optimal implementation order. The order must respect dependencies, priorities, and phases while optimizing for parallelization opportunities.

## Workflow

### 1. Read Roadmap and Task Files

1. Read `ROADMAP.md` to get the current order of all tasks
2. For each task, read the corresponding `backlog/<task-name>.md` file
3. Extract metadata: Priority, Phase, Dependencies
4. Build a dependency graph of all tasks

### 2. Build Dependency Graph

Create a directed graph where:

- Nodes are tasks
- Edges represent dependencies (task A depends on task B means B → A)
- Each task has metadata: priority, phase, dependencies list

### 3. Validate Current Order

For each task in the current order, verify:

**Dependency Ordering**:

- All dependencies of a task must appear before the task in the roadmap
- Check that completed tasks (marked with ✅) are placed correctly
- Verify that dependencies listed in task metadata match what appears in the roadmap

**Priority Ordering**:

- Tasks with higher priority (lower number: P0 > P1 > P2 > P3 > P4) should generally come before lower priority tasks
- Within the same priority, order should respect dependencies

**Phase Ordering**:

- Tasks in Phase 1 should come before Phase 2, Phase 2 before Phase 3, etc.
- However, dependencies may require cross-phase ordering

### 4. Calculate Optimal Order

Determine the optimal order using topological sort with priority/phase tie-breaking:

**Algorithm**:

1. Build dependency graph
2. Identify tasks with no unmet dependencies (can be done now)
3. Among available tasks, prioritize by:
   a. Priority (P0 > P1 > P2 > P3 > P4)
   b. Phase (1 > 2 > 3 > 4 > 5) if priorities are equal
   c. Number of dependents (tasks that depend on this one) - more dependents should come earlier
   d. Task complexity (simpler tasks first) - estimated from "Estimation" field
4. Place selected task in order
5. Mark dependencies as met for dependent tasks
6. Repeat until all tasks are ordered

**Special Cases**:

- Completed tasks (✅) should remain in their original position or be moved to a "completed" section
- Tasks with "partial" dependencies (e.g., "utils-completos.md (partial)") are considered satisfied if any part is completed
- Tasks marked as optional (P4) can be placed later even if dependencies are met

### 5. Compare Current vs Optimal Order

Compare the current order in `ROADMAP.md` with the calculated optimal order:

**Identify Changes Needed**:

- Tasks that should be moved earlier (dependencies allow, higher priority)
- Tasks that should be moved later (blocked by dependencies, lower priority)
- Tasks that violate dependency constraints
- Phase sections that should be reorganized

### 6. Update Roadmap

If changes are needed:

**Reorder Tasks**:

- Move tasks to their optimal positions within the same phase section
- Move tasks between phase sections if necessary (and update phase numbers in task files if phase changes)
- Update task numbers in the roadmap (1, 2, 3, etc.)
- Preserve completed tasks (✅) in a logical position or separate section

**Update Phase Sections**:

- Ensure tasks are in the correct phase section based on their priority:
  - P0 → Phase 1
  - P1 → Phase 2
  - P2 → Phase 3
  - P3 → Phase 4
  - P4 → Phase 5
- Move tasks between phases if priority/phase metadata doesn't match

**Update Task Metadata** (if phase changed):

- If a task is moved to a different phase, update the "Phase" field in the task's `backlog/<task-name>.md` file

**Update "Recommended Implementation Order"**:

- Update the "Recommended Implementation Order" section at the bottom of `ROADMAP.md` to match the new order

### 7. Report Changes

Provide a summary of:

- Tasks that were reordered (with old and new positions)
- Tasks that were moved between phases
- Dependencies that were violated and have been fixed
- Rationale for each change

## Decision Criteria

### Move Task Earlier If:

- All dependencies are met and it has higher priority than tasks before it
- It blocks many other tasks (high number of dependents)
- It has same priority but simpler (lower estimation)
- Current position violates dependency constraints

### Move Task Later If:

- Dependencies are not met by tasks before it
- It has lower priority than tasks after it that could be done first
- Current position violates dependency constraints

### Change Phase If:

- Task's priority doesn't match its phase assignment:
  - P0 task in Phase 2+ → Move to Phase 1
  - P1 task in Phase 1 or Phase 3+ → Move to Phase 2
  - P2 task in Phase 1, 2, or 4+ → Move to Phase 3
  - P3 task in Phase 1, 2, 3, or 5 → Move to Phase 4
  - P4 task in Phase 1-4 → Move to Phase 5
- However, dependencies may require keeping task in earlier phase

### Keep Order As-Is If:

- Order respects all dependencies
- Priorities are correctly ordered (P0 before P1, etc.)
- Phases are correctly assigned
- No optimization opportunities identified

## Example Execution

```
1. Read ROADMAP.md → 18 tasks found
2. Build dependency graph:
   - schema-validator.md: depends on [tipos-base.md]
   - log-reader-basico.md: depends on [tipos-base.md, schema-validator.md]
   - sanitizer.md: depends on [tipos-base.md]
   - provider-base-ollama.md: depends on [tipos-base.md]
   - analyzer-batching.md: depends on [tipos-base.md, provider-base-ollama.md]
3. Validate current order:
   - Task 3 (log-reader-basico.md) comes before Task 4 (schema-validator.md)
   - VIOLATION: log-reader-basico.md depends on schema-validator.md
4. Calculate optimal order:
   - tipos-base.md (completed, keep position)
   - schema-validator.md (depends only on tipos-base.md)
   - log-reader-basico.md (depends on tipos-base.md, schema-validator.md)
   - sanitizer.md (depends only on tipos-base.md, can parallelize with schema-validator)
5. Update ROADMAP.md:
   - Swap positions of Task 3 and Task 4
   - Update task numbers
   - Update "Recommended Implementation Order"
6. Report:
   - Moved: schema-validator.md from position 4 to position 3 (fixes dependency violation)
   - Moved: log-reader-basico.md from position 3 to position 4 (must come after schema-validator)
```

## Error Handling

- **Circular dependencies**: Report error, mark for manual review
- **Missing dependency task**: Report warning, treat as if dependency doesn't exist
- **Invalid priority/phase combination**: Move task to correct phase based on priority
- **Completed task blocking others**: Keep completed task in place, verify it's marked correctly

## Execute Now

1. Read ROADMAP.md and all task files
2. Build dependency graph
3. Validate current order against dependencies and priorities
4. Calculate optimal order using topological sort with priority/phase tie-breaking
5. Compare current vs optimal order
6. Update ROADMAP.md if changes are needed
7. Update task files if phases changed
8. Report summary of changes made
