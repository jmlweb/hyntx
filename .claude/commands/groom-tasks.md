---
description: Evaluate and update task specifications, remove obsolete tasks from backlog and roadmap
---

# Groom Tasks

Evaluate all tasks in the backlog for correctness, currency, and relevance. Update task specifications when needed, and remove tasks that are no longer relevant.

## Workflow

### 1. Read All Tasks

1. Read `ROADMAP.md` to get the list of all tasks
2. Read each task file from `backlog/<task-name>.md`
3. Keep track of tasks that need updates or removal

### 2. Evaluate Task Specifications

For each task, check:

**Template Compliance**:
- Compare task structure with the template in `AGENTS.md` (Task File Template section)
- Verify all required sections exist: Metadata, Description, Objective, Scope, Files to Create/Modify, Implementation, Acceptance Criteria, Test Cases, References
- Check that Metadata fields are present and correctly formatted

**Specification Currency**:
- Read relevant sections from `docs/SPECS.md`, `docs/ARCHITECTURE.md`, and other documentation
- Compare task descriptions with current architecture and specifications
- Verify that referenced documentation sections still exist and are accurate
- Check if implementation details in the task match current design patterns
- Verify that file paths and module structures match current codebase structure

**Dependencies Validity**:
- Check if dependencies listed in the task are still valid (exist in ROADMAP.md)
- Verify that dependencies haven't been completed and removed from roadmap
- Check if dependencies are correctly marked as completed in roadmap

### 3. Evaluate Task Relevance

For each task, determine if it still makes sense:

**Check Implementation Status**:
- Verify if the task has already been implemented (check if files mentioned in "Files to Create/Modify" already exist)
- Check if the functionality described in the task already exists in the codebase
- Look for code that might have been implemented without updating the task

**Check for Duplication**:
- Look for other tasks with similar objectives or overlapping scope
- Identify tasks that might be redundant or superseded by other tasks

**Check for Obsolescence**:
- Determine if the task is still aligned with project goals
- Check if architectural decisions have changed in ways that make the task obsolete
- Verify if dependencies make the task impossible or unnecessary

**Check Priority Appropriateness**:
- Review if the priority (P0/P1/P2/P3) still matches current project needs
- Consider if the task's phase assignment is still appropriate

### 4. Update or Remove Tasks

**If task needs updates** (specifications outdated or incomplete):
- Update the task file with correct information
- Fix template compliance issues
- Update references to documentation
- Correct file paths and module structures
- Update dependencies if they've changed
- Ensure all sections are complete and accurate

**If task should be removed** (obsolete, duplicate, or already implemented):
- Delete the task file from `backlog/<task-name>.md`
- Remove the task entry from `ROADMAP.md`
- Update any other tasks that reference this task as a dependency

### 5. Report Changes

Provide a summary of:
- Tasks updated (with brief explanation of changes)
- Tasks removed (with reason for removal)
- Tasks that were checked and found to be correct

## Decision Criteria

### Update Task If:
- Task structure doesn't match template
- Documentation references are outdated
- File paths or module names are incorrect
- Dependencies list is inaccurate
- Metadata fields are missing or incorrect
- Implementation details don't match current architecture
- Description or scope needs clarification

### Remove Task If:
- Functionality already exists in codebase
- Task is a duplicate of another task
- Task is obsolete due to architectural changes
- Dependencies make the task impossible to complete
- Task no longer aligns with project goals
- Task has been superseded by a different approach

### Keep Task As-Is If:
- Specification is complete and accurate
- References are current
- Implementation path is clear
- Dependencies are valid
- Task is still relevant to project goals

## Example Execution

```
1. Read ROADMAP.md → 18 tasks found
2. Read backlog/schema-validator.md
   - Check template compliance → Missing "References" section
   - Check SPECS.md → Section 10 still exists and matches
   - Check implementation → File doesn't exist, task still relevant
   - Action: Add missing "References" section
3. Read backlog/provider-base-ollama.md
   - Check template compliance → All sections present
   - Check SPECS.md → References outdated, section number changed
   - Check implementation → Task still relevant
   - Action: Update reference to new section number
4. Read backlog/obsolete-feature.md
   - Check implementation → Feature already exists in src/core/feature.ts
   - Action: Remove task file and entry from ROADMAP.md
5. Report:
   - Updated: schema-validator.md (added References section)
   - Updated: provider-base-ollama.md (fixed SPECS.md reference)
   - Removed: obsolete-feature.md (already implemented)
```

## Error Handling

- **Missing task file**: Report warning, remove from ROADMAP.md if referenced
- **Circular dependencies**: Report error, mark for manual review
- **Invalid documentation references**: Update to correct references or remove if section doesn't exist
- **File already exists**: Check if it matches task description; remove task if implemented

## Execute Now

1. Read ROADMAP.md to get all task references
2. For each task:
   - Read the task file
   - Evaluate specification completeness and currency
   - Check if task is still relevant
   - Update or remove as needed
3. Report summary of changes made

