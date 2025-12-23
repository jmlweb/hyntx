# Multi-Provider Factory with Fallback

## Metadata

- **Priority**: P2
- **Phase**: 3
- **Dependencies**: tipos-base.md, provider-base-ollama.md, provider-anthropic.md, provider-google.md, utils-completos.md
- **Estimation**: 3-4 hours

## Description

Implement the provider factory that allows automatic selection of the first available provider from a configured list, with automatic fallback if a provider is unavailable.

## Objective

Provide a robust provider selection system with automatic fallback, enabling multi-provider configurations that improve system availability.

## Scope

- Includes: Factory to create providers, selection function with fallback, callback to notify fallbacks, function to get all providers
- Excludes: Setup configuration (already in setup-inicial.md), analysis logic (already in analyzer)

## Files to Create/Modify

- `src/providers/index.ts` - Factory and selection functions

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `EnvConfig`
- `AnalysisProvider`
- `ProviderType`

### Main Functions/Classes

**src/providers/index.ts:**

- `createProvider()` - Creates provider instance according to type
- `getAvailableProvider()` - Gets first available provider with fallback
- `getAllProviders()` - Gets all configured providers

### Integrations

- Imports all providers (Ollama, Anthropic, Google)
- Uses `EnvConfig` from `utils/env.ts`
- Used by CLI to get provider

## Acceptance Criteria

- [ ] Creates correct instances of each provider type
- [ ] getAvailableProvider tests providers in configuration order
- [ ] getAvailableProvider returns first available provider
- [ ] getAvailableProvider calls callback when falling back
- [ ] getAvailableProvider throws error if no provider is available
- [ ] Handles availability verification errors gracefully
- [ ] getAllProviders returns all configured providers
- [ ] Throws error if no providers are configured

## Test Cases

- Creation of each provider type
- Selection with first available provider
- Fallback when first provider is unavailable
- Fallback when multiple providers are unavailable
- Error when no provider is available
- Fallback callback is called correctly
- getAllProviders returns correct list

## References

- Section 14.5 of `docs/SPECS.md` - Factory with Multi-Provider Support
