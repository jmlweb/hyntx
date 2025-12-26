/**
 * Configuration validation utility for Hyntx.
 *
 * This module provides functions to validate configuration settings and
 * test provider connectivity before running analysis.
 */

import chalk from 'chalk';
import { type EnvConfig, type ProviderType } from '../types/index.js';
import { createProvider } from '../providers/index.js';
import { logger } from './logger.js'; // CLI logger with chalk support

/**
 * Status of a single validation check.
 */
export type CheckStatus = 'pass' | 'fail' | 'warn';

/**
 * Result of a single validation check.
 */
export type ValidationCheck = {
  readonly name: string;
  readonly status: CheckStatus;
  readonly message?: string;
};

/**
 * Result of validating a single provider.
 */
export type ProviderValidationResult = {
  readonly provider: ProviderType;
  readonly displayName: string;
  readonly valid: boolean;
  readonly checks: readonly ValidationCheck[];
};

/**
 * Overall health check result.
 */
export type HealthCheckResult = {
  readonly providers: readonly ProviderValidationResult[];
  readonly summary: {
    readonly availableCount: number;
    readonly unavailableCount: number;
    readonly totalConfigured: number;
  };
  readonly allValid: boolean;
};

/**
 * Validates URL format for Ollama host.
 *
 * @param url - URL string to validate
 * @returns true if URL is valid
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates API key format (basic pattern check).
 * Checks for minimum length and non-whitespace characters.
 *
 * @param apiKey - API key to validate
 * @returns true if API key appears valid
 */
function isValidApiKeyFormat(apiKey: string): boolean {
  if (!apiKey || apiKey.trim() === '') {
    return false;
  }
  // API keys should be at least 10 characters (arbitrary but reasonable minimum)
  return apiKey.length >= 10 && !/\s/.test(apiKey);
}

/**
 * Validates Ollama provider configuration.
 *
 * @param config - Environment configuration
 * @returns Promise resolving to validation result
 */
async function validateOllama(
  config: EnvConfig,
): Promise<ProviderValidationResult> {
  const checks: ValidationCheck[] = [];
  const { ollama } = config;

  // Check model configuration
  checks.push({
    name: 'Model',
    status: ollama.model ? 'pass' : 'fail',
    message: ollama.model || 'Not configured',
  });

  // Check host URL format
  const hostValid = isValidUrl(ollama.host);
  checks.push({
    name: 'Host',
    status: hostValid ? 'pass' : 'fail',
    message: hostValid ? ollama.host : `Invalid URL: ${ollama.host}`,
  });

  // Test connectivity if host is valid
  if (hostValid) {
    try {
      const provider = createProvider('ollama', config);
      const isAvailable = await provider.isAvailable();

      checks.push({
        name: 'Connection',
        status: isAvailable ? 'pass' : 'fail',
        message: isAvailable ? 'Reachable' : 'Cannot connect',
      });

      if (isAvailable) {
        checks.push({
          name: 'Model available',
          status: 'pass',
          message: 'Yes',
        });
      } else {
        checks.push({
          name: 'Model available',
          status: 'warn',
          message: 'Cannot verify (connection failed)',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'Connection',
        status: 'fail',
        message: `Error: ${message}`,
      });
    }
  } else {
    checks.push({
      name: 'Connection',
      status: 'warn',
      message: 'Cannot test (invalid host URL)',
    });
  }

  const allPass = checks.every((c) => c.status === 'pass');

  return {
    provider: 'ollama',
    displayName: 'Ollama',
    valid: allPass,
    checks,
  };
}

/**
 * Validates Anthropic provider configuration.
 *
 * @param config - Environment configuration
 * @returns Promise resolving to validation result
 */
async function validateAnthropic(
  config: EnvConfig,
): Promise<ProviderValidationResult> {
  const checks: ValidationCheck[] = [];
  const { anthropic } = config;

  // Check model configuration
  checks.push({
    name: 'Model',
    status: anthropic.model ? 'pass' : 'fail',
    message: anthropic.model || 'Not configured',
  });

  // Check API key format
  const apiKeyValid = isValidApiKeyFormat(anthropic.apiKey);
  checks.push({
    name: 'API Key',
    status: apiKeyValid ? 'pass' : 'fail',
    message: apiKeyValid ? 'Configured' : 'Missing or invalid',
  });

  // Test connectivity if API key is present
  if (apiKeyValid) {
    try {
      const provider = createProvider('anthropic', config);
      const isAvailable = await provider.isAvailable();

      checks.push({
        name: 'Connection',
        status: isAvailable ? 'pass' : 'fail',
        message: isAvailable
          ? 'API key valid'
          : 'API key invalid or connection failed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'Connection',
        status: 'fail',
        message: `Error: ${message}`,
      });
    }
  } else {
    checks.push({
      name: 'Connection',
      status: 'warn',
      message: 'Cannot test (invalid API key)',
    });
  }

  const allPass = checks.every((c) => c.status === 'pass');

  return {
    provider: 'anthropic',
    displayName: 'Anthropic',
    valid: allPass,
    checks,
  };
}

/**
 * Validates Google provider configuration.
 *
 * @param config - Environment configuration
 * @returns Promise resolving to validation result
 */
async function validateGoogle(
  config: EnvConfig,
): Promise<ProviderValidationResult> {
  const checks: ValidationCheck[] = [];
  const { google } = config;

  // Check model configuration
  checks.push({
    name: 'Model',
    status: google.model ? 'pass' : 'fail',
    message: google.model || 'Not configured',
  });

  // Check API key format
  const apiKeyValid = isValidApiKeyFormat(google.apiKey);
  checks.push({
    name: 'API Key',
    status: apiKeyValid ? 'pass' : 'fail',
    message: apiKeyValid ? 'Configured' : 'Missing or invalid',
  });

  // Test connectivity if API key is present
  if (apiKeyValid) {
    try {
      const provider = createProvider('google', config);
      const isAvailable = await provider.isAvailable();

      checks.push({
        name: 'Connection',
        status: isAvailable ? 'pass' : 'fail',
        message: isAvailable
          ? 'API key valid'
          : 'API key invalid or connection failed',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      checks.push({
        name: 'Connection',
        status: 'fail',
        message: `Error: ${message}`,
      });
    }
  } else {
    checks.push({
      name: 'Connection',
      status: 'warn',
      message: 'Cannot test (invalid API key)',
    });
  }

  const allPass = checks.every((c) => c.status === 'pass');

  return {
    provider: 'google',
    displayName: 'Google',
    valid: allPass,
    checks,
  };
}

/**
 * Validates a single provider.
 *
 * @param type - Provider type to validate
 * @param config - Environment configuration
 * @returns Promise resolving to validation result
 */
export async function validateProvider(
  type: ProviderType,
  config: EnvConfig,
): Promise<ProviderValidationResult> {
  switch (type) {
    case 'ollama':
      return validateOllama(config);
    case 'anthropic':
      return validateAnthropic(config);
    case 'google':
      return validateGoogle(config);
  }
}

/**
 * Validates all configured providers and returns a health check result.
 *
 * @param config - Environment configuration
 * @returns Promise resolving to health check result
 */
export async function validateAllProviders(
  config: EnvConfig,
): Promise<HealthCheckResult> {
  const results: ProviderValidationResult[] = [];

  // Validate each configured provider
  for (const type of config.services) {
    logger.debug(`Validating ${type} provider...`, 'health-check');
    const result = await validateProvider(type, config);
    results.push(result);
  }

  const availableCount = results.filter((r) => r.valid).length;
  const unavailableCount = results.filter((r) => !r.valid).length;

  return {
    providers: results,
    summary: {
      availableCount,
      unavailableCount,
      totalConfigured: config.services.length,
    },
    allValid: unavailableCount === 0 && config.services.length > 0,
  };
}

/**
 * Formats a validation check status with colored icon.
 *
 * @param status - Check status
 * @returns Colored icon string
 */
function formatStatusIcon(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return chalk.green('✅');
    case 'fail':
      return chalk.red('❌');
    case 'warn':
      return chalk.yellow('⚠️');
  }
}

/**
 * Prints the health check result to the terminal.
 *
 * @param result - Health check result
 * @param config - Environment configuration (for additional context)
 */
export function printHealthCheckResult(
  result: HealthCheckResult,
  config: EnvConfig,
): void {
  console.log('');
  console.log(chalk.bold('🔍 Configuration Health Check'));
  console.log(chalk.dim('═'.repeat(43)));
  console.log('');

  // Configuration summary
  console.log(chalk.bold('Configuration:'));
  if (config.services.length === 0) {
    console.log(chalk.dim('  No providers configured'));
  } else {
    console.log(`  Services: ${config.services.join(', ')}`);
  }
  console.log(`  Reminder: ${config.reminder}`);
  console.log('');

  // Provider details
  for (const provider of result.providers) {
    console.log(chalk.bold(`${provider.displayName} Provider:`));
    for (const check of provider.checks) {
      const icon = formatStatusIcon(check.status);
      const message = check.message ? `: ${check.message}` : '';
      console.log(`  ${icon} ${check.name}${message}`);
    }
    console.log('');
  }

  // Summary
  console.log(chalk.bold('Summary:'));
  if (config.services.length === 0) {
    console.log(chalk.yellow('  ⚠️  No providers configured'));
    console.log(chalk.dim('  Run hyntx setup to configure providers'));
  } else if (result.allValid) {
    console.log(
      chalk.green(
        `  ✅ All ${String(result.summary.totalConfigured)} provider(s) ready to use`,
      ),
    );
  } else {
    if (result.summary.unavailableCount > 0) {
      console.log(
        chalk.yellow(
          `  ⚠️  ${String(result.summary.unavailableCount)} provider(s) configured but unavailable`,
        ),
      );
    }
    if (result.summary.availableCount > 0) {
      console.log(
        chalk.green(
          `  ✅ ${String(result.summary.availableCount)} provider(s) ready to use`,
        ),
      );
    } else {
      console.log(chalk.red('  ❌ No providers available'));
    }
  }
  console.log('');
}
