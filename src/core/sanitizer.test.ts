/**
 * Tests for the sanitizer module.
 */

import { describe, expect, it } from 'vitest';

import { sanitize, sanitizePrompts } from './sanitizer.js';

describe('sanitize', () => {
  describe('OpenAI API keys', () => {
    it('redacts OpenAI API keys (sk-*)', () => {
      const input =
        'Use key sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_OPENAI_KEY]');
      expect(text).not.toContain('sk-abc123');
      expect(redacted).toBe(1);
    });

    it('redacts OpenAI keys at start of text', () => {
      const input =
        'sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234 is my key';
      const { text } = sanitize(input);

      expect(text.startsWith('[REDACTED_OPENAI_KEY]')).toBe(true);
    });

    it('redacts OpenAI keys at end of text', () => {
      const input =
        'My key is sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234';
      const { text } = sanitize(input);

      expect(text.endsWith('[REDACTED_OPENAI_KEY]')).toBe(true);
    });

    it('redacts multiple OpenAI keys', () => {
      const input =
        'Key1: sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234 Key2: sk-xyz789abc123def456ghi789jkl012mno345pqr678stu901';
      const { redacted } = sanitize(input);

      expect(redacted).toBe(2);
    });
  });

  describe('Anthropic API keys', () => {
    it('redacts Anthropic API keys (sk-ant-*)', () => {
      const input =
        'Key: sk-ant-api03-abc123def456ghi789jkl012mno345pqr678-xyz789';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_ANTHROPIC_KEY]');
      expect(text).not.toContain('sk-ant-api03');
      expect(redacted).toBe(1);
    });

    it('handles Anthropic keys with hyphens', () => {
      const input = 'sk-ant-api03-abc123-xyz789-def456-ghi789';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_ANTHROPIC_KEY]');
    });
  });

  describe('AWS credentials', () => {
    it('redacts AWS access keys (AKIA*)', () => {
      const input = 'AWS key: AKIAIOSFODNN7EXAMPLE';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_AWS_KEY]');
      expect(text).not.toContain('AKIAIOSFODNN7EXAMPLE');
      expect(redacted).toBe(1);
    });

    it('redacts AWS keys in different contexts', () => {
      const input = 'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_AWS_KEY]');
    });
  });

  describe('Bearer tokens', () => {
    it('redacts Bearer tokens', () => {
      const input =
        'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('Bearer [REDACTED_TOKEN]');
      expect(text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(redacted).toBe(1);
    });

    it('handles case-insensitive Bearer', () => {
      const input = 'bearer abc123def456ghi789jkl012mno345pqr678';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_TOKEN]');
    });

    it('handles BEARER in uppercase', () => {
      const input = 'BEARER abc123def456ghi789jkl012mno345pqr678';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_TOKEN]');
    });

    it('handles "Bearer token:" format', () => {
      const input = 'Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const { text } = sanitize(input);

      expect(text).toContain('Bearer [REDACTED_TOKEN]');
      expect(text).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('handles "Bearer:" format', () => {
      const input =
        'Authorization: Bearer: abc123def456ghi789jkl012mno345pqr678';
      const { text } = sanitize(input);

      expect(text).toContain('Bearer [REDACTED_TOKEN]');
    });
  });

  describe('URL credentials', () => {
    it('redacts credentials in URLs (https://user:pass@host)', () => {
      const input =
        'Connect to https://username:password123@api.example.com/endpoint';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_URL_CREDENTIAL]');
      expect(text).not.toContain('username:password123');
      expect(redacted).toBe(1);
    });

    it('redacts user-only credentials in URLs', () => {
      const input = 'http://user@api.example.com';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_URL_CREDENTIAL]');
      expect(text).not.toContain('user@');
    });

    it('handles multiple URL credentials', () => {
      const input =
        'https://user1:pass1@api1.com and https://user2:pass2@api2.com';
      const { redacted } = sanitize(input);

      expect(redacted).toBe(2);
    });
  });

  describe('Email addresses', () => {
    it('redacts email addresses', () => {
      const input = 'Contact user@example.com for help';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_EMAIL]');
      expect(text).not.toContain('user@example.com');
      expect(redacted).toBe(1);
    });

    it('redacts emails with plus signs', () => {
      const input = 'Email: user+tag@example.com';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_EMAIL]');
    });

    it('redacts emails with dots', () => {
      const input = 'Send to john.doe@company.co.uk';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_EMAIL]');
    });

    it('redacts multiple email addresses', () => {
      const input = 'Contact user1@example.com or user2@test.com';
      const { redacted } = sanitize(input);

      expect(redacted).toBe(2);
    });
  });

  describe('PEM private keys', () => {
    it('redacts PEM private keys', () => {
      const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefghijklmnopqrstuvwxyz
ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890abcdefghijklmn
-----END RSA PRIVATE KEY-----`;
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_PEM_KEY]');
      expect(text).not.toContain('BEGIN RSA PRIVATE KEY');
      expect(redacted).toBe(1);
    });

    it('redacts EC private keys', () => {
      const input = `-----BEGIN EC PRIVATE KEY-----
MHcCAQEEI1234567890abcdefghijklmnopqrstuvwxyzABCD
-----END EC PRIVATE KEY-----`;
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_PEM_KEY]');
    });

    it('redacts OPENSSH private keys', () => {
      const input = `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAlwAAAAdzc2gtcn
-----END OPENSSH PRIVATE KEY-----`;
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_PEM_KEY]');
    });
  });

  describe('Multiple secret types', () => {
    it('redacts multiple different secret types', () => {
      const input =
        'Key: sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234 Email: user@example.com AWS: AKIAIOSFODNN7EXAMPLE';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_OPENAI_KEY]');
      expect(text).toContain('[REDACTED_EMAIL]');
      expect(text).toContain('[REDACTED_AWS_KEY]');
      expect(redacted).toBe(3);
    });

    it('handles complex text with multiple secrets', () => {
      const input = `Use API key sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234
Contact admin@company.com
Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ
Connect to https://user:pass@api.example.com`;
      const { redacted } = sanitize(input);

      expect(redacted).toBe(4);
    });
  });

  describe('Person names', () => {
    it('redacts names after greetings', () => {
      const input = 'Hi John, how are you?';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_NAME]');
      expect(text).not.toContain('John');
      expect(redacted).toBe(1);
    });

    it('redacts names after "Hello"', () => {
      const input = 'Hello Mary, nice to meet you';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_NAME]');
      expect(text).not.toContain('Mary');
    });

    it('redacts names after "Hey"', () => {
      const input = 'Hey Sarah, can you help?';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_NAME]');
    });

    it('redacts names after "Dear"', () => {
      const input = 'Dear Michael, thank you for your email';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_NAME]');
    });

    it('redacts full names', () => {
      const input = 'Hi John Smith, welcome!';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_NAME]');
    });

    it('does not redact common words after greetings', () => {
      const input = 'Hi there, how are you?';
      const { text, redacted } = sanitize(input);

      expect(text).not.toContain('[REDACTED_NAME]');
      expect(redacted).toBe(0);
    });
  });

  describe('Phone numbers', () => {
    it('redacts phone numbers with parentheses', () => {
      const input = 'Call me at (555) 123-4567';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_PHONE]');
      expect(text).not.toContain('555');
      expect(redacted).toBe(1);
    });

    it('redacts phone numbers with dashes', () => {
      const input = 'My number is 555-123-4567';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_PHONE]');
    });

    it('redacts phone numbers with dots', () => {
      const input = 'Contact: 555.123.4567';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_PHONE]');
    });

    it('redacts phone numbers without separators', () => {
      const input = 'Phone: 5551234567';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_PHONE]');
    });

    it('redacts phone numbers with country code', () => {
      const input = 'Call +1 555 123 4567 or 1-555-123-4567';
      const { redacted } = sanitize(input);

      expect(redacted).toBe(2);
    });
  });

  describe('Credit cards', () => {
    it('redacts Visa cards', () => {
      const input = 'Card: 4111 1111 1111 1111';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_CREDIT_CARD]');
      expect(text).not.toContain('4111');
      expect(redacted).toBe(1);
    });

    it('redacts Mastercard', () => {
      const input = 'Mastercard: 5555 5555 5555 4444';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_CREDIT_CARD]');
    });

    it('redacts Amex', () => {
      const input = 'Amex: 3782 822463 10005';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_CREDIT_CARD]');
    });

    it('redacts credit cards with dashes', () => {
      const input = 'Card: 4111-1111-1111-1111';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_CREDIT_CARD]');
    });

    it('redacts credit cards without separators', () => {
      const input = 'Card: 4111111111111111';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_CREDIT_CARD]');
    });
  });

  describe('Social Security Numbers', () => {
    it('redacts SSN with dashes', () => {
      const input = 'SSN: 123-45-6789';
      const { text, redacted } = sanitize(input);

      expect(text).toContain('[REDACTED_SSN]');
      expect(text).not.toContain('123-45-6789');
      expect(redacted).toBe(1);
    });

    it('redacts SSN with spaces', () => {
      const input = 'SSN: 123 45 6789';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_SSN]');
    });

    it('redacts SSN without separators', () => {
      const input = 'SSN: 123456789';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_SSN]');
    });

    it('does not redact invalid SSN patterns', () => {
      // Invalid: starts with 000, 666, or 900-999
      const input = 'Invalid: 000-12-3456 or 666-12-3456';
      const { text, redacted } = sanitize(input);

      // Should not match invalid patterns
      expect(text).toBe(input);
      expect(redacted).toBe(0);
    });
  });

  describe('National ID numbers', () => {
    describe('Spanish DNI', () => {
      it('redacts Spanish DNI', () => {
        const input = 'DNI: 12345678Z';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_SPANISH_DNI]');
        expect(text).not.toContain('12345678Z');
        expect(redacted).toBe(1);
      });

      it('redacts Spanish DNI in lowercase', () => {
        const input = 'dni: 87654321a';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_SPANISH_DNI]');
      });
    });

    describe('Spanish NIE', () => {
      it('redacts Spanish NIE', () => {
        const input = 'NIE: X1234567L';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_SPANISH_NIE]');
        expect(text).not.toContain('X1234567L');
        expect(redacted).toBe(1);
      });

      it('redacts NIE with Y prefix', () => {
        const input = 'NIE: Y9876543M';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_SPANISH_NIE]');
      });
    });

    describe('Mexican CURP', () => {
      it('redacts Mexican CURP', () => {
        const input = 'CURP: GARC800101HDFRRS09';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_MEXICAN_CURP]');
        expect(text).not.toContain('GARC800101HDFRRS09');
        expect(redacted).toBe(1);
      });
    });

    describe('Brazilian CPF', () => {
      it('redacts Brazilian CPF with dots and dash', () => {
        const input = 'CPF: 123.456.789-00';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_BRAZILIAN_CPF]');
        expect(text).not.toContain('123.456.789-00');
        expect(redacted).toBe(1);
      });

      it('redacts Brazilian CPF without separators', () => {
        const input = 'CPF: 12345678900';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_BRAZILIAN_CPF]');
      });
    });

    describe('UK NINO', () => {
      it('redacts UK NINO without spaces', () => {
        const input = 'NINO: AB123456C';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_UK_NINO]');
        expect(text).not.toContain('AB123456C');
        expect(redacted).toBe(1);
      });

      it('redacts UK NINO with spaces', () => {
        const input = 'NINO: AB 12 34 56 C';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_UK_NINO]');
      });
    });

    describe('Chilean RUN', () => {
      it('redacts Chilean RUN with dash', () => {
        const input = 'RUN: 12345678-9';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_CHILEAN_RUN]');
        expect(text).not.toContain('12345678-9');
        expect(redacted).toBe(1);
      });

      it('redacts Chilean RUN with K', () => {
        const input = 'RUN: 1234567-K';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_CHILEAN_RUN]');
      });

      it('redacts Chilean RUN without dash', () => {
        const input = 'RUN: 123456789';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_CHILEAN_RUN]');
      });
    });

    describe('Argentine DNI', () => {
      it('redacts Argentine DNI when prefixed with DNI', () => {
        const input = 'DNI: 12345678';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_ARGENTINE_DNI]');
        expect(redacted).toBe(1);
      });

      it('redacts Argentine DNI with lowercase dni', () => {
        const input = 'dni 87654321';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_ARGENTINE_DNI]');
      });
    });
  });

  describe('Network identifiers', () => {
    describe('IPv4 addresses', () => {
      it('redacts IPv4 addresses', () => {
        const input = 'Server IP: 192.168.1.100';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_IPV4]');
        expect(text).not.toContain('192.168.1.100');
        expect(redacted).toBe(1);
      });

      it('does not redact localhost', () => {
        const input = 'Local: 127.0.0.1';
        const { text, redacted } = sanitize(input);

        expect(text).not.toContain('[REDACTED_IPV4]');
        expect(redacted).toBe(0);
      });
    });

    describe('IPv6 addresses', () => {
      it('redacts IPv6 addresses', () => {
        const input = 'IPv6: 2001:0db8:85a3:0000:0000:8a2e:0370:7334';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_IPV6]');
        expect(redacted).toBe(1);
      });

      it('does not redact localhost IPv6', () => {
        const input = 'Local: ::1';
        const { text, redacted } = sanitize(input);

        expect(text).not.toContain('[REDACTED_IPV6]');
        expect(redacted).toBe(0);
      });
    });

    describe('MAC addresses', () => {
      it('redacts MAC addresses with colons', () => {
        const input = 'MAC: 00:1B:44:11:3A:B7';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_MAC_ADDRESS]');
        expect(text).not.toContain('00:1B:44:11:3A:B7');
        expect(redacted).toBe(1);
      });

      it('redacts MAC addresses with dashes', () => {
        const input = 'MAC: 00-1B-44-11-3A-B7';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_MAC_ADDRESS]');
      });
    });
  });

  describe('Document numbers', () => {
    describe('Passport numbers', () => {
      it('redacts passport numbers', () => {
        const input = 'Passport: AB123456';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_PASSPORT]');
        expect(redacted).toBe(1);
      });

      it('redacts passport in Spanish', () => {
        const input = 'Pasaporte: 123456789';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_PASSPORT]');
      });
    });

    describe('Driver license numbers', () => {
      it('redacts driver license numbers', () => {
        const input = 'Driver License: D123456789';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_DRIVER_LICENSE]');
        expect(redacted).toBe(1);
      });

      it('redacts DL abbreviation', () => {
        const input = 'DL: D123456789';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_DRIVER_LICENSE]');
      });

      it('redacts driver license in Spanish', () => {
        const input = 'Licencia de conducir: ABC123456';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_DRIVER_LICENSE]');
      });
    });
  });

  describe('Location and personal data', () => {
    describe('Addresses', () => {
      it('redacts US ZIP codes', () => {
        const input = 'ZIP: 12345';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_ZIP_CODE]');
        expect(redacted).toBe(1);
      });

      it('redacts US ZIP+4 codes', () => {
        const input = 'ZIP: 12345-6789';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_ZIP_CODE]');
      });

      it('redacts UK postcodes', () => {
        const input = 'Postcode: SW1A 1AA';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_POSTCODE]');
      });

      it('redacts Canadian postal codes', () => {
        const input = 'Postal: K1A 0B1';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_POSTAL_CODE]');
      });
    });

    describe('Birth dates', () => {
      it('redacts birth dates with DOB prefix', () => {
        const input = 'DOB: 01/15/1990';
        const { text, redacted } = sanitize(input);

        expect(text).toContain('[REDACTED_BIRTH_DATE]');
        expect(redacted).toBe(1);
      });

      it('redacts birth dates with date of birth', () => {
        const input = 'Date of birth: 15-01-1990';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_BIRTH_DATE]');
      });

      it('redacts birth dates in Spanish', () => {
        const input = 'Fecha de nacimiento: 01.15.1990';
        const { text } = sanitize(input);

        expect(text).toContain('[REDACTED_BIRTH_DATE]');
      });
    });
  });

  describe('Edge cases', () => {
    it('returns original text when no secrets found', () => {
      const input = 'Regular text without any secrets or sensitive information';
      const { text, redacted } = sanitize(input);

      expect(text).toBe(input);
      expect(redacted).toBe(0);
    });

    it('handles empty string', () => {
      const { text, redacted } = sanitize('');

      expect(text).toBe('');
      expect(redacted).toBe(0);
    });

    it('handles whitespace-only text', () => {
      const { text, redacted } = sanitize('   \n\t  ');

      expect(text).toBe('   \n\t  ');
      expect(redacted).toBe(0);
    });

    it('preserves non-secret text around secrets', () => {
      const input =
        'Before sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234 after';
      const { text } = sanitize(input);

      expect(text).toContain('Before');
      expect(text).toContain('after');
      expect(text).toContain('[REDACTED_OPENAI_KEY]');
    });

    it('does not redact false positives (short sk- strings)', () => {
      const input = 'sk-123 is too short to be a key';
      const { text, redacted } = sanitize(input);

      // Should not redact (needs at least 48 chars after sk-)
      expect(text).toBe(input);
      expect(redacted).toBe(0);
    });

    it('handles secrets in code blocks', () => {
      const input =
        '```\nconst key = "sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234";\n```';
      const { text } = sanitize(input);

      expect(text).toContain('[REDACTED_OPENAI_KEY]');
    });
  });
});

describe('sanitizePrompts', () => {
  it('sanitizes array of prompts', () => {
    const prompts = [
      'Use key sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234',
      'Email me at user@example.com',
      'Regular text without secrets',
    ];

    const result = sanitizePrompts(prompts);

    expect(result.prompts).toHaveLength(3);
    expect(result.prompts[0]).toContain('[REDACTED_OPENAI_KEY]');
    expect(result.prompts[1]).toContain('[REDACTED_EMAIL]');
    expect(result.prompts[2]).toBe('Regular text without secrets');
    expect(result.totalRedacted).toBe(2);
  });

  it('returns empty array for empty input', () => {
    const result = sanitizePrompts([]);

    expect(result.prompts).toEqual([]);
    expect(result.totalRedacted).toBe(0);
  });

  it('counts total redactions across all prompts', () => {
    const prompts = [
      'Key1: sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234',
      'Key2: sk-xyz789abc123def456ghi789jkl012mno345pqr678stu901',
      'Email: user@example.com',
    ];

    const result = sanitizePrompts(prompts);

    expect(result.totalRedacted).toBe(3);
  });

  it('handles prompts with multiple secrets each', () => {
    const prompts = [
      'Key: sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234 Email: user@test.com',
      'AWS: AKIAIOSFODNN7EXAMPLE Bearer token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ',
    ];

    const result = sanitizePrompts(prompts);

    expect(result.totalRedacted).toBe(4);
  });

  it('preserves prompt order', () => {
    const prompts = ['First prompt', 'Second prompt', 'Third prompt'];

    const result = sanitizePrompts(prompts);

    expect(result.prompts[0]).toBe('First prompt');
    expect(result.prompts[1]).toBe('Second prompt');
    expect(result.prompts[2]).toBe('Third prompt');
  });

  it('handles single prompt array', () => {
    const prompts = [
      'Single prompt with key sk-abc123def456ghi789jkl012mno345pqr678stu901vwx234',
    ];

    const result = sanitizePrompts(prompts);

    expect(result.prompts).toHaveLength(1);
    expect(result.totalRedacted).toBe(1);
  });
});
