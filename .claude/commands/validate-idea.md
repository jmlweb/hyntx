---
description: Evaluate an idea and move it to accepted or rejected
---

# Validate Idea

Evaluate an idea from `ideas/on-validation/` and move it to either `ideas/accepted/` or `ideas/rejected/` based on viability, impact, and effort analysis.

## Workflow

1. **Find the idea**:
   - Accept IDEA-XXX ID or search by title/keywords in on-validation directory
   - Read the idea file
   - Parse frontmatter and content

2. **Analyze viability**:
   - Evaluate alignment with project goals (see docs/ROADMAP.md, AGENTS.md)
   - Consider technical feasibility
   - Assess impact on codebase and users
   - Estimate effort (low, medium, high)
   - Ask user questions if needed for clarification

3. **Make decision**:
   - Ask user: "Accept or reject this idea?"
   - If unclear, present analysis and recommendation first
   - Get explicit confirmation

4. **Update idea file**:
   - Set `validated_date` to current date (2025-12-24)
   - Set `effort` (low, medium, high)
   - Set `impact` (low, medium, high)
   - Update `status` to "accepted" or "rejected"
   - If rejected: **MANDATORY** add `rejection_reason` explaining why
   - Add validation notes to "Validation Notes" section

5. **Move file**:
   - Move to `ideas/accepted/` if accepted
   - Move to `ideas/rejected/` if rejected
   - Preserve filename

## Decision Criteria

### High Priority for Acceptance

- **High impact, low effort**: Quick wins
- **Aligns with current roadmap phase**: Fits current priorities
- **Solves real pain point**: Clear user or developer benefit
- **Enhances existing features**: Natural extension

### Consider Rejection

- **Low impact, high effort**: Poor ROI
- **Out of project scope**: Doesn't align with project vision
- **Already exists**: Functionality already implemented
- **Technical infeasibility**: Cannot be reasonably implemented
- **Security/safety concerns**: Introduces risks

### Effort Levels

- **low**: < 2 hours, single file, minimal testing
- **medium**: 2-8 hours, multiple files, moderate testing
- **high**: > 8 hours, significant changes, extensive testing

### Impact Levels

- **low**: Nice to have, minimal user benefit
- **medium**: Noticeable improvement, moderate user benefit
- **high**: Game changer, significant user benefit

## Rejection Reasons - Examples

Be specific and constructive:

- "Already covered by existing ROADMAP task: [task-name]"
- "Out of scope - project focuses on X, this is Y"
- "Technical constraint: dependency Z not compatible"
- "Low ROI: high effort (8+ hours) for minimal user benefit"
- "Premature - blocked by unfinished task: [task-name]"
- "Duplicates existing functionality in [file/module]"

## Execute Now

1. Find and read the specified idea file
2. Analyze against decision criteria
3. Present analysis and ask user for accept/reject decision
4. Update frontmatter with validation data
5. Move file to appropriate directory
6. Confirm completion with new file path
