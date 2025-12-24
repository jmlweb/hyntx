/**
 * Provider factory with multi-provider support and fallback.
 *
 * This module provides factory functions for creating and selecting AI providers
 * with automatic fallback support when the primary provider is unavailable.
 */

import {
  type AnalysisProvider,
  type EnvConfig,
  type ProviderType,
} from '../types/index.js';
import { OllamaProvider } from './ollama.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';

/**
 * Callback type for fallback notifications.
 * Called when getAvailableProvider falls back to a different provider.
 *
 * @param from - The provider that was unavailable
 * @param to - The provider that will be used instead
 */
export type FallbackCallback = (from: string, to: string) => void;

/**
 * Creates a provider instance for the given type.
 *
 * @param type - The provider type to create
 * @param config - Environment configuration with provider settings
 * @returns The created provider instance
 *
 * @example
 * const config = getEnvConfig();
 * const provider = createProvider('ollama', config);
 */
export function createProvider(
  type: ProviderType,
  config: EnvConfig,
): AnalysisProvider {
  switch (type) {
    case 'ollama':
      return new OllamaProvider(config.ollama);
    case 'anthropic':
      return new AnthropicProvider(config.anthropic);
    case 'google':
      return new GoogleProvider(config.google);
  }
}

/**
 * Gets the first available provider from the configured services list.
 * Tests each provider in order and returns the first one that is available.
 * Optionally calls a callback when falling back to a different provider.
 *
 * @param config - Environment configuration with services list and provider settings
 * @param onFallback - Optional callback called when falling back to a different provider
 * @returns Promise resolving to the first available provider
 * @throws Error if no providers are configured or none are available
 *
 * @example
 * const config = getEnvConfig();
 * const provider = await getAvailableProvider(config, (from, to) => {
 *   console.log(`Falling back from ${from} to ${to}`);
 * });
 */
export async function getAvailableProvider(
  config: EnvConfig,
  onFallback?: FallbackCallback,
): Promise<AnalysisProvider> {
  if (config.services.length === 0) {
    throw new Error(
      'No providers configured. Please run hyntx setup to configure providers.',
    );
  }

  let firstProvider: AnalysisProvider | undefined;

  for (const type of config.services) {
    const provider = createProvider(type, config);

    // Track the first provider for fallback notification
    firstProvider ??= provider;

    try {
      const isAvailable = await provider.isAvailable();

      if (isAvailable) {
        // If we're using a different provider than the first one, notify via callback
        if (onFallback && provider !== firstProvider) {
          onFallback(firstProvider.name, provider.name);
        }

        return provider;
      }
    } catch {
      // Provider availability check failed, try next provider
      continue;
    }
  }

  throw new Error(
    'No providers are currently available. Please check your provider configurations.',
  );
}

/**
 * Gets all configured providers as instances.
 * Returns providers for all types listed in the services configuration.
 *
 * @param config - Environment configuration with services list and provider settings
 * @returns Array of provider instances
 * @throws Error if no providers are configured
 *
 * @example
 * const config = getEnvConfig();
 * const providers = getAllProviders(config);
 * // [OllamaProvider, AnthropicProvider, ...]
 */
export function getAllProviders(
  config: EnvConfig,
): readonly AnalysisProvider[] {
  if (config.services.length === 0) {
    throw new Error(
      'No providers configured. Please run hyntx setup to configure providers.',
    );
  }

  return config.services.map((type) => createProvider(type, config));
}
