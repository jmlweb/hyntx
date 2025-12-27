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
import { logger } from '../utils/logger-base.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { OllamaProvider } from './ollama.js';

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
 * @param analysisMode - Optional analysis mode override ('batch' or 'individual')
 * @returns The created provider instance
 *
 * @example
 * const config = getEnvConfig();
 * const provider = createProvider('ollama', config, 'individual');
 */
export function createProvider(
  type: ProviderType,
  config: EnvConfig,
  analysisMode?: 'batch' | 'individual',
): AnalysisProvider {
  switch (type) {
    case 'ollama':
      return new OllamaProvider({
        ...config.ollama,
        schemaOverride: analysisMode,
      });
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
 * @param analysisMode - Optional analysis mode override ('batch' or 'individual')
 * @returns Promise resolving to the first available provider
 * @throws Error if no providers are configured or none are available
 *
 * @example
 * const config = getEnvConfig();
 * const provider = await getAvailableProvider(config, (from, to) => {
 *   console.log(`Falling back from ${from} to ${to}`);
 * }, 'individual');
 */
export async function getAvailableProvider(
  config: EnvConfig,
  onFallback?: FallbackCallback,
  analysisMode?: 'batch' | 'individual',
): Promise<AnalysisProvider> {
  if (config.services.length === 0) {
    throw new Error(
      'No providers configured. Please run hyntx setup to configure providers.',
    );
  }

  logger.debug(
    `Checking ${String(config.services.length)} configured provider(s): ${config.services.join(', ')}`,
    'provider',
  );

  let firstProvider: AnalysisProvider | undefined;

  for (const type of config.services) {
    const provider = createProvider(type, config, analysisMode);

    // Track the first provider for fallback notification
    firstProvider ??= provider;

    logger.debug(`Checking availability of ${provider.name}...`, 'provider');

    try {
      const isAvailable = await provider.isAvailable();

      if (isAvailable) {
        logger.debug(`${provider.name} is available`, 'provider');

        // If we're using a different provider than the first one, notify via callback
        if (onFallback && provider !== firstProvider) {
          onFallback(firstProvider.name, provider.name);
        }

        return provider;
      } else {
        logger.debug(`${provider.name} is not available`, 'provider');
      }
    } catch {
      logger.debug(`${provider.name} availability check failed`, 'provider');
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
 * @param analysisMode - Optional analysis mode override ('batch' or 'individual')
 * @returns Array of provider instances
 * @throws Error if no providers are configured
 *
 * @example
 * const config = getEnvConfig();
 * const providers = getAllProviders(config, 'individual');
 * // [OllamaProvider, AnthropicProvider, ...]
 */
export function getAllProviders(
  config: EnvConfig,
  analysisMode?: 'batch' | 'individual',
): readonly AnalysisProvider[] {
  if (config.services.length === 0) {
    throw new Error(
      'No providers configured. Please run hyntx setup to configure providers.',
    );
  }

  return config.services.map((type) =>
    createProvider(type, config, analysisMode),
  );
}
