import { describe, expect, it } from 'vitest';

import {
  detectSchemaVersion,
  getSchemaWarning,
  getSupportedVersions,
  isSchemaSupported,
  validateLogEntry,
} from './schema-validator.js';

describe('schema-validator', () => {
  // Valid v1.0 message fixture
  const validV1Message = {
    type: 'user',
    message: {
      role: 'user',
      content: 'refactor the auth module',
    },
    timestamp: '2025-01-23T14:30:00.000Z',
    sessionId: 'abc123-def456',
    cwd: '/Users/jose/code/my-app',
  };

  describe('detectSchemaVersion', () => {
    it('should detect v1.0 schema from valid user message', () => {
      const version = detectSchemaVersion(validV1Message);

      expect(version).not.toBeNull();
      expect(version?.major).toBe(1);
      expect(version?.minor).toBe(0);
      expect(version?.detected).toBe('1.0');
    });

    it('should detect v1.0 schema from valid assistant message', () => {
      const assistantMessage = {
        ...validV1Message,
        type: 'assistant',
        message: {
          role: 'assistant',
          content: 'I will refactor the auth module for you.',
        },
      };

      const version = detectSchemaVersion(assistantMessage);

      expect(version).not.toBeNull();
      expect(version?.detected).toBe('1.0');
    });

    it('should detect v1.0 schema from valid system message', () => {
      const systemMessage = {
        ...validV1Message,
        type: 'system',
        message: {
          role: 'system',
          content: 'System initialization complete.',
        },
      };

      const version = detectSchemaVersion(systemMessage);

      expect(version).not.toBeNull();
      expect(version?.detected).toBe('1.0');
    });

    it('should return null for non-object input', () => {
      expect(detectSchemaVersion(null)).toBeNull();
      expect(detectSchemaVersion(undefined)).toBeNull();
      expect(detectSchemaVersion('string')).toBeNull();
      expect(detectSchemaVersion(123)).toBeNull();
      expect(detectSchemaVersion([])).toBeNull();
    });

    it('should return null when type field is missing', () => {
      const { type: unusedType, ...withoutType } = validV1Message;
      void unusedType;
      expect(detectSchemaVersion(withoutType)).toBeNull();
    });

    it('should return null when type field is invalid', () => {
      const invalidType = { ...validV1Message, type: 'invalid' };
      expect(detectSchemaVersion(invalidType)).toBeNull();
    });

    it('should return null when message field is missing', () => {
      const { message: unusedMessage, ...withoutMessage } = validV1Message;
      void unusedMessage;
      expect(detectSchemaVersion(withoutMessage)).toBeNull();
    });

    it('should return null when message is not an object', () => {
      const invalidMessage = { ...validV1Message, message: 'string' };
      expect(detectSchemaVersion(invalidMessage)).toBeNull();
    });

    it('should return null when message.role is missing', () => {
      const missingRole = {
        ...validV1Message,
        message: { content: 'test' },
      };
      expect(detectSchemaVersion(missingRole)).toBeNull();
    });

    it('should return null when message.role is invalid', () => {
      const invalidRole = {
        ...validV1Message,
        message: { role: 'invalid', content: 'test' },
      };
      expect(detectSchemaVersion(invalidRole)).toBeNull();
    });

    it('should return null when message.content is missing', () => {
      const missingContent = {
        ...validV1Message,
        message: { role: 'user' },
      };
      expect(detectSchemaVersion(missingContent)).toBeNull();
    });

    it('should return null when message.content is not a string', () => {
      const invalidContent = {
        ...validV1Message,
        message: { role: 'user', content: 123 },
      };
      expect(detectSchemaVersion(invalidContent)).toBeNull();
    });

    it('should return null when timestamp is missing', () => {
      const { timestamp: unusedTimestamp, ...withoutTimestamp } =
        validV1Message;
      void unusedTimestamp;
      expect(detectSchemaVersion(withoutTimestamp)).toBeNull();
    });

    it('should return null when timestamp is not a string', () => {
      const invalidTimestamp = { ...validV1Message, timestamp: 12345 };
      expect(detectSchemaVersion(invalidTimestamp)).toBeNull();
    });

    it('should return null when sessionId is missing', () => {
      const { sessionId: unusedSessionId, ...withoutSessionId } =
        validV1Message;
      void unusedSessionId;
      expect(detectSchemaVersion(withoutSessionId)).toBeNull();
    });

    it('should return null when sessionId is not a string', () => {
      const invalidSessionId = { ...validV1Message, sessionId: 12345 };
      expect(detectSchemaVersion(invalidSessionId)).toBeNull();
    });

    it('should return null when cwd is missing', () => {
      const { cwd: unusedCwd, ...withoutCwd } = validV1Message;
      void unusedCwd;
      expect(detectSchemaVersion(withoutCwd)).toBeNull();
    });

    it('should return null when cwd is not a string', () => {
      const invalidCwd = { ...validV1Message, cwd: 12345 };
      expect(detectSchemaVersion(invalidCwd)).toBeNull();
    });

    it('should handle extra fields gracefully', () => {
      const withExtraFields = {
        ...validV1Message,
        extraField: 'extra',
        anotherField: { nested: true },
      };

      const version = detectSchemaVersion(withExtraFields);
      expect(version).not.toBeNull();
      expect(version?.detected).toBe('1.0');
    });
  });

  describe('isSchemaSupported', () => {
    it('should return true for v1.0', () => {
      const version = { major: 1, minor: 0, detected: '1.0' };
      expect(isSchemaSupported(version)).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      const v2 = { major: 2, minor: 0, detected: '2.0' };
      expect(isSchemaSupported(v2)).toBe(false);

      const version11 = { major: 1, minor: 1, detected: '1.1' };
      expect(isSchemaSupported(version11)).toBe(false);
    });
  });

  describe('getSchemaWarning', () => {
    it('should return warning for null version', () => {
      const warning = getSchemaWarning(null);

      expect(warning).toContain('Unknown log format');
      expect(warning).toContain('entry will be skipped');
    });

    it('should include context in warning when provided', () => {
      const warning = getSchemaWarning(null, 'line 42');

      expect(warning).toContain('line 42');
    });

    it('should return warning for unsupported version', () => {
      const version = { major: 2, minor: 0, detected: '2.0' };
      const warning = getSchemaWarning(version);

      expect(warning).toContain('Unsupported schema version 2.0');
      expect(warning).toContain('Supported versions: 1.0');
    });

    it('should return empty string for supported version', () => {
      const version = { major: 1, minor: 0, detected: '1.0' };
      const warning = getSchemaWarning(version);

      expect(warning).toBe('');
    });
  });

  describe('getSupportedVersions', () => {
    it('should return array containing 1.0', () => {
      const versions = getSupportedVersions();

      expect(versions).toContain('1.0');
    });

    it('should return a readonly array', () => {
      const versions = getSupportedVersions();

      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBeGreaterThan(0);
    });
  });

  describe('validateLogEntry', () => {
    it('should return valid result for v1.0 entry', () => {
      const result = validateLogEntry(validV1Message);

      expect(result.isValid).toBe(true);
      expect(result.version).not.toBeNull();
      expect(result.version?.detected).toBe('1.0');
      expect(result.warning).toBeNull();
    });

    it('should return invalid result with warning for unknown format', () => {
      const result = validateLogEntry({ unknown: 'format' });

      expect(result.isValid).toBe(false);
      expect(result.version).toBeNull();
      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain('Unknown log format');
    });

    it('should return invalid result for null input', () => {
      const result = validateLogEntry(null);

      expect(result.isValid).toBe(false);
      expect(result.version).toBeNull();
      expect(result.warning).not.toBeNull();
    });
  });
});
