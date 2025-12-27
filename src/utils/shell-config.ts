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
import { logger } from './logger.js';

/** Start marker for hyntx config block */
const START_MARKER = '# >>> hyntx config >>>';
/** End marker for hyntx config block */
const END_MARKER = '# <<< hyntx config <<<';

/**
 * Describes the issue with marker positioning.
 */
type MarkerIssue = 'missing_start' | 'missing_end' | 'wrong_order';

/**
 * Result of finding marker positions in content.
 */
type MarkerPositions = {
  readonly startIndex: number;
  readonly endIndex: number;
  readonly isValid: boolean;
  readonly issue?: MarkerIssue;
};

/**
 * Finds and validates marker positions in content.
 *
 * @param content - The shell config file content
 * @returns MarkerPositions with validation status
 */
export function findMarkerPositions(content: string): MarkerPositions {
  const startIndex = content.indexOf(START_MARKER);
  const endIndex = content.indexOf(END_MARKER);

  // Both missing - no existing block
  if (startIndex === -1 && endIndex === -1) {
    return { startIndex: -1, endIndex: -1, isValid: true };
  }

  // Only start marker
  if (startIndex !== -1 && endIndex === -1) {
    return { startIndex, endIndex: -1, isValid: false, issue: 'missing_end' };
  }

  // Only end marker
  if (startIndex === -1 && endIndex !== -1) {
    return { startIndex: -1, endIndex, isValid: false, issue: 'missing_start' };
  }

  // Both present - check order
  if (startIndex > endIndex) {
    return { startIndex, endIndex, isValid: false, issue: 'wrong_order' };
  }

  // Valid block
  return { startIndex, endIndex, isValid: true };
}

/**
 * Removes malformed markers from content.
 * Handles cases where only one marker exists or markers are in wrong order.
 *
 * @param content - The shell config file content
 * @param positions - The marker positions
 * @returns Content with malformed markers removed
 */
export function removeMalformedMarkers(
  content: string,
  positions: MarkerPositions,
): string {
  let result = content;

  // For wrong order, we need to remove both markers and content between them
  // For missing start/end, we just remove the single marker that exists
  if (positions.issue === 'wrong_order') {
    // End marker comes first, start marker comes second
    // Remove from end marker to after start marker (including the line)
    const startLineEnd = result.indexOf('\n', positions.startIndex);

    // Remove the entire range from end marker to after start marker
    const before = result.slice(0, positions.endIndex);
    const after = result.slice(
      startLineEnd !== -1 ? startLineEnd + 1 : result.length,
    );
    result = before.trimEnd() + (after ? '\n' + after : '');
  } else {
    // Single marker case
    const markerIndex =
      positions.startIndex !== -1 ? positions.startIndex : positions.endIndex;
    const marker = positions.startIndex !== -1 ? START_MARKER : END_MARKER;

    // Find the line containing the marker and remove it
    const lineStart = result.lastIndexOf('\n', markerIndex - 1) + 1;
    const lineEnd = result.indexOf('\n', markerIndex + marker.length);

    result =
      result.slice(0, lineStart) +
      result.slice(lineEnd !== -1 ? lineEnd + 1 : result.length);
  }

  return result.trimEnd();
}

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
  const exportLines = exports.map((line) => `  ${line}`).join('\n');
  const configBlock = `${START_MARKER}\n${exportLines}\n\n  # Uncomment to enable periodic reminders:\n  # hyntx --check-reminder 2>/dev/null\n${END_MARKER}\n`;

  try {
    let content = '';
    let action: ShellConfigResult['action'] = 'created';

    // Read existing file if it exists
    if (existsSync(configFile)) {
      content = readFileSync(configFile, 'utf-8');
      action = 'updated';
    }

    // Find and validate marker positions
    const positions = findMarkerPositions(content);

    if (positions.startIndex === -1 && positions.endIndex === -1) {
      // No existing block - append new one
      const separator = content && !content.endsWith('\n') ? '\n\n' : '\n';
      content = `${content}${separator}${configBlock}`;
    } else if (positions.isValid) {
      // Valid block - replace it
      const before = content.slice(0, positions.startIndex);
      const after = content.slice(positions.endIndex + END_MARKER.length);

      // Remove trailing newline from before if it exists
      const beforeTrimmed = before.endsWith('\n')
        ? before.slice(0, -1)
        : before;

      content = `${beforeTrimmed}\n${configBlock}${after}`.trim() + '\n';
    } else {
      // Malformed block - log warning, remove malformed markers, add new block
      logger.collectWarning(
        `Found malformed Hyntx block in ${configFile} (${positions.issue ?? 'unknown'}). Rebuilding configuration.`,
        'shell-config',
      );

      const cleanedContent = removeMalformedMarkers(content, positions);
      const separator =
        cleanedContent && !cleanedContent.endsWith('\n') ? '\n\n' : '\n';
      content = `${cleanedContent}${separator}${configBlock}`;
    }

    // Ensure directory exists
    try {
      mkdirSync(dirname(configFile), { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      // Log other errors for debugging
      if (
        error instanceof Error &&
        !error.message.includes('EEXIST') &&
        !(error as NodeJS.ErrnoException).code?.includes('EEXIST')
      ) {
        logger.debug(
          `Directory creation note: ${error.message}`,
          'shell-config',
        );
      }
    }

    // Write file
    writeFileSync(configFile, content, 'utf-8');

    // Set restrictive permissions (600) to protect API keys
    // Failure is not critical - some systems may not support chmod
    try {
      chmodSync(configFile, 0o600);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.collectWarning(
        `Could not set restrictive permissions on ${configFile}: ${errorMessage}`,
        'shell-config',
      );
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
