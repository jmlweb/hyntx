/**
 * Environment variable management for Hyntx.
 *
 * This module provides functions for reading and parsing environment
 * configuration, detecting first-time usage, and managing provider settings.
 */

import {
  type EnvConfig,
  ENV_DEFAULTS,
  type ProviderType,
} from '../types/index.js';

/**
 * Valid provider types for validation.
 */
const VALID_PROVIDERS: readonly ProviderType[] = [
  'ollama',
  'anthropic',
  'google',
] as const;

/**
 * Checks if this is the first run of Hyntx.
 * First run is detected when HYNTX_SERVICES is not set.
 *
 * @returns true if this is the first run
 */
export function isFirstRun(): boolean {
  return !process.env['HYNTX_SERVICES'];
}

/**
 * Parses the HYNTX_SERVICES environment variable into an array of valid providers.
 * Invalid provider names are filtered out.
 *
 * @param services - Comma-separated list of provider names (e.g., "ollama,anthropic")
 * @returns Array of valid ProviderType values
 *
 * @example
 * parseServices('ollama,anthropic') // ['ollama', 'anthropic']
 * parseServices('ollama,invalid,google') // ['ollama', 'google']
 * parseServices('') // []
 * parseServices(undefined) // []
 */
export function parseServices(
  services: string | undefined,
): readonly ProviderType[] {
  if (!services || services.trim() === '') {
    return [];
  }

  return services
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is ProviderType =>
      VALID_PROVIDERS.includes(s as ProviderType),
    );
}

/**
 * Gets the complete configuration from environment variables.
 * Missing values are filled with defaults from ENV_DEFAULTS.
 *
 * @returns Complete EnvConfig object with all settings
 *
 * @example
 * // With environment variables set:
 * // HYNTX_SERVICES=ollama,anthropic
 * // HYNTX_ANTHROPIC_KEY=sk-ant-xxx
 *
 * const config = getEnvConfig();
 * // {
 * //   services: ['ollama', 'anthropic'],
 * //   reminder: '7d',
 * //   ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
 * //   anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'sk-ant-xxx' },
 * //   google: { model: 'gemini-2.0-flash-exp', apiKey: '' }
 * // }
 */
export function getEnvConfig(): EnvConfig {
  return {
    services: parseServices(process.env['HYNTX_SERVICES']),
    reminder: process.env['HYNTX_REMINDER'] ?? ENV_DEFAULTS.reminder,
    ollama: {
      model: process.env['HYNTX_OLLAMA_MODEL'] ?? ENV_DEFAULTS.ollama.model,
      host: process.env['HYNTX_OLLAMA_HOST'] ?? ENV_DEFAULTS.ollama.host,
    },
    anthropic: {
      model:
        process.env['HYNTX_ANTHROPIC_MODEL'] ?? ENV_DEFAULTS.anthropic.model,
      apiKey: process.env['HYNTX_ANTHROPIC_KEY'] ?? '',
    },
    google: {
      model: process.env['HYNTX_GOOGLE_MODEL'] ?? ENV_DEFAULTS.google.model,
      apiKey: process.env['HYNTX_GOOGLE_KEY'] ?? '',
    },
  };
}
