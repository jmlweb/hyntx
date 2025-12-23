/**
 * Schema Validator for Claude Code JSONL logs.
 *
 * Provides resilience against changes in Claude Code log format by detecting
 * schema versions and generating appropriate warnings.
 */

import { type SchemaVersion } from '../types/index.js';

/**
 * Supported schema versions.
 * Easy to extend when new versions are detected.
 */
const SUPPORTED_VERSIONS: readonly string[] = ['1.0'] as const;

/**
 * Current expected schema version.
 */
const CURRENT_VERSION: SchemaVersion = {
  major: 1,
  minor: 0,
  detected: '1.0',
} as const;

/**
 * Required fields for v1.0 schema.
 */
const V1_0_REQUIRED_FIELDS = [
  'type',
  'message',
  'timestamp',
  'sessionId',
  'cwd',
] as const;

/**
 * Required fields within the message object for v1.0 schema.
 */
const V1_0_MESSAGE_FIELDS = ['role', 'content'] as const;

/**
 * Valid message types for v1.0 schema.
 */
const V1_0_MESSAGE_TYPES = ['user', 'assistant', 'system'] as const;

/**
 * Checks if a value is a non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Checks if all required fields exist in an object.
 */
function hasRequiredFields(
  obj: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return fields.every((field) => field in obj);
}

/**
 * Validates the message object structure for v1.0 schema.
 */
function isValidV1Message(message: unknown): boolean {
  if (!isObject(message)) {
    return false;
  }

  if (!hasRequiredFields(message, V1_0_MESSAGE_FIELDS)) {
    return false;
  }

  const role = message['role'];
  if (
    typeof role !== 'string' ||
    !V1_0_MESSAGE_TYPES.includes(role as (typeof V1_0_MESSAGE_TYPES)[number])
  ) {
    return false;
  }

  const content = message['content'];
  if (typeof content !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validates the type field for v1.0 schema.
 */
function isValidV1Type(type: unknown): boolean {
  return (
    typeof type === 'string' &&
    V1_0_MESSAGE_TYPES.includes(type as (typeof V1_0_MESSAGE_TYPES)[number])
  );
}

/**
 * Detects schema version from a log entry.
 *
 * @param entry - A parsed JSONL log entry (unknown structure)
 * @returns The detected schema version, or null if unknown
 *
 * @example
 * ```typescript
 * const entry = JSON.parse(line);
 * const version = detectSchemaVersion(entry);
 * if (version === null) {
 *   console.warn('Unknown log format');
 * }
 * ```
 */
export function detectSchemaVersion(entry: unknown): SchemaVersion | null {
  if (!isObject(entry)) {
    return null;
  }

  // Check for v1.0 schema structure
  if (!hasRequiredFields(entry, V1_0_REQUIRED_FIELDS)) {
    return null;
  }

  // Validate type field
  if (!isValidV1Type(entry['type'])) {
    return null;
  }

  // Validate message structure
  if (!isValidV1Message(entry['message'])) {
    return null;
  }

  // Validate timestamp is a string
  if (typeof entry['timestamp'] !== 'string') {
    return null;
  }

  // Validate sessionId is a string
  if (typeof entry['sessionId'] !== 'string') {
    return null;
  }

  // Validate cwd is a string
  if (typeof entry['cwd'] !== 'string') {
    return null;
  }

  return CURRENT_VERSION;
}

/**
 * Checks if a schema version is supported.
 *
 * @param version - The schema version to check
 * @returns true if the schema version is supported
 *
 * @example
 * ```typescript
 * const version = detectSchemaVersion(entry);
 * if (version && isSchemaSupported(version)) {
 *   // Process the entry
 * }
 * ```
 */
export function isSchemaSupported(version: SchemaVersion): boolean {
  return SUPPORTED_VERSIONS.includes(version.detected);
}

/**
 * Generates a user-friendly warning message for schema issues.
 *
 * @param version - The detected schema version, or null if unknown
 * @param context - Optional context about where the issue occurred
 * @returns A warning message suitable for display to the user
 *
 * @example
 * ```typescript
 * const version = detectSchemaVersion(entry);
 * if (version === null) {
 *   console.warn(getSchemaWarning(null, 'line 42'));
 * }
 * ```
 */
export function getSchemaWarning(
  version: SchemaVersion | null,
  context?: string,
): string {
  const contextSuffix = context ? ` (${context})` : '';

  if (version === null) {
    return `Unknown log format detected${contextSuffix}. The log entry structure does not match any known Claude Code schema. This entry will be skipped.`;
  }

  if (!isSchemaSupported(version)) {
    return `Unsupported schema version ${version.detected}${contextSuffix}. Supported versions: ${SUPPORTED_VERSIONS.join(', ')}. This entry may not be processed correctly.`;
  }

  return '';
}

/**
 * Gets the list of currently supported schema versions.
 *
 * @returns Array of supported version strings
 */
export function getSupportedVersions(): readonly string[] {
  return SUPPORTED_VERSIONS;
}

/**
 * Validates a single log entry and returns validation result.
 *
 * @param entry - The log entry to validate
 * @returns Object with validation result and optional warning
 */
export function validateLogEntry(entry: unknown): {
  readonly isValid: boolean;
  readonly version: SchemaVersion | null;
  readonly warning: string | null;
} {
  const version = detectSchemaVersion(entry);

  if (version === null) {
    return {
      isValid: false,
      version: null,
      warning: getSchemaWarning(null),
    };
  }

  if (!isSchemaSupported(version)) {
    return {
      isValid: false,
      version,
      warning: getSchemaWarning(version),
    };
  }

  return {
    isValid: true,
    version,
    warning: null,
  };
}
