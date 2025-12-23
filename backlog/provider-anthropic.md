# Anthropic Provider

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: tipos-base.md, provider-base-ollama.md
- **Estimation**: 3-4 hours

## Description

Implement the Anthropic provider (Claude API) that allows using Claude Haiku for prompt analysis as an alternative to Ollama.

## Objective

Provide support for analysis using Claude API, allowing users without local Ollama to use the service.

## Scope

- Includes: Complete Anthropic provider implementation, availability verification, API integration
- Excludes: Provider factory (done in provider-factory.md), setup configuration (already in setup-inicial.md)

## Files to Create/Modify

- `src/providers/anthropic.ts` - Anthropic provider implementation

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `AnalysisProvider`
- `AnalysisResult`

### Main Functions/Classes

**src/providers/anthropic.ts:**

- `AnthropicProvider` - Class that implements AnalysisProvider for Anthropic
  - `isAvailable()` - Verifies if API key is valid
  - `analyze()` - Sends prompts to Claude API and returns analysis

### Integrations

- Uses Claude Messages API (`https://api.anthropic.com/v1/messages`)
- Uses `fetch` for HTTP communication
- Uses functions from `base.ts` (SYSTEM_PROMPT, buildUserPrompt, parseResponse)
- Requires API key in `HYNTX_ANTHROPIC_KEY`

## Acceptance Criteria

- [ ] Correctly verifies availability (valid API key)
- [ ] Correctly sends requests to Claude Messages API
- [ ] Uses correct headers (x-api-key, anthropic-version)
- [ ] Uses SYSTEM_PROMPT and buildUserPrompt from base.ts
- [ ] Correctly parses response using parseResponse
- [ ] Handles API errors gracefully
- [ ] Handles network errors gracefully
- [ ] Returns correctly formatted AnalysisResult
- [ ] Default model is `claude-3-5-haiku-latest`

## Test Cases

- Availability verification with valid API key
- Availability verification with invalid API key
- Successful analysis with valid prompts
- API error handling (401, 429, etc.)
- Network error handling
- Correct response parsing

## References

- Section 14.3 of `docs/SPECS.md` - Anthropic (src/providers/anthropic.ts)
