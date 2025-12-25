---
description: Analyze project state and proactively suggest a new idea
---

# Suggest Idea

Analyze the current state of the project, identify improvement opportunities, and automatically create a new idea using `/new-idea`.

## Workflow

### 1. Analyze Project State

Gather comprehensive context by reading:

- **docs/ROADMAP.md**: Current tasks, priorities, and phases
- **backlog/\*.md**: Pending tasks and their specifications
- **TECHNICAL_DEBT.md**: Known technical debt items
- **ideas/accepted/\*.md**: Previously accepted ideas (to avoid duplicates)
- **ideas/on-validation/\*.md**: Ideas currently under review
- **ideas/rejected/\*.md**: Previously rejected ideas (to avoid suggesting duplicates, especially with same rejection reasons)
- **src/**: Sample of codebase to identify patterns, gaps, or issues

### 2. Identify Improvement Opportunities

Based on the analysis, look for:

- **Gaps in functionality**: Missing features that would benefit users
- **Technical debt**: Items from TECHNICAL_DEBT.md that could be addressed
- **Code quality**: Patterns that could be improved (duplications, complexity)
- **Architecture**: Opportunities for better structure or scalability
- **Developer experience**: Tools, automation, or workflows that could be enhanced
- **Documentation**: Missing or outdated documentation
- **Testing**: Coverage gaps or testing infrastructure improvements
- **Performance**: Optimization opportunities
- **Security**: Potential vulnerabilities or hardening opportunities

### 3. Evaluate and Prioritize

For each potential idea identified:

- **Uniqueness**: Ensure it's not already covered by existing ideas (accepted, on-validation, or rejected) or tasks. Check all idea directories to avoid duplicates, including rejected ideas which document why similar concepts were previously dismissed.
- **Value**: Estimate potential impact on project quality/velocity
- **Feasibility**: Consider effort and technical complexity
- **Alignment**: Check fit with project goals and current phase

Select the **most valuable and actionable** idea.

### 4. Generate Idea Description

Create a comprehensive idea description including:

- **Clear title**: Descriptive and specific
- **Problem statement**: What issue or gap does this address?
- **Proposed solution**: High-level approach to implement
- **Expected benefits**: Concrete improvements this would bring
- **Category**: feature, improvement, refactor, fix, documentation, other
- **Initial criteria**: 2-3 acceptance criteria

### 5. Create Idea Using `/new-idea`

Invoke the `/new-idea` skill with the generated description:

```bash
/new-idea {generated idea description}
```

### 6. Report Results

Confirm to the user:

- What was analyzed
- What opportunity was identified
- Which idea was created (IDEA-XXX)
- Suggested next step (validate the idea with `/validate-idea`)

## Analysis Checklist

When analyzing the project, consider:

- [ ] Are there repetitive manual tasks that could be automated?
- [ ] Are there missing tests for critical functionality?
- [ ] Is there outdated or missing documentation?
- [ ] Are there performance bottlenecks identified in previous reviews?
- [ ] Are there security best practices not yet implemented?
- [ ] Are there code smells or patterns that reduce maintainability?
- [ ] Are there developer tools that would improve productivity?
- [ ] Are there user-facing features that would add significant value?
- [ ] Are there infrastructure improvements that would increase reliability?
- [ ] Are there technical debt items ready to be addressed?

## Idea Quality Criteria

A good suggested idea should be:

1. **Specific**: Clearly defined scope and outcome
2. **Actionable**: Can be broken down into concrete tasks
3. **Valuable**: Provides tangible benefit to project or team
4. **Feasible**: Realistic given current project context
5. **Novel**: Not duplicating existing ideas or tasks

## Example Execution

**Analysis findings:**

- TECHNICAL_DEBT.md mentions lack of E2E tests for checkout flow
- backlog/ has multiple testing-related tasks but none for E2E
- ideas/accepted/ doesn't have any testing infrastructure ideas
- ideas/rejected/ checked - no similar ideas were previously rejected

**Opportunity identified:**
Implement E2E testing for critical user flows

**Generated idea:**
"Implement Playwright E2E testing infrastructure for checkout and authentication flows"

**Action:**

```bash
/new-idea "Implement Playwright E2E testing infrastructure for checkout and authentication flows. The project currently lacks E2E tests for critical user journeys, which increases risk of regressions. This idea proposes setting up Playwright with initial coverage for checkout flow and user authentication."
```

**Result:**
Created IDEA-015 in ideas/on-validation/ with category "improvement" and recommended effort "medium", impact "high".

## Execute Now

1. Read and analyze project state (ROADMAP, backlog, TECHNICAL_DEBT, all ideas directories including accepted/on-validation/rejected, sample codebase)
2. Identify the most valuable improvement opportunity (ensuring it's not a duplicate of existing or rejected ideas)
3. Generate a comprehensive idea description
4. Invoke `/new-idea` with the generated description
5. Report what was created and suggest validation as next step
