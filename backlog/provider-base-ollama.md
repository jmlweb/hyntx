# Provider Base and Ollama

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: tipos-base.md
- **Estimation**: 5-6 hours

## Description

Implement the base interface for analysis providers and the complete implementation of the Ollama provider (local). Includes the prompt system, context limits, and response parsing.

## Objective

Establish the foundation for all AI providers and provide the default local provider implementation (Ollama), following the "offline-first" principle.

## Scope

- Includes: AnalysisProvider interface, prompt system with Before/After, context limits, complete Ollama implementation
- Excludes: Other providers (Anthropic, Google), provider factory

## Files to Create/Modify

- `src/providers/base.ts` - Base interface, prompts and shared utilities
- `src/providers/ollama.ts` - Ollama provider implementation

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `AnalysisProvider`
- `AnalysisResult`
- `ProviderLimits`

### Main Functions/Classes

**src/providers/base.ts:**

- `PROVIDER_LIMITS` - Constant with context limits per provider
- `SYSTEM_PROMPT` - System prompt with Before/After requirements
- `buildUserPrompt()` - Builds user prompt with prompts to analyze
- `parseResponse()` - Parses JSON response from model

**src/providers/ollama.ts:**

- `OllamaProvider` - Class that implements AnalysisProvider for Ollama
  - `isAvailable()` - Verifies if Ollama is available and model exists
  - `analyze()` - Sends prompts to Ollama and returns analysis

### Integrations

- Ollama uses local REST API (`http://localhost:11434`)
- Uses `fetch` for HTTP communication
- Integrates with system types

## Acceptance Criteria

- [ ] AnalysisProvider interface is correctly defined
- [ ] SYSTEM_PROMPT includes clear Before/After requirements
- [ ] buildUserPrompt correctly formats prompts
- [ ] parseResponse handles valid JSON and markdown code blocks
- [ ] parseResponse handles parsing errors gracefully
- [ ] OllamaProvider correctly verifies availability
- [ ] OllamaProvider verifies that model exists
- [ ] OllamaProvider correctly sends requests to API
- [ ] OllamaProvider handles network/API errors gracefully
- [ ] Context limits are correctly configured
- [ ] Responses are correctly parsed to AnalysisResult

## Test Cases

- Availability verification when Ollama is running
- Availability verification when Ollama is not available
- Verification when model doesn't exist
- Analysis with valid prompts
- Parsing valid JSON response
- Parsing response with markdown code blocks
- Network error handling
- API error handling (model not found, etc.)

## References

- Section 14.1 of `docs/SPECS.md` - Base (src/providers/base.ts)
- Section 14.2 of `docs/SPECS.md` - Ollama (src/providers/ollama.ts)
