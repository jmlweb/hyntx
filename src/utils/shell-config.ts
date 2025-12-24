/**
 * Shell configuration utilities for Hyntx.
 *
 * This module provides functions to detect the user's shell, generate
 * environment variable exports, and update shell configuration files.
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type {
  EnvConfig,
  ShellConfigResult,
  ShellType,
} from '../types/index.js';

/**
 * Detects the user's shell type based on environment variables.
 *
 * @returns Detected shell type
 */
export function detectShellConfigFile(): {
  readonly shellType: ShellType;
  readonly configFile: string;
} {
  const home = homedir();
  const shell = process.env['SHELL'] ?? '';

  if (shell.includes('zsh')) {
    return {
      shellType: 'zsh',
      configFile: join(home, '.zshrc'),
    };
  }

  if (shell.includes('bash')) {
    return {
      shellType: 'bash',
      configFile: join(home, '.bashrc'),
    };
  }

  if (shell.includes('fish')) {
    return {
      shellType: 'fish',
      configFile: join(home, '.config', 'fish', 'config.fish'),
    };
  }

  // Default to zsh on macOS, bash on Linux
  const defaultShell: ShellType =
    process.platform === 'darwin' ? 'zsh' : 'bash';
  return {
    shellType: defaultShell,
    configFile: join(home, `.${defaultShell}rc`),
  };
}

/**
 * Generates export statements for environment variables.
 *
 * @param config - Environment configuration
 * @returns Array of export lines
 */
export function generateEnvExports(config: EnvConfig): readonly string[] {
  const lines: string[] = [];

  // Services
  if (config.services.length > 0) {
    lines.push(`export HYNTX_SERVICES=${config.services.join(',')}`);
  }

  // Reminder
  if (config.reminder) {
    lines.push(`export HYNTX_REMINDER=${config.reminder}`);
  }

  // Ollama
  if (config.services.includes('ollama')) {
    if (config.ollama.model) {
      lines.push(`export HYNTX_OLLAMA_MODEL=${config.ollama.model}`);
    }
    if (config.ollama.host) {
      lines.push(`export HYNTX_OLLAMA_HOST=${config.ollama.host}`);
    }
  }

  // Anthropic
  if (config.services.includes('anthropic') && config.anthropic.apiKey) {
    lines.push(`export HYNTX_ANTHROPIC_MODEL=${config.anthropic.model}`);
    lines.push(`export HYNTX_ANTHROPIC_KEY=${config.anthropic.apiKey}`);
  }

  // Google
  if (config.services.includes('google') && config.google.apiKey) {
    lines.push(`export HYNTX_GOOGLE_MODEL=${config.google.model}`);
    lines.push(`export HYNTX_GOOGLE_KEY=${config.google.apiKey}`);
  }

  return lines;
}

/**
 * Updates or creates the configuration block in the shell file.
 *
 * @param configFile - Path to shell configuration file
 * @param exports - Array of export lines
 * @returns ShellConfigResult
 */
export function updateShellConfig(
  configFile: string,
  exports: readonly string[],
): ShellConfigResult {
  const startMarker = '# >>> hyntx config >>>';
  const endMarker = '# <<< hyntx config <<<';

  const exportLines = exports.map((line) => `  ${line}`).join('\n');
  const configBlock = `${startMarker}\n${exportLines}\n\n  # Uncomment to enable periodic reminders:\n  # hyntx --check-reminder 2>/dev/null\n${endMarker}\n`;

  try {
    let content = '';
    let action: ShellConfigResult['action'] = 'created';

    // Read existing file if it exists
    if (existsSync(configFile)) {
      content = readFileSync(configFile, 'utf-8');
      action = 'updated';
    }

    // Check if config block already exists
    const hasStartMarker = content.includes(startMarker);
    const hasEndMarker = content.includes(endMarker);

    if (hasStartMarker && hasEndMarker) {
      // Replace existing block
      const startIndex = content.indexOf(startMarker);
      const endIndex = content.indexOf(endMarker) + endMarker.length;
      const before = content.slice(0, startIndex);
      const after = content.slice(endIndex);

      // Remove trailing newline from before if it exists
      const beforeTrimmed = before.endsWith('\n')
        ? before.slice(0, -1)
        : before;

      content = `${beforeTrimmed}\n${configBlock}${after}`.trim() + '\n';
    } else if (hasStartMarker || hasEndMarker) {
      // Malformed block - remove it and add new one
      const startIndex = hasStartMarker
        ? content.indexOf(startMarker)
        : content.indexOf(endMarker);
      const endIndex = hasEndMarker
        ? content.indexOf(endMarker) + endMarker.length
        : content.indexOf(startMarker) + startMarker.length;

      const before = content.slice(0, startIndex);
      const after = content.slice(endIndex);
      const beforeTrimmed = before.endsWith('\n')
        ? before.slice(0, -1)
        : before;

      content = `${beforeTrimmed}\n${configBlock}${after}`.trim() + '\n';
    } else {
      // Add new block at the end
      const separator = content && !content.endsWith('\n') ? '\n\n' : '\n';
      content = `${content}${separator}${configBlock}`;
    }

    // Ensure directory exists
    try {
      mkdirSync(dirname(configFile), { recursive: true });
    } catch {
      // Directory might already exist, ignore
    }

    // Write file
    writeFileSync(configFile, content, 'utf-8');

    // Set restrictive permissions (600) to protect API keys
    // Failure is not critical - some systems may not support chmod
    try {
      chmodSync(configFile, 0o600);
    } catch {
      // Permission change failed - not critical, continue
    }

    return {
      success: true,
      shellFile: configFile,
      message: `Configuration ${action === 'created' ? 'saved to' : 'updated in'} ${configFile}`,
      action,
    };
  } catch (error) {
    return {
      success: false,
      shellFile: configFile,
      message: `Failed to update ${configFile}: ${error instanceof Error ? error.message : String(error)}`,
      action: 'failed',
    };
  }
}

/**
 * Main function to save configuration to shell file.
 *
 * @param config - Environment configuration
 * @returns ShellConfigResult
 */
export function saveConfigToShell(config: EnvConfig): ShellConfigResult {
  const { configFile } = detectShellConfigFile();
  const exports = generateEnvExports(config);
  return updateShellConfig(configFile, exports);
}

/**
 * Generates manual instructions for the user.
 *
 * @param config - Environment configuration
 * @returns Manual instructions string
 */
export function getManualInstructions(config: EnvConfig): string {
  const { configFile } = detectShellConfigFile();
  const exports = generateEnvExports(config);

  const instructions = [
    `Add this to your ${configFile}:`,
    '',
    ...exports.map((line) => `  ${line}`),
    '',
    '# Uncomment to enable periodic reminders:',
    '# hyntx --check-reminder 2>/dev/null',
    '',
    `Then reload your shell:`,
    `  source ${configFile}`,
  ];

  return instructions.join('\n');
}
