# Ideas Management System

A structured system for capturing, validating, and converting ideas into actionable backlog tasks.

## Purpose

The ideas system serves as a funnel for new features, improvements, and enhancements before they become formal backlog tasks. It helps:

- Capture ideas quickly without committing to implementation
- Evaluate ideas systematically against project goals
- Maintain a record of rejected ideas and reasons
- Feed the backlog with well-vetted, prioritized tasks

## Directory Structure

```text
ideas/
├── on-validation/   # Ideas pending evaluation
├── accepted/        # Validated ideas approved for implementation
├── completed/       # Ideas fully implemented (all tasks done)
├── rejected/        # Ideas rejected with documented reasons
└── README.md        # This file
```

## Idea Lifecycle

```text
1. NEW IDEA (User thought/suggestion)
   ↓
   Use: /new-idea
   ↓
2. ON VALIDATION (ideas/on-validation/)
   ↓
   Use: /validate-idea or /validate-ideas
   ↓
3a. ACCEPTED (ideas/accepted/)        3b. REJECTED (ideas/rejected/)
    ↓                                     ↓
    Use: /feed-backlog                    End (documented for reference)
    ↓
4. BACKLOG TASKS (backlog/)
   ↓
   Use: /next-task
   ↓
5. IMPLEMENTATION
   ↓
   Use: /complete-idea (when all tasks done)
   ↓
6. COMPLETED (ideas/completed/)
```

## Available Commands

### /new-idea

Create a new idea file in the on-validation directory.

**Usage:**

```bash
/new-idea "Add dark mode toggle to CLI"
```

**What it does:**

- Generates next available IDEA-XXX ID
- Creates file in `ideas/on-validation/`
- Uses template with frontmatter
- Sets status to `on-validation`
- Asks for category if not clear

**Example output:**

```text
Created IDEA-007-add-dark-mode-toggle.md in ideas/on-validation/
```

### /suggest-idea

Analyze the current project state and proactively suggest a new idea.

**Usage:**

```bash
/suggest-idea
```

**What it does:**

- Analyzes docs/ROADMAP.md, backlog, docs/TECHNICAL_DEBT.md, and codebase
- Checks all idea directories (accepted/, on-validation/, rejected/) to avoid duplicates
- Identifies improvement opportunities (features, refactors, tooling, etc.)
- Evaluates uniqueness (avoids duplicating existing ideas/tasks, including previously rejected ideas)
- Generates a comprehensive idea description
- Automatically calls `/new-idea` with the suggestion
- Reports what was analyzed and created

**Analysis areas:**

- Missing functionality or features
- Technical debt items
- Code quality improvements
- Architecture enhancements
- Developer experience tools
- Documentation gaps
- Testing coverage
- Performance optimizations
- Security hardening

**Use cases:**

- Periodic project health checks
- When looking for next improvement area
- After completing major milestones
- To get AI-suggested optimizations

**Example output:**

```text
Analyzed: docs/ROADMAP.md, backlog/*.md, docs/TECHNICAL_DEBT.md, src/

Opportunity identified: E2E testing infrastructure missing
Created: IDEA-015-implement-playwright-e2e-testing.md

Next step: Run /validate-idea IDEA-015 to evaluate and accept/reject
```

### /validate-idea

Evaluate a specific idea and move it to accepted or rejected.

**Usage:**

```bash
/validate-idea IDEA-007
```

**What it does:**

- Analyzes idea against project goals
- Evaluates impact vs effort
- Asks user for accept/reject decision
- Updates frontmatter (effort, impact, validated_date)
- Moves file to appropriate directory
- **MANDATORY:** Adds rejection_reason if rejected

**Decision criteria:**

- High impact + low effort = Accept (quick wins)
- Aligns with roadmap = Accept
- Out of scope = Reject
- Low ROI = Reject

### /validate-ideas

Batch review all ideas in on-validation directory.

**Usage:**

```bash
/validate-ideas
```

**What it does:**

- Reads all pending ideas
- Analyzes against current project context
- Suggests accept/reject for each with reasoning
- Asks user to approve recommendations
- Batch updates and moves approved ideas

**Use cases:**

- Periodic cleanup of validation queue
- After major project milestone
- When priorities shift

### /list-ideas

Display ideas with optional filtering by status.

**Usage:**

```bash
/list-ideas                 # All ideas
/list-ideas on-validation   # Only pending
/list-ideas accepted        # Only accepted
/list-ideas completed       # Only completed
/list-ideas rejected        # Only rejected
```

**What it does:**

- Reads ideas from specified directories
- Parses frontmatter
- Displays formatted table with:
  - ID, Title, Status, Category
  - Effort, Impact, Created Date
- Sorts by creation date (newest first)
- Shows rejection reasons for rejected ideas

**Example output:**

```markdown
## Ideas List - all

Total: 14 ideas (3 on-validation, 5 accepted, 4 completed, 2 rejected)

| ID       | Title          | Status        | Category | Effort | Impact | Created    |
| -------- | -------------- | ------------- | -------- | ------ | ------ | ---------- |
| IDEA-012 | Add CSV export | accepted      | feature  | low    | medium | 2025-12-24 |
| IDEA-011 | Dark mode      | on-validation | feature  | -      | -      | 2025-12-23 |
| IDEA-007 | Add logging    | completed     | feature  | low    | high   | 2025-12-20 |
```

### /feed-backlog

Convert accepted ideas into backlog tasks.

**Usage:**

```bash
/feed-backlog
```

**What it does:**

- Reads all ideas from `ideas/accepted/`
- Checks for existing tasks (searches for IDEA-XXX references)
- Breaks down acceptance criteria into tasks
- Maps impact/effort to task priority (P1/P2/P3)
- Uses `/add-task` skill to create each task
- Updates idea files with task references

**Priority mapping:**

```text
Impact  | Effort | Priority
--------|--------|----------
high    | low    | P1 (Quick wins)
high    | medium | P1 (Core features)
medium  | low    | P2 (Nice enhancements)
low     | any    | P3 (Defer)
```

**Task reference format:**

Tasks created from ideas include:

```markdown
**Source**: IDEA-XXX - {idea title}
```

Ideas are updated with:

```markdown
## Related Tasks

- [add-csv-reporter.md](../backlog/add-csv-reporter.md) - P2, Phase 4
```

### /complete-idea

Mark an idea as completed when all its related tasks are done.

**Usage:**

```bash
/complete-idea IDEA-007
```

**What it does:**

- Verifies idea exists in `ideas/accepted/`
- Checks that all related tasks in backlog are completed
- Updates frontmatter: `status: completed`, `completed_date: YYYY-MM-DD`
- Moves file from `ideas/accepted/` to `ideas/completed/`
- Reports completion status

**Benefits:**

- Quick status check: `ls ideas/completed/` shows all done ideas
- Agent doesn't need to read file contents to know if idea is implemented
- Clear separation of in-progress vs done ideas

**Example output:**

```text
Checking IDEA-007 (Add dark mode toggle):
- Related tasks: add-theme-system.md ✓, add-dark-mode-ui.md ✓
- All 2 tasks completed

✓ Moved IDEA-007 to ideas/completed/
✓ Updated completed_date: 2025-12-25
```

## File Format

All idea files follow this structure:

```markdown
---
id: IDEA-XXX
title: Title of the Idea
status: on-validation|accepted|completed|rejected
category: feature|improvement|refactor|fix|documentation|other
created_date: YYYY-MM-DD
validated_date: YYYY-MM-DD or null
completed_date: YYYY-MM-DD or null
effort: low|medium|high or null
impact: low|medium|high or null
rejection_reason: "Reason text" or null
---

# Title of the Idea

## Description

{Detailed description of the idea}

## Motivation

{Why this idea is valuable}

## Proposed Solution

{High-level approach}

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Technical Considerations

{Any technical notes or constraints}

## Validation Notes

{Notes added during validation}

## Related Tasks

{Links to backlog tasks - filled by /feed-backlog}
```

## Frontmatter Fields

| Field              | Required    | Values                                                    | Notes                               |
| ------------------ | ----------- | --------------------------------------------------------- | ----------------------------------- |
| `id`               | Yes         | IDEA-XXX                                                  | Auto-generated, sequential          |
| `title`            | Yes         | String                                                    | Brief descriptive title             |
| `status`           | Yes         | on-validation, accepted, completed, rejected              | Current state                       |
| `category`         | Yes         | feature, improvement, refactor, fix, documentation, other | Type of idea                        |
| `created_date`     | Yes         | YYYY-MM-DD                                                | When idea was created               |
| `validated_date`   | No          | YYYY-MM-DD or null                                        | When validated                      |
| `completed_date`   | No          | YYYY-MM-DD or null                                        | When all tasks completed            |
| `effort`           | No          | low, medium, high, null                                   | Estimated effort                    |
| `impact`           | No          | low, medium, high, null                                   | Expected impact                     |
| `rejection_reason` | Conditional | String or null                                            | **MANDATORY if status is rejected** |

## Best Practices

### Creating Ideas

- Be specific but concise in descriptions
- Focus on the problem, not the solution
- Include motivation and expected benefits
- Don't overthink - ideas are meant to be rough

### Validating Ideas

- Consider current project phase and priorities
- Evaluate against existing roadmap
- Be honest about effort estimates
- Document rejection reasons clearly
- Accept quick wins (high impact, low effort)

### Rejection Reasons

Always provide specific, constructive reasons:

**Good reasons:**

- "Already covered by docs/ROADMAP.md task: add-csv-reporter.md"
- "Out of scope - project focuses on log analysis, not data visualization"
- "Low ROI: high effort (8+ hours) for minimal user benefit"
- "Blocked by missing feature: multi-provider support (Phase 3)"

**Bad reasons:**

- "Not good" (too vague)
- "Later" (ambiguous)
- "No" (not helpful)

### Feeding the Backlog

- Run `/feed-backlog` periodically as ideas are accepted
- Review generated tasks before they go to roadmap
- Ensure task descriptions reference source ideas
- Keep idea files updated with task links

## Integration with Backlog

The ideas system feeds into the existing backlog/roadmap workflow:

```text
IDEAS SYSTEM          BACKLOG SYSTEM
---------------       ---------------
/new-idea         →   ideas/on-validation/
/validate-idea    →   ideas/accepted/
/feed-backlog     →   backlog/*.md + docs/ROADMAP.md
                  →   /next-task
                  →   Implementation
/complete-idea    →   ideas/completed/
```

Key differences:

- **Ideas**: High-level concepts, may or may not be implemented
- **Backlog tasks**: Detailed specifications, committed for implementation
- **Ideas are cheap**: Create freely, reject liberally
- **Backlog tasks are commitments**: Only add when ready to implement

## Examples

### Example 1: New Feature Idea

```bash
# User has an idea
/new-idea "Add CSV export functionality to reporters"

# Claude creates IDEA-015-add-csv-export.md in on-validation/

# Later, user validates
/validate-idea IDEA-015

# Claude analyzes:
# - Impact: medium (useful but not critical)
# - Effort: low (straightforward implementation)
# - Decision: ACCEPT

# File moved to ideas/accepted/
# Eventually fed to backlog
/feed-backlog

# Creates: backlog/add-csv-reporter.md
# Updates: IDEA-015 with task reference
```

### Example 2: Out-of-Scope Idea

```bash
# User suggests major change
/new-idea "Rewrite entire analyzer in Rust for performance"

# User validates
/validate-idea IDEA-016

# Claude analyzes:
# - Impact: medium (performance gain)
# - Effort: high (complete rewrite)
# - Scope: Out of scope (TypeScript is core)
# - Decision: REJECT

# File moved to ideas/rejected/ with reason:
# "Out of scope - project is TypeScript-focused, Rust rewrite would require
#  complete architecture change. Performance optimization can be achieved
#  with TypeScript improvements (streaming, batching)."
```

### Example 3: Batch Revalidation

```bash
# After major milestone, review pending ideas
/validate-ideas

# Claude analyzes 5 pending ideas:
# IDEA-012: Accept (now aligns with Phase 4)
# IDEA-013: Reject (duplicate of completed task)
# IDEA-014: Accept (quick win)
# IDEA-015: Keep pending (blocked by Phase 3)
# IDEA-016: Reject (out of scope)

# User approves, 4 ideas moved, 1 remains
```

## Rules

### Mandatory Requirements

1. **Rejection reasons are MANDATORY** - never reject without documenting why
2. **IDs are sequential** - always check existing IDs before creating new ones
3. **Task references required** - tasks from ideas MUST reference source IDEA-XXX
4. **One status at a time** - ideas cannot be in multiple directories
5. **Frontmatter validation** - all required fields must be present

### Recommended Practices

1. **Validate regularly** - don't let on-validation queue grow too large
2. **Feed backlog incrementally** - don't batch-create too many tasks
3. **Review rejected ideas** - context may change, consider revalidation
4. **Keep descriptions clear** - future you (or others) should understand the idea
5. **Be ruthless** - better to reject and stay focused than accept everything

## Migration from Old Ideas

If you have ideas in other formats (notes, comments, etc.), use `/new-idea` to migrate them:

```bash
/new-idea "Old idea: {paste from notes}"
```

Then validate as normal.

## Troubleshooting

### "IDEA-XXX already exists"

- IDs must be unique across all directories
- Use `/list-ideas all` to see existing IDs
- The system auto-generates next available ID

### "Rejection reason missing"

- All rejected ideas MUST have rejection_reason
- Edit the frontmatter to add it
- Be specific and constructive

### "Task already exists for this idea"

- Run `/list-ideas accepted` to see task references
- Check backlog/ for files mentioning IDEA-XXX
- Don't create duplicate tasks

### "Can't find idea IDEA-XXX"

- Use `/list-ideas` to see all ideas
- Check if you're using the correct ID
- Idea may have been deleted (check git history)

## Contributing Ideas

Ideas can come from:

- User requests and suggestions
- Developer observations
- Bug reports that suggest features
- Analysis of usage patterns
- External feedback

All ideas go through the same validation process, regardless of source.

## Maintenance

Periodic maintenance tasks:

1. **Weekly**: Review on-validation queue with `/validate-ideas`
2. **Monthly**: Feed accepted ideas to backlog with `/feed-backlog`
3. **Quarterly**: Review rejected ideas - context may have changed
4. **As needed**: Clean up duplicate or obsolete ideas

## See Also

- [ROADMAP.md](../docs/ROADMAP.md) - Current project roadmap and priorities
- [AGENTS.md](../AGENTS.md) - Project goals and code style
- [.claude/commands/](../.claude/commands/) - All available skills
