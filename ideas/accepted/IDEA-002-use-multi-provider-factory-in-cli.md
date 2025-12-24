---
id: IDEA-002
title: Use Multi-Provider Factory in CLI
status: accepted
category: fix
created_date: 2025-12-24
validated_date: 2025-12-24
effort: low
impact: high
rejection_reason: null
---

# Use Multi-Provider Factory in CLI

## Description

The CLI entry point (`src/index.ts`) currently hardcodes `OllamaProvider` directly, ignoring the multi-provider factory (`src/providers/index.ts`) that was already implemented. This creates a significant disconnect between setup and usage:

1. Users who configured Anthropic or Google during setup can't use those providers
2. The automatic fallback mechanism isn't available
3. Provider selection from user config is ignored

The multi-provider factory already handles all the complexity of provider creation, availability checking, and fallback - it's just not wired up to the CLI.

## Motivation

- **User Expectations**: Users go through setup to configure providers, expecting their choices to work
- **Wasted Implementation**: The factory and fallback logic already exist but provide no value if unused
- **Reliability**: Cloud providers (Anthropic, Google) offer higher availability than local Ollama
- **Flexibility**: Users should be able to use the provider that best fits their needs

## Proposed Solution

Replace the direct `OllamaProvider` instantiation in `src/index.ts` with the `getAvailableProvider()` factory function:

**Current (broken):**

```typescript
import { OllamaProvider } from './providers/ollama.js';
// ...
const provider = new OllamaProvider(config.ollama);
```

**Proposed (correct):**

```typescript
import { getAvailableProvider } from './providers/index.js';
// ...
const provider = await getAvailableProvider(config, (from, to) => {
  console.log(chalk.yellow(`Primary provider ${from} unavailable, falling back to ${to}`));
});
```

This is a minimal change that unlocks all the multi-provider functionality that's already implemented.

## Acceptance Criteria

- [ ] CLI uses `getAvailableProvider()` instead of direct `OllamaProvider` instantiation
- [ ] Fallback notifications are displayed when primary provider is unavailable
- [ ] All configured providers (Ollama, Anthropic, Google) work from the CLI
- [ ] Provider name is displayed correctly in connection status message
- [ ] Error handling covers the case where no providers are available

## Technical Considerations

- The `connectProviderWithSpinner()` function in `src/index.ts` needs refactoring
- The spinner text should reflect the dynamic provider name, not hardcoded "Ollama"
- Error messages should guide users to check their provider configuration
- The `AnalysisProvider` interface is already used by all providers, so type changes are minimal

## Validation Notes

{To be filled during validation process}

## Related Tasks

{Links to backlog tasks created from this idea - filled by feed-backlog}
