/**
 * Project-specific configuration system.
 *
 * This module provides utilities for loading and merging project-specific
 * configurations from `.hyntxrc.json` files. Project configs are merged with
 * environment configs, with env vars taking precedence.
 *
 * Features:
 * - Directory tree traversal to find config files
 * - JSON validation with Zod schema
 * - Config caching for performance
 * - Graceful error handling (non-fatal)
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { z } from 'zod';
import type { EnvConfig, ProjectContext } from '../types/index.js';
import { logger } from './logger-base.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Name of the project configuration file.
 */
const CONFIG_FILENAME = '.hyntxrc.json';

/**
 * Maximum number of parent directories to traverse.
 * Prevents infinite loops in edge cases.
 */
const MAX_TRAVERSAL_DEPTH = 50;

// =============================================================================
// Schema
// =============================================================================

/**
 * Zod schema for project context validation.
 */
const PROJECT_CONTEXT_SCHEMA = z.object({
  role: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  domain: z.string().optional(),
  guidelines: z.array(z.string()).optional(),
  projectType: z.string().optional(),
});

/**
 * Zod schema for the .hyntxrc.json file.
 */
const PROJECT_CONFIG_SCHEMA = z.object({
  context: PROJECT_CONTEXT_SCHEMA.optional(),
});

/**
 * Type for the validated project config.
 */
type ProjectConfig = z.infer<typeof PROJECT_CONFIG_SCHEMA>;

// =============================================================================
// Cache
// =============================================================================

/**
 * Cache for loaded configurations.
 * Key: working directory path
 * Value: loaded config or null if not found
 */
const configCache = new Map<string, ProjectConfig | null>();

// =============================================================================
// File Discovery
// =============================================================================

/**
 * Finds the project configuration file by walking up the directory tree.
 *
 * Starts from the provided working directory and walks up the parent directories
 * until a .hyntxrc.json file is found, or until the home directory or root is reached.
 *
 * @param cwd - Current working directory to start search from
 * @returns Path to the config file, or null if not found
 *
 * @example
 * ```typescript
 * const configPath = findProjectConfig('/Users/user/projects/my-app/src');
 * // Returns: '/Users/user/projects/my-app/.hyntxrc.json'
 * ```
 */
export function findProjectConfig(cwd: string): string | null {
  let currentDir = cwd;
  const homeDirectory = homedir();
  let depth = 0;

  while (depth < MAX_TRAVERSAL_DEPTH) {
    const configPath = join(currentDir, CONFIG_FILENAME);

    try {
      // Check if file exists by attempting to access its stats
      readFileSync(configPath, 'utf-8');
      return configPath;
    } catch {
      // File doesn't exist or can't be read, continue searching
    }

    // Stop at home directory or root
    if (currentDir === homeDirectory || currentDir === '/') {
      break;
    }

    // Move to parent directory
    const parentDir = dirname(currentDir);

    // Prevent infinite loop if dirname returns the same directory
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  return null;
}

// =============================================================================
// Config Loading
// =============================================================================

/**
 * Loads and validates a project configuration file.
 *
 * Reads the JSON file, parses it, and validates against the Zod schema.
 * Errors are non-fatal and logged as warnings.
 *
 * @param configPath - Path to the .hyntxrc.json file
 * @returns Validated config object, or null if loading/validation fails
 *
 * @example
 * ```typescript
 * const config = loadProjectConfig('/path/to/.hyntxrc.json');
 * if (config?.context) {
 *   console.log('Project role:', config.context.role);
 * }
 * ```
 */
export function loadProjectConfig(configPath: string): ProjectConfig | null {
  try {
    const fileContent = readFileSync(configPath, 'utf-8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(fileContent);
    } catch (error) {
      logger.collectWarning(
        `Invalid JSON in ${CONFIG_FILENAME}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'config',
      );
      return null;
    }

    const result = PROJECT_CONFIG_SCHEMA.safeParse(parsed);
    if (!result.success) {
      const errorMessages = result.error.issues
        .map((issue) => {
          const pathStr = issue.path.map(String).join('.');
          return `${pathStr}: ${issue.message}`;
        })
        .join(', ');
      logger.collectWarning(
        `Invalid ${CONFIG_FILENAME} schema: ${errorMessages}`,
        'config',
      );
      return null;
    }

    return result.data;
  } catch (error) {
    logger.collectWarning(
      `Failed to read ${CONFIG_FILENAME}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'config',
    );
    return null;
  }
}

// =============================================================================
// Config Merging
// =============================================================================

/**
 * Merges a project config with an environment config.
 *
 * Merging rules:
 * - Environment variables take precedence over project config
 * - If envConfig.context is set (from env vars), it overrides project context
 * - Otherwise, project context is used if available
 *
 * @param envConfig - Configuration from environment variables
 * @param projectConfig - Configuration from .hyntxrc.json
 * @returns Merged configuration with context field
 *
 * @example
 * ```typescript
 * const merged = mergeConfigs(envConfig, projectConfig);
 * if (merged.context) {
 *   // Use project context in analysis
 * }
 * ```
 */
export function mergeConfigs(
  envConfig: EnvConfig,
  projectConfig: ProjectConfig | null,
): EnvConfig & { context?: ProjectContext } {
  // If no project config or no context in project config, return envConfig as-is
  if (!projectConfig?.context) {
    return envConfig;
  }

  // If envConfig already has context (from env vars), env vars take precedence
  const existingEnvConfig = envConfig as EnvConfig & {
    context?: ProjectContext;
  };
  if (existingEnvConfig.context) {
    return existingEnvConfig;
  }

  // Merge: env config + project context
  return {
    ...envConfig,
    context: projectConfig.context,
  };
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Loads project configuration for the specified working directory.
 *
 * This is the main entry point for loading project configs. It:
 * 1. Checks the cache first
 * 2. Searches for .hyntxrc.json up the directory tree
 * 3. Loads and validates the config file
 * 4. Caches the result
 *
 * @param cwd - Current working directory
 * @returns Loaded config or null if not found/invalid
 *
 * @example
 * ```typescript
 * const config = loadProjectConfigForCwd(process.cwd());
 * const merged = mergeConfigs(envConfig, config);
 * ```
 */
export function loadProjectConfigForCwd(cwd: string): ProjectConfig | null {
  // Check cache first
  if (configCache.has(cwd)) {
    return configCache.get(cwd) ?? null;
  }

  // Find config file
  const configPath = findProjectConfig(cwd);
  if (!configPath) {
    // Cache negative result
    configCache.set(cwd, null);
    return null;
  }

  // Load and validate config
  const config = loadProjectConfig(configPath);

  // Cache result (even if null due to validation errors)
  configCache.set(cwd, config);

  return config;
}

/**
 * Clears the configuration cache.
 * Useful for testing or when config files change during runtime.
 */
export function clearConfigCache(): void {
  configCache.clear();
}
