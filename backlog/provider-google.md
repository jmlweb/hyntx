# Google Provider

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: tipos-base.md, provider-base-ollama.md
- **Estimation**: 3-4 hours

## Description

Implement the Google provider (Gemini API) that allows using Gemini Flash for prompt analysis as an alternative to Ollama and Anthropic.

## Objective

Provide support for analysis using Gemini API, expanding available provider options.

## Scope

- Includes: Complete Google provider implementation, availability verification, API integration
- Excludes: Provider factory (done in provider-factory.md), setup configuration (already in setup-inicial.md)

## Files to Create/Modify

- `src/providers/google.ts` - Google provider implementation

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `AnalysisProvider`
- `AnalysisResult`

### Main Functions/Classes

**src/providers/google.ts:**

- `GoogleProvider` - Class that implements AnalysisProvider for Google
  - `isAvailable()` - Verifies if API key exists
  - `analyze()` - Sends prompts to Gemini API and returns analysis

### Integrations

- Uses Gemini GenerateContent API (`https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent`)
- Uses `fetch` for HTTP communication
- Uses functions from `base.ts` (SYSTEM_PROMPT, buildUserPrompt, parseResponse)
- Requires API key in `HYNTX_GOOGLE_KEY`
- Configures `responseMimeType: 'application/json'` for JSON responses

## Acceptance Criteria

- [ ] Correctly verifies availability (API key exists)
- [ ] Correctly sends requests to Gemini API
- [ ] Uses correct URL with model and API key
- [ ] Configures responseMimeType for JSON
- [ ] Uses SYSTEM_PROMPT and buildUserPrompt from base.ts
- [ ] Correctly parses response using parseResponse
- [ ] Handles API errors gracefully
- [ ] Handles network errors gracefully
- [ ] Returns correctly formatted AnalysisResult
- [ ] Default model is `gemini-2.0-flash-exp`

## Test Cases

- Availability verification with valid API key
- Availability verification without API key
- Successful analysis with valid prompts
- API error handling (401, 429, etc.)
- Network error handling
- Correct response parsing

## References

- Section 14.4 of `docs/SPECS.md` - Google (src/providers/google.ts)
