# Suggest Idea

Analyze the current state of the project and proactively suggest a new idea.

## Instructions

When the user runs `/suggest-idea`:

### Step 1 - Analyze Project State

Gather comprehensive context by reading:

- **AGENTS.md**: Project goals and conventions
- **README.md**: Project purpose and current features
- **docs/TECHNICAL_DEBT.md**: Known technical debt items
- **src/**: Sample of codebase to identify patterns, gaps, or issues

Also check existing ideas to avoid duplicates:

```bash
# Get all ideas (open and closed)
gh issue list --label "idea" --state all --json number,title --limit 100
```

### Step 2 - Identify Improvement Opportunities

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

### Step 3 - Evaluate and Prioritize

For each potential idea identified:

- **Uniqueness**: Ensure it's not already covered by existing ideas or tasks
- **Value**: Estimate potential impact on project quality/velocity
- **Feasibility**: Consider effort and technical complexity
- **Alignment**: Check fit with project goals and current phase

Select the **most valuable and actionable** idea.

### Step 4 - Create the Idea

Use `/add-idea` to create the idea:

```bash
/add-idea [generated idea description]
```

The idea will be created with `idea:pending` label for validation.

### Step 5 - Report Results

Confirm to the user:

- What was analyzed
- What opportunity was identified
- Which idea was created (issue #N)
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

## Example

```text
/suggest-idea

Analyzing project state...

Checked:
- AGENTS.md: Project goals and conventions
- docs/TECHNICAL_DEBT.md: 0 items (clean)
- Existing ideas: 15 (13 completed, 2 rejected)
- Open tasks: 0

Opportunity identified:
The project has comprehensive analysis features but no way to
export results for use in external tools or dashboards.

Creating idea...

Created: Issue #24 - [IDEA] Add export formats for analysis results

Labels: idea, idea:pending

Next step: Use /validate-idea #24 to evaluate this idea.
```
