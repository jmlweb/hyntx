# Add Project-Specific Configuration File Support

## Metadata

- **Priority**: P1
- **Phase**: 4
- **Dependencies**: cli-entry-basico.md, provider-factory.md
- **Estimation**: TBD
- **Source**: IDEA-007 - Add Project-Specific Configuration File Support (.hyntxrc.json)

## Description

Currently, Hyntx configuration is only global via environment variables and shell config files. This limits flexibility when working with multiple projects that may need different providers, models, or analysis preferences.

A `.hyntxrc.json` file in the project root would allow per-project configuration overrides and project context for more tailored analysis.

## Objective

Enable per-project configuration for multi-project workflows and provide project context for better analysis quality.

## Scope

- Includes:
  - Detect `.hyntxrc.json` in current working directory or parent directories
  - Parse and validate JSON configuration
  - Merge project config with global config (env vars take precedence)
  - Pass project context (frameworks, description) to analyzer
  - Provider/model overrides per project
- Excludes:
  - YAML configuration format
  - Configuration file generation/scaffolding
  - Configuration inheritance between projects

## Files to Create/Modify

- `src/utils/project-config.ts` - Create project config module
- `src/core/analyzer.ts` - Accept and use project context
- `src/index.ts` - Load project config before analysis
- `tests/project-config.test.ts` - Add tests

## Implementation

1. **Configuration File Format** (`.hyntxrc.json`):

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

2. **Create project config module** (`src/utils/project-config.ts`):

   ```typescript
   interface ProjectConfig {
     providers?: {
       preferred?: string[];
       ollama?: { model?: string; host?: string };
       anthropic?: { model?: string };
       google?: { model?: string };
     };
     context?: {
       frameworks?: string[];
       description?: string;
       customRules?: string;
     };
     analysis?: {
       maxPatterns?: number;
       focusAreas?: string[];
     };
   }

   function findProjectConfig(startDir: string): string | null;
   function loadProjectConfig(filePath: string): ProjectConfig;
   function mergeWithGlobalConfig(
     project: ProjectConfig,
     global: EnvConfig,
   ): EnvConfig;
   ```

3. **Configuration merging strategy** (precedence order):
   - Environment variables (highest)
   - `.hyntxrc.json` (project-specific)
   - Global defaults (lowest)

4. **File detection**:
   - Search from `process.cwd()` upward
   - Stop at filesystem root or home directory
   - Cache result per working directory

5. **Analyzer integration**:
   - Pass `context` to analyzer for prompt enhancement
   - Include project context in analysis prompts

## Acceptance Criteria

- [ ] `.hyntxrc.json` file is detected when present in project root or parent directories
- [ ] Project config merges correctly with global config (env vars take precedence)
- [ ] Project context (frameworks, description, customRules) is passed to analyzer
- [ ] Provider/model overrides work correctly per project
- [ ] Invalid JSON in `.hyntxrc.json` shows clear error message
- [ ] Missing or optional fields use sensible defaults
- [ ] Configuration is validated against schema (using Zod)
- [ ] Tests cover merging logic, file detection, and error cases

## Test Cases

- Test file detection in current directory
- Test file detection walking up directory tree
- Test config merging with global config
- Test env vars override project config
- Test invalid JSON error handling
- Test missing optional fields use defaults
- Test project context passed to analyzer

## References

- See ROADMAP.md for context
- See IDEA-007 for original proposal
- Aligns with SPECS.md section 20.1 on project-specific context
