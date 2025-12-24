/**
 * Interactive setup system for Hyntx.
 *
 * This module provides the first-run interactive setup that guides users
 * through configuring Hyntx with providers, models, and API keys.
 */

import chalk from 'chalk';
import prompts from 'prompts';
import boxen from 'boxen';
import type {
  EnvConfig,
  ProviderType,
  ShellConfigResult,
} from '../types/index.js';
import { ENV_DEFAULTS, EXIT_CODES } from '../types/index.js';
import {
  saveConfigToShell,
  getManualInstructions,
} from '../utils/shell-config.js';

/**
 * Provider selection options for prompts.
 */
const PROVIDER_OPTIONS = [
  {
    title: 'ollama',
    description: 'Local - requires Ollama installed',
    value: 'ollama' as ProviderType,
  },
  {
    title: 'anthropic',
    description: 'Claude Haiku - requires API key',
    value: 'anthropic' as ProviderType,
  },
  {
    title: 'google',
    description: 'Gemini Flash - requires API key',
    value: 'google' as ProviderType,
  },
];

/**
 * Reminder frequency options.
 */
const REMINDER_OPTIONS = [
  { title: 'Never', value: 'never' },
  { title: 'Every 7 days', value: '7d' },
  { title: 'Every 14 days', value: '14d' },
  { title: 'Every 30 days', value: '30d' },
];

/**
 * Prompts for provider-specific configuration.
 *
 * @param provider - Provider type
 * @param config - Current configuration
 * @returns Updated configuration
 */
async function configureProvider(
  provider: ProviderType,
  config: EnvConfig,
): Promise<EnvConfig> {
  if (provider === 'ollama') {
    const response = (await prompts({
      type: 'text',
      name: 'model',
      message: 'Ollama model to use:',
      initial: ENV_DEFAULTS.ollama.model,
    })) as { model?: string };

    // Check if user cancelled (prompts returns empty object on cancel)
    if (!('model' in response)) {
      console.log(chalk.yellow('\nSetup cancelled by user.'));
      process.exit(EXIT_CODES.ERROR);
    }

    const hostResponse = (await prompts({
      type: 'text',
      name: 'host',
      message: 'Ollama host:',
      initial: ENV_DEFAULTS.ollama.host,
    })) as { host?: string };

    // Check if user cancelled (prompts returns empty object on cancel)
    if (!('host' in hostResponse)) {
      console.log(chalk.yellow('\nSetup cancelled by user.'));
      process.exit(EXIT_CODES.ERROR);
    }

    return {
      ...config,
      ollama: {
        model: response.model ?? ENV_DEFAULTS.ollama.model,
        host: hostResponse.host ?? ENV_DEFAULTS.ollama.host,
      },
    };
  }

  if (provider === 'anthropic') {
    const response = (await prompts({
      type: 'text',
      name: 'model',
      message: 'Anthropic model to use:',
      initial: ENV_DEFAULTS.anthropic.model,
    })) as { model?: string };

    // Check if user cancelled (prompts returns empty object on cancel)
    if (!('model' in response)) {
      console.log(chalk.yellow('\nSetup cancelled by user.'));
      process.exit(EXIT_CODES.ERROR);
    }

    const apiKeyResponse = (await prompts({
      type: 'password',
      name: 'apiKey',
      message: 'Anthropic API key:',
      validate: (value: string) => value.trim() !== '' || 'API key is required',
    })) as { apiKey?: string };

    // Check if user cancelled (prompts returns empty object on cancel)
    if (!('apiKey' in apiKeyResponse)) {
      console.log(chalk.yellow('\nSetup cancelled by user.'));
      process.exit(EXIT_CODES.ERROR);
    }

    return {
      ...config,
      anthropic: {
        model: response.model ?? ENV_DEFAULTS.anthropic.model,
        apiKey: apiKeyResponse.apiKey ?? '',
      },
    };
  }

  // provider === 'google' (last remaining case)
  const response = (await prompts({
    type: 'text',
    name: 'model',
    message: 'Google model to use:',
    initial: ENV_DEFAULTS.google.model,
  })) as { model?: string };

  // Check if user cancelled (prompts returns empty object on cancel)
  if (!('model' in response)) {
    console.log(chalk.yellow('\nSetup cancelled by user.'));
    process.exit(EXIT_CODES.ERROR);
  }

  const apiKeyResponse = (await prompts({
    type: 'password',
    name: 'apiKey',
    message: 'Google API key:',
    validate: (value: string) => value.trim() !== '' || 'API key is required',
  })) as { apiKey?: string };

  // Check if user cancelled (prompts returns empty object on cancel)
  if (!('apiKey' in apiKeyResponse)) {
    console.log(chalk.yellow('\nSetup cancelled by user.'));
    process.exit(EXIT_CODES.ERROR);
  }

  return {
    ...config,
    google: {
      model: response.model ?? ENV_DEFAULTS.google.model,
      apiKey: apiKeyResponse.apiKey ?? '',
    },
  };
}

/**
 * Shows manual instructions if auto-save fails or user declines.
 *
 * @param config - Environment configuration
 */
export function showManualInstructions(config: EnvConfig): void {
  const instructions = getManualInstructions(config);
  console.log('\n' + chalk.green('✅ Setup complete!'));
  console.log('\n' + instructions + '\n');
}

/**
 * Main function that orchestrates the interactive setup.
 *
 * @returns Environment configuration
 */
export async function runSetup(): Promise<EnvConfig> {
  // Welcome message
  console.log(
    boxen(chalk.bold('👋 Welcome to Hyntx!'), {
      padding: 1,
      borderColor: 'cyan',
    }),
  );

  // Provider selection
  const providerResponse = (await prompts({
    type: 'multiselect',
    name: 'providers',
    message: 'Select providers (space to select, enter to confirm):',
    choices: PROVIDER_OPTIONS,
    min: 1,
    hint: '- Space to select. Return to submit',
  })) as { providers?: ProviderType[] };

  const providers = providerResponse.providers;

  if (!providers || providers.length === 0) {
    console.log(chalk.red('No providers selected. Setup cancelled.'));
    process.exit(EXIT_CODES.ERROR);
  }

  // Initialize config with selected providers
  let config: EnvConfig = {
    services: providers,
    reminder: ENV_DEFAULTS.reminder,
    ollama: ENV_DEFAULTS.ollama,
    anthropic: {
      model: ENV_DEFAULTS.anthropic.model,
      apiKey: '',
    },
    google: {
      model: ENV_DEFAULTS.google.model,
      apiKey: '',
    },
  };

  // Configure each selected provider
  for (const provider of providers) {
    config = await configureProvider(provider, config);
  }

  // Reminder configuration
  const reminderResponse = (await prompts({
    type: 'select',
    name: 'reminder',
    message: 'Reminder frequency:',
    choices: REMINDER_OPTIONS,
    initial: 1, // Default to 7d
  })) as { reminder?: string };

  // Check if user cancelled (prompts returns empty object on cancel)
  if (!('reminder' in reminderResponse)) {
    console.log(chalk.yellow('\nSetup cancelled by user.'));
    process.exit(EXIT_CODES.ERROR);
  }

  const reminder = reminderResponse.reminder;

  if (reminder && reminder !== 'never') {
    config = { ...config, reminder };
  }

  // Set environment variables for current session
  process.env['HYNTX_SERVICES'] = config.services.join(',');
  process.env['HYNTX_REMINDER'] = config.reminder;

  if (config.services.includes('ollama')) {
    process.env['HYNTX_OLLAMA_MODEL'] = config.ollama.model;
    process.env['HYNTX_OLLAMA_HOST'] = config.ollama.host;
  }

  if (config.services.includes('anthropic') && config.anthropic.apiKey) {
    process.env['HYNTX_ANTHROPIC_MODEL'] = config.anthropic.model;
    process.env['HYNTX_ANTHROPIC_KEY'] = config.anthropic.apiKey;
  }

  if (config.services.includes('google') && config.google.apiKey) {
    process.env['HYNTX_GOOGLE_MODEL'] = config.google.model;
    process.env['HYNTX_GOOGLE_KEY'] = config.google.apiKey;
  }

  // Ask to save to shell config
  const { detectShellConfigFile } = await import('../utils/shell-config.js');
  const { configFile } = detectShellConfigFile();
  const saveToShellResponse = (await prompts({
    type: 'confirm',
    name: 'saveToShell',
    message: `Save configuration to ${configFile}?`,
    initial: true,
  })) as { saveToShell?: boolean };

  // Check if user cancelled (prompts returns empty object on cancel)
  if (!('saveToShell' in saveToShellResponse)) {
    console.log(chalk.yellow('\nSetup cancelled by user.'));
    process.exit(EXIT_CODES.ERROR);
  }

  const saveToShell = saveToShellResponse.saveToShell ?? false;

  if (saveToShell) {
    const result: ShellConfigResult = saveConfigToShell(config);

    if (result.success) {
      console.log('\n' + chalk.green('✅ ' + result.message));
      console.log(
        chalk.dim(
          "   Run 'source " +
            result.shellFile +
            "' or open a new terminal to apply.",
        ),
      );
    } else {
      console.log('\n' + chalk.yellow('⚠️  ' + result.message));
      showManualInstructions(config);
    }
  } else {
    showManualInstructions(config);
  }

  return config;
}
