---
description: Create a new idea file in on-validation directory
---

# New Idea

Create a new idea file in the `ideas/on-validation/` directory with auto-generated IDEA-XXX ID.

## Workflow

1. **Find next available ID**:
   - Search all idea files in `/ideas/accepted/`, `/ideas/rejected/`, `/ideas/on-validation/`
   - Parse existing IDEA-XXX IDs
   - Generate next sequential ID (e.g., IDEA-001, IDEA-002, etc.)

2. **Parse user prompt**:
   - Extract title from user's description
   - Identify category if mentioned (feature, improvement, refactor, etc.)
   - Ask for category if not clear from prompt

3. **Create idea file**:
   - Filename: `IDEA-XXX-{kebab-case-title}.md`
   - Location: `ideas/on-validation/`
   - Use current date: 2025-12-24
   - Set status: `on-validation`

4. **Populate template**:
   - Fill frontmatter with extracted/inferred data
   - Add user's description to Description section
   - Leave validation fields empty (to be filled by validate-idea)

## Idea Template

Use this template for the generated file:

```markdown
---
id: IDEA-XXX
title: { Title }
status: on-validation
category: { feature|improvement|refactor|fix|documentation|other }
created_date: YYYY-MM-DD
validated_date: null
effort: null
impact: null
rejection_reason: null
---

# {Title}

## Description

{User's idea description - expanded if needed}

## Motivation

{Why is this idea valuable? What problem does it solve?}

## Proposed Solution

{High-level approach to implement this idea}

## Acceptance Criteria

- [ ] {Criterion 1}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

## Technical Considerations

{Any technical notes, constraints, or dependencies}

## Validation Notes

{To be filled during validation process}

## Related Tasks

{Links to backlog tasks created from this idea - filled by feed-backlog}
```

## Category Options

| Category      | Description                                |
| ------------- | ------------------------------------------ |
| feature       | New functionality or capability            |
| improvement   | Enhancement to existing feature            |
| refactor      | Code quality or architecture improvement   |
| fix           | Bug fix or correction                      |
| documentation | Documentation improvements                 |
| other         | Anything that doesn't fit above categories |

## Execute Now

1. Find next available IDEA-XXX ID by scanning all idea directories
2. Ask user for category if not clear from their prompt
3. Create the idea file with proper frontmatter and template
4. Confirm creation with file path and ID
