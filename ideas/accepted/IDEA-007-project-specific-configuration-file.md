---
id: IDEA-007
title: Add Project-Specific Configuration File Support (.hyntxrc.json)
status: accepted
category: feature
created_date: 2025-01-27
validated_date: 2025-12-24
effort: medium
impact: high
rejection_reason: null
---

# Add Project-Specific Configuration File Support (.hyntxrc.json)

## Description

Currently, Hyntx configuration is only global via environment variables and shell config files. This limits flexibility when working with multiple projects that may need different providers, models, or analysis preferences. A `.hyntxrc.json` file in the project root would allow per-project configuration overrides and project context for more tailored analysis.

This addresses the gap where users must change environment variables when switching between projects, and enables better analysis quality through project-specific context (frameworks, description, custom rules).

## Motivation

- **Multi-Project Workflows**: Developers working on multiple projects need different providers/models per project without constantly changing environment variables
- **Project Context**: Providing project-specific context (frameworks, tech stack, description) enables more accurate and relevant analysis suggestions
- **Developer Experience**: Eliminates the need to manually set environment variables when switching projects
- **Common Pattern**: Follows established CLI tool conventions (similar to `.eslintrc`, `.prettierrc`, etc.)
- **Future-Proof**: Aligns with SPECS.md section 20.1 which mentions project-specific context as a future enhancement

## Proposed Solution

1. **Configuration File Format** (`.hyntxrc.json` in project root):

   ```json
   {
     "providers": {
       "preferred": ["anthropic"],
       "ollama": { "model": "llama3.2", "host": "http://localhost:11434" },
       "anthropic": { "model": "claude-3-5-haiku-latest" },
       "google": { "model": "gemini-2.0-flash-exp" }
     },
     "context": {
       "frameworks": ["Next.js 14", "TypeScript", "tRPC"],
       "description": "E-commerce platform with real-time inventory",
       "customRules": "Always specify API endpoint paths and error handling"
     },
     "analysis": {
       "maxPatterns": 5,
       "focusAreas": ["clarity", "specificity"]
     }
   }
   ```

2. **Configuration Merging Strategy** (precedence order):
   - Environment variables (highest precedence)
   - `.hyntxrc.json` (project-specific)
   - Global defaults (lowest precedence)

3. **Implementation**:
   - Create `src/utils/project-config.ts` module to:
     - Detect `.hyntxrc.json` in current working directory (walk up to find it)
     - Parse and validate JSON schema
     - Merge with global config from `getEnvConfig()`
     - Provide project context to analyzer for better suggestions
   - Update `src/core/analyzer.ts` to accept and use project context
   - Update CLI to load project config before analysis

4. **File Detection**:
   - Search for `.hyntxrc.json` starting from current working directory
   - Walk up directory tree until found or reach filesystem root
   - Cache result to avoid repeated file system lookups

## Acceptance Criteria

- [ ] `.hyntxrc.json` file is detected when present in project root or parent directories
- [ ] Project config merges correctly with global config (env vars take precedence)
- [ ] Project context (frameworks, description, customRules) is passed to analyzer
- [ ] Provider/model overrides work correctly per project
- [ ] Invalid JSON in `.hyntxrc.json` shows clear error message
- [ ] Missing or optional fields use sensible defaults
- [ ] Configuration is validated against schema
- [ ] Tests cover merging logic, file detection, and error cases

## Technical Considerations

- **File Location**: Use `process.cwd()` as starting point, walk up directory tree
- **Schema Validation**: Use Zod or similar to validate `.hyntxrc.json` structure
- **Performance**: Cache parsed config per working directory to avoid repeated parsing
- **Backward Compatibility**: File is optional - existing workflows continue to work
- **Security**: Validate file paths to prevent directory traversal issues
- **Integration**: Project context should be included in analysis prompts to providers
- **Documentation**: Update CLI.md and README.md with `.hyntxrc.json` format and examples

## Validation Notes

Accepted during revalidation on 2025-12-24. High-value feature that addresses multi-project workflows and enables project-specific context for better analysis quality. Aligns with future enhancements mentioned in SPECS.md. Medium effort, high impact. Suitable for Phase 4 implementation.

## Related Tasks

- [add-project-config-file.md](../../backlog/add-project-config-file.md) - P1, Phase 4
