/**
 * Secret Sanitizer for Hyntx
 *
 * This module provides functionality to automatically redact secrets and sensitive
 * information from prompts before sending them to AI providers.
 */

import { logger } from '../utils/logger-base.js';

/**
 * Result of sanitizing a single text.
 */
export type SanitizeResult = {
  readonly text: string;
  readonly redacted: number;
};

/**
 * Result of sanitizing multiple prompts.
 */
export type SanitizePromptsResult = {
  readonly prompts: readonly string[];
  readonly totalRedacted: number;
};

/**
 * Redacts OpenAI API keys (sk-*).
 *
 * @param text - Text to process
 * @returns Text with OpenAI API keys redacted
 */
function redactOpenAIKeys(text: string): string {
  // OpenAI API keys start with sk- and are typically 51 characters long
  // Pattern: sk-[alphanumeric]{48}
  return text.replace(/sk-[a-zA-Z0-9]{48,}/g, '[REDACTED_OPENAI_KEY]');
}

/**
 * Redacts Anthropic API keys (sk-ant-*).
 *
 * @param text - Text to process
 * @returns Text with Anthropic API keys redacted
 */
function redactAnthropicKeys(text: string): string {
  // Anthropic API keys start with sk-ant- and are typically longer
  // Pattern: sk-ant-[alphanumeric and hyphens]
  return text.replace(/sk-ant-[a-zA-Z0-9-]+/g, '[REDACTED_ANTHROPIC_KEY]');
}

/**
 * Redacts AWS credentials (AKIA*).
 *
 * @param text - Text to process
 * @returns Text with AWS credentials redacted
 */
function redactAWSCredentials(text: string): string {
  // AWS access keys start with AKIA and are 20 characters long
  // Pattern: AKIA[0-9A-Z]{16}
  return text.replace(/AKIA[0-9A-Z]{16}/g, '[REDACTED_AWS_KEY]');
}

/**
 * Redacts Bearer tokens.
 *
 * @param text - Text to process
 * @returns Text with Bearer tokens redacted
 */
function redactBearerTokens(text: string): string {
  // Bearer tokens: Handles various patterns like:
  // - "Bearer <token>"
  // - "Bearer token: <token>"
  // - "Authorization: Bearer <token>"
  // - "Bearer: <token>"
  // Pattern matches Bearer (case-insensitive) followed by optional "token:" or ":"
  // and then a token string (typically 20+ characters)
  return text.replace(
    /Bearer(?:\s+token)?:?\s+[a-zA-Z0-9._-]{20,}/gi,
    'Bearer [REDACTED_TOKEN]',
  );
}

/**
 * Redacts well-known provider tokens (GitHub, Slack, Google, Stripe, JWT).
 * Shell commands and error output shown in reports often carry these.
 *
 * @param text - Text to process
 * @returns Text with provider tokens redacted
 */
function redactProviderTokens(text: string): string {
  return text
    .replace(/\bgh[pousr]_[A-Za-z0-9]{36,}\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, '[REDACTED_GITHUB_TOKEN]')
    .replace(/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, '[REDACTED_SLACK_TOKEN]')
    .replace(/\bAIza[0-9A-Za-z_-]{35}\b/g, '[REDACTED_GOOGLE_KEY]')
    .replace(
      /\b[sr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
      '[REDACTED_STRIPE_KEY]',
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
      '[REDACTED_JWT]',
    );
}

/**
 * Redacts values assigned to secret-looking names (TOKEN=..., "password": ...).
 * Variable references such as $TOKEN are left alone.
 *
 * @param text - Text to process
 * @returns Text with assigned secret values redacted
 */
function redactSecretAssignments(text: string): string {
  return text.replace(
    /\b([A-Za-z0-9_-]*(?:token|secret|password|passwd|api[_-]?key|apikey|access[_-]?key|private[_-]?key)[A-Za-z0-9_-]*["']?\s*[=:]\s*["']?)(?!\$|\[REDACTED)[^\s"'&,;)]{8,}/gi,
    '$1[REDACTED_SECRET]',
  );
}

/**
 * Redacts long opaque identifiers (hex digests, zone/account ids, base64
 * blobs). Quoted shell commands carry them and reports get shared. Slugs with
 * dashes, paths and UUIDs are left alone so quotes stay readable.
 *
 * @param text - Text to process
 * @returns Text with opaque identifiers redacted
 */
function redactOpaqueIds(text: string): string {
  return text
    .replace(
      /(?<![A-Za-z0-9])[0-9a-fA-F]{32,}(?![A-Za-z0-9])/g,
      '[REDACTED_ID]',
    )
    .replace(
      /(?<![A-Za-z0-9+/=])[A-Za-z0-9+/]{24,}={1,2}(?![A-Za-z0-9])/g,
      '[REDACTED_ID]',
    )
    .replace(
      /(?<![A-Za-z0-9])[A-Za-z0-9]{32,}(?![A-Za-z0-9])/g,
      (match: string) =>
        /[a-z]/.test(match) && /[A-Z]/.test(match) && /\d/.test(match)
          ? '[REDACTED_ID]'
          : match,
    );
}

/**
 * Redacts credentials in URLs (https://user:pass@example.com).
 *
 * @param text - Text to process
 * @returns Text with URL credentials redacted
 */
function redactURLCredentials(text: string): string {
  // URL credentials: https://user:pass@host or http://user:pass@host
  // Pattern: protocol://[user[:pass]@]host
  return text.replace(
    /(https?:\/\/)([^:\s@]+)(?::([^\s@]+))?@/g,
    (match: string, protocol: string, _user: string, _pass?: string) => {
      return `${protocol}[REDACTED_URL_CREDENTIAL]@`;
    },
  );
}

/**
 * Redacts email addresses.
 *
 * @param text - Text to process
 * @returns Text with email addresses redacted
 */
function redactEmails(text: string): string {
  // Email pattern: local@domain
  // Pattern: [word chars, dots, hyphens, plus]@[domain with dots]
  return text.replace(
    /[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[REDACTED_EMAIL]',
  );
}

/**
 * Redacts private keys in PEM format.
 *
 * @param text - Text to process
 * @returns Text with PEM private keys redacted
 */
function redactPEMKeys(text: string): string {
  // PEM format: -----BEGIN ... PRIVATE KEY----- ... -----END ... PRIVATE KEY-----
  // This pattern matches multi-line PEM keys
  return text.replace(
    /-----BEGIN\s+[A-Z\s]+PRIVATE\s+KEY-----[\s\S]*?-----END\s+[A-Z\s]+PRIVATE\s+KEY-----/g,
    '[REDACTED_PEM_KEY]',
  );
}

/**
 * Redacts person names detected through greeting patterns.
 *
 * Detects names that appear after common greetings like:
 * - "Hi John", "Hello Mary", "Hey Sarah"
 * - "Dear John", "Hi there, John"
 *
 * @param text - Text to process
 * @returns Text with names redacted
 */
function redactNames(text: string): string {
  // Pattern: Common greetings followed by a capitalized name (2-20 chars)
  // Greetings: Hi, Hello, Hey, Dear, Greetings, etc.
  // Name: Capital letter followed by lowercase letters, may include hyphens/apostrophes
  return text.replace(
    /\b(?:[Hh]i|[Hh]ello|[Hh]ey|[Dd]ear|[Gg]reetings|[Gg]ood\s+(?:morning|afternoon|evening))\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?(?:\s+[A-Z][a-z]+)?)\b/g,
    (match: string, name: string) => {
      // Only redact if the name part looks like a real name (2+ chars, not common words)
      const commonWords = /\b(?:there|everyone|all|team|guys|folks|people)\b/i;
      if (name && name.length >= 2 && !commonWords.test(name)) {
        return match.replace(name, '[REDACTED_NAME]');
      }
      return match;
    },
  );
}

/**
 * Redacts US phone numbers in various formats.
 *
 * Supports formats:
 * - (555) 123-4567
 * - 555-123-4567
 * - 555.123.4567
 * - 5551234567
 * - +1 555 123 4567
 * - 1-555-123-4567
 *
 * @param text - Text to process
 * @returns Text with phone numbers redacted
 */
function redactPhoneNumbers(text: string): string {
  // Separated forms are distinctive enough on their own. A bare run of digits
  // (epoch timestamps, counters) is only a phone number next to a label.
  return text
    .replace(
      /(?:\+?1[-.\s])?\(?[0-9]{3}\)?[-.\s][0-9]{3}[-.\s][0-9]{4}\b/g,
      '[REDACTED_PHONE]',
    )
    .replace(/(?<![\w.])\+[0-9]{9,14}\b/g, '[REDACTED_PHONE]')
    .replace(
      /\b((?:phone|tel|telephone|tel[eé]fono|mobile|m[oó]vil|movil|cell|celular|fax|whatsapp)\s*(?:number|n[uú]mero|no\.?)?[\s:#-]*)([0-9]{10})\b/gi,
      '$1[REDACTED_PHONE]',
    );
}

/**
 * Redacts credit card numbers.
 *
 * Supports:
 * - Visa: 13 or 16 digits, starts with 4
 * - Mastercard: 16 digits, starts with 5
 * - Amex: 15 digits, starts with 34 or 37
 * - Diners Club: 14 digits, starts with 300-305, 36, or 38
 *
 * @param text - Text to process
 * @returns Text with credit card numbers redacted
 */
function redactCreditCards(text: string): string {
  // Issuer-shaped digit runs are only cards when the Luhn checksum holds;
  // that keeps timestamps and counters readable.
  return text.replace(
    /\b(?:(?:4\d{3}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4})|(?:5[1-5]\d{2}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})|(?:3[47]\d{2}[\s-]?\d{6}[\s-]?\d{5})|(?:3[068]\d[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}))\b/g,
    (match: string) =>
      passesLuhn(match.replace(/[\s-]/g, ''))
        ? '[REDACTED_CREDIT_CARD]'
        : match,
  );
}

function passesLuhn(digits: string): boolean {
  const sum = digits
    .split('')
    .reverse()
    .reduce((acc, char, i) => {
      const n = Number(char);
      const doubled = i % 2 === 1 ? n * 2 : n;
      return acc + (doubled > 9 ? doubled - 9 : doubled);
    }, 0);
  return digits.length >= 13 && sum % 10 === 0;
}

/**
 * Redacts US Social Security Numbers (SSN).
 *
 * Format: XXX-XX-XXXX or XXX XX XXXX or XXXXXXXXX
 *
 * @param text - Text to process
 * @returns Text with SSNs redacted
 */
function redactSSN(text: string): string {
  // First 3 digits cannot be 000, 666, or 900-999; middle cannot be 00; last
  // four cannot be 0000. Plain nine-digit runs need an SSN label.
  return text
    .replace(
      /\b(?!000|666|9\d{2})([0-9]{3})[-.\s](?!00)([0-9]{2})[-.\s](?!0000)([0-9]{4})\b/g,
      '[REDACTED_SSN]',
    )
    .replace(
      /\b((?:ssn|social\s+security(?:\s+number)?|seguro\s+social)[\s:#-]*)(?!000|666|9\d{2})[0-9]{3}(?!00)[0-9]{2}(?!0000)[0-9]{4}\b/gi,
      '$1[REDACTED_SSN]',
    );
}

/**
 * Redacts Spanish DNI (Documento Nacional de Identidad).
 *
 * Format: 8 digits followed by a letter (e.g., 12345678Z)
 *
 * @param text - Text to process
 * @returns Text with Spanish DNI redacted
 */
function redactSpanishDNI(text: string): string {
  // DNI: 8 digits + 1 letter
  return text.replace(/\b\d{8}[A-Z]\b/gi, '[REDACTED_SPANISH_DNI]');
}

/**
 * Redacts Spanish NIE (Número de Identidad de Extranjero).
 *
 * Format: X/Y/Z followed by 7 digits and a letter (e.g., X1234567L)
 *
 * @param text - Text to process
 * @returns Text with Spanish NIE redacted
 */
function redactSpanishNIE(text: string): string {
  // NIE: X/Y/Z + 7 digits + 1 letter
  return text.replace(/\b[XYZ]\d{7}[A-Z]\b/gi, '[REDACTED_SPANISH_NIE]');
}

/**
 * Redacts Mexican CURP (Clave Única de Registro de Población).
 *
 * Format: 18 alphanumeric characters (e.g., GARC800101HDFRRS09)
 *
 * @param text - Text to process
 * @returns Text with Mexican CURP redacted
 */
function redactMexicanCURP(text: string): string {
  // CURP: 4 letters + 6 digits + 1 letter (H/M) + 5 letters + 2 alphanumeric
  return text.replace(
    /\b[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]{2}\b/gi,
    '[REDACTED_MEXICAN_CURP]',
  );
}

/**
 * Redacts Brazilian CPF (Cadastro de Pessoas Físicas).
 *
 * Format: XXX.XXX.XXX-XX or XXXXXXXXXXX (11 digits)
 *
 * @param text - Text to process
 * @returns Text with Brazilian CPF redacted
 */
function redactBrazilianCPF(text: string): string {
  // The formatted shape is distinctive; eleven bare digits need a CPF label.
  return text
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[REDACTED_BRAZILIAN_CPF]')
    .replace(/\b(cpf[\s:#-]*)\d{11}\b/gi, '$1[REDACTED_BRAZILIAN_CPF]');
}

/**
 * Redacts UK National Insurance Number (NINO).
 *
 * Format: 2 letters, 6 digits, 1 letter (e.g., AB123456C)
 *
 * @param text - Text to process
 * @returns Text with UK NINO redacted
 */
function redactUKNINO(text: string): string {
  // NINO: 2 letters + 6 digits + 1 letter (with optional spaces)
  // Format: AB 12 34 56 C or AB123456C
  return text.replace(
    /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\b/gi,
    '[REDACTED_UK_NINO]',
  );
}

/**
 * Redacts Chilean RUN (Rol Único Nacional).
 *
 * Format: 7-8 digits followed by a digit or 'K' (e.g., 12345678-9 or 1234567-K)
 *
 * @param text - Text to process
 * @returns Text with Chilean RUN redacted
 */
function redactChileanRUN(text: string): string {
  // RUN/RUT: 7-8 digits + dash + check digit (0-9 or K)
  // Some sources omit the dash; in that case it's typically 8 digits + check digit (9 total).
  // Important: avoid matching generic 9-digit numbers like SSNs, so only redact when labeled.
  return text.replace(
    /\b(?:RUN|RUT)[\s:]*([0-9]{7,8}-[0-9K]|[0-9]{8}[0-9K])\b/gi,
    (match: string, run: string) => {
      return match.replace(run, '[REDACTED_CHILEAN_RUN]');
    },
  );
}

/**
 * Redacts Argentine DNI (Documento Nacional de Identidad).
 *
 * Format: 8 digits (e.g., 12345678)
 *
 * @param text - Text to process
 * @returns Text with Argentine DNI redacted
 */
function redactArgentineDNI(text: string): string {
  // Argentine DNI: 8 digits (but we need to be careful not to match phone numbers)
  // Only match if it appears in context that suggests it's a DNI
  // We'll match 8 digits that aren't part of phone numbers or credit cards
  return text.replace(
    /\b(?:DNI|dni)[\s:]*(\d{8})\b/gi,
    (match: string, dni: string) => {
      return match.replace(dni, '[REDACTED_ARGENTINE_DNI]');
    },
  );
}

/**
 * Redacts IPv4 addresses.
 *
 * Format: XXX.XXX.XXX.XXX (e.g., 192.168.1.1)
 *
 * @param text - Text to process
 * @returns Text with IPv4 addresses redacted
 */
function redactIPv4(text: string): string {
  // IPv4: 4 groups of 1-3 digits (0-255) separated by dots
  // Exclude common non-sensitive IPs like 127.0.0.1, 0.0.0.0
  return text.replace(
    /\b(?!(?:127\.0\.0\.1|0\.0\.0\.0|255\.255\.255\.255))(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    '[REDACTED_IPV4]',
  );
}

/**
 * Redacts IPv6 addresses.
 *
 * Format: Various formats (e.g., 2001:0db8:85a3:0000:0000:8a2e:0370:7334)
 *
 * @param text - Text to process
 * @returns Text with IPv6 addresses redacted
 */
function redactIPv6(text: string): string {
  // IPv6: 8 groups of 1-4 hex digits separated by colons
  // Can have :: for zero compression
  // Exclude localhost (::1)
  return text.replace(
    /\b(?!(?:::1|::))(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b|\b(?:[0-9a-fA-F]{1,4}:){1,7}::\b|\b::(?:[0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}\b/g,
    '[REDACTED_IPV6]',
  );
}

/**
 * Redacts MAC addresses.
 *
 * Format: XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX (e.g., 00:1B:44:11:3A:B7)
 *
 * @param text - Text to process
 * @returns Text with MAC addresses redacted
 */
function redactMACAddresses(text: string): string {
  // MAC address: 6 groups of 2 hex digits separated by : or -
  return text.replace(
    /\b(?:[0-9A-Fa-f]{2}[:-]){5}(?:[0-9A-Fa-f]{2})\b/g,
    '[REDACTED_MAC_ADDRESS]',
  );
}

/**
 * Redacts passport numbers.
 *
 * Formats vary by country, but common patterns:
 * - US: 9 digits (e.g., 123456789)
 * - UK: 9 digits (e.g., 123456789)
 * - Canada: 2 letters + 6 digits (e.g., AB123456)
 * - EU: 9 alphanumeric characters
 *
 * @param text - Text to process
 * @returns Text with passport numbers redacted
 */
function redactPassportNumbers(text: string): string {
  // Passport patterns:
  // - US/UK: 9 digits
  // - Canada: 2 letters + 6 digits
  // - EU/General: 6-9 alphanumeric characters when prefixed with "passport"
  return text.replace(
    /\b(?:passport|pasaporte)[\s:]*([A-Z0-9]{6,9})\b/gi,
    (match: string, passport: string) => {
      // "passport strategy" is code talk; real numbers contain digits.
      return /\d/.test(passport)
        ? match.replace(passport, '[REDACTED_PASSPORT]')
        : match;
    },
  );
}

/**
 * Redacts driver license numbers.
 *
 * Formats vary by country/state:
 * - US: Varies by state (typically 8-12 alphanumeric)
 * - UK: 16 characters (5 letters + 11 digits)
 * - Canada: Varies by province
 *
 * @param text - Text to process
 * @returns Text with driver license numbers redacted
 */
function redactDriverLicenseNumbers(text: string): string {
  // Driver license: Match when prefixed with common terms
  // Pattern: 8-16 alphanumeric characters
  return text.replace(
    /\b(?:driver\s*license|licencia\s*de\s*conducir|DL|D\.L\.)[\s:]*([A-Z0-9]{8,16})\b/gi,
    (match: string, license: string) => {
      return /\d/.test(license)
        ? match.replace(license, '[REDACTED_DRIVER_LICENSE]')
        : match;
    },
  );
}

/**
 * Redacts physical addresses.
 *
 * Detects common address patterns like:
 * - Street addresses with numbers
 * - ZIP/postal codes
 * - Common address formats
 *
 * @param text - Text to process
 * @returns Text with addresses redacted
 */
function redactAddresses(text: string): string {
  // Address patterns:
  // - US ZIP: 5 digits or 5+4 format (12345 or 12345-6789)
  // - UK postcode: SW1A 1AA format
  // - Canadian postal code: A1A 1A1 format
  // - Street address: Number + street name (when in context)
  let sanitized = text;

  // US ZIP codes: only with a label, after "City, ST", or in ZIP+4 form;
  // any five-digit number would otherwise be eaten (ports, counts, years+).
  sanitized = sanitized
    .replace(
      /\b(zip(?:\s*code)?|postal(?:\s*code)?|c[oó]digo\s+postal|c\.?p\.?)([\s:#-]*)\d{5}(?:-\d{4})?\b/gi,
      '$1$2[REDACTED_ZIP_CODE]',
    )
    .replace(/(,\s*[A-Z]{2}\s+)\d{5}(?:-\d{4})?\b/g, '$1[REDACTED_ZIP_CODE]')
    .replace(/\b\d{5}-\d{4}\b/g, '[REDACTED_ZIP_CODE]');

  // UK postcodes (uppercase only: "e2e 4ab" style tokens are not postcodes)
  sanitized = sanitized.replace(
    /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/g,
    '[REDACTED_POSTCODE]',
  );

  // Canadian postal codes
  sanitized = sanitized.replace(
    /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g,
    '[REDACTED_POSTAL_CODE]',
  );

  // Street addresses (when prefixed with common terms)
  sanitized = sanitized.replace(
    /\b(?:address|direcci[oó]n|street|calle|avenue|ave)[\s:]*(\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|circle|cir))?\b/gi,
    (match: string) => {
      return match.replace(
        /\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|circle|cir)/gi,
        '[REDACTED_ADDRESS]',
      );
    },
  );

  return sanitized;
}

/**
 * Redacts dates of birth when in sensitive context.
 *
 * Detects dates that appear to be birth dates (e.g., "DOB: 01/15/1990")
 *
 * @param text - Text to process
 * @returns Text with birth dates redacted
 */
function redactBirthDates(text: string): string {
  // Birth date patterns when prefixed with common terms:
  // - DOB: MM/DD/YYYY or DD/MM/YYYY
  // - Date of birth: various formats
  return text.replace(
    /\b(?:DOB|date\s+of\s+birth|fecha\s+de\s+nacimiento|born)[\s:]*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/gi,
    (match: string, date: string) => {
      return match.replace(date, '[REDACTED_BIRTH_DATE]');
    },
  );
}

/**
 * Counts the number of redactions in a text by comparing before/after.
 *
 * @param original - Original text
 * @param sanitized - Sanitized text
 * @returns Number of redactions made
 */
function countRedactions(original: string, sanitized: string): number {
  // Count occurrences of [REDACTED_*] patterns
  const redactionPattern = /\[REDACTED_[^\]]+\]/g;
  const matches = sanitized.match(redactionPattern);
  return matches ? matches.length : 0;
}

/**
 * Sanitizes a single text by redacting all detected secrets.
 *
 * @param text - Text to sanitize
 * @returns Sanitized text and count of redactions
 *
 * @example
 * ```typescript
 * const result = sanitize('My API key is sk-1234567890abcdef...');
 * // { text: 'My API key is [REDACTED_OPENAI_KEY]', redacted: 1 }
 * ```
 */
export function sanitize(text: string): SanitizeResult {
  if (!text || text.trim().length === 0) {
    return { text, redacted: 0 };
  }

  let sanitized = text;

  // Apply all redaction functions
  // Order matters: more specific patterns first, then general PII
  sanitized = redactOpenAIKeys(sanitized);
  sanitized = redactAnthropicKeys(sanitized);
  sanitized = redactAWSCredentials(sanitized);
  sanitized = redactBearerTokens(sanitized);
  sanitized = redactProviderTokens(sanitized);
  sanitized = redactSecretAssignments(sanitized);
  sanitized = redactOpaqueIds(sanitized);
  sanitized = redactURLCredentials(sanitized);
  sanitized = redactPEMKeys(sanitized);
  // PII redaction (specific patterns before broad numeric matchers)
  sanitized = redactEmails(sanitized);
  sanitized = redactCreditCards(sanitized);
  // Document numbers (often numeric; must run before SSN/phone)
  sanitized = redactPassportNumbers(sanitized);
  sanitized = redactDriverLicenseNumbers(sanitized);
  // National ID numbers
  sanitized = redactSpanishDNI(sanitized);
  sanitized = redactSpanishNIE(sanitized);
  sanitized = redactMexicanCURP(sanitized);
  sanitized = redactBrazilianCPF(sanitized);
  sanitized = redactUKNINO(sanitized);
  sanitized = redactChileanRUN(sanitized);
  sanitized = redactArgentineDNI(sanitized);
  // Location and personal data
  sanitized = redactAddresses(sanitized);
  sanitized = redactBirthDates(sanitized);
  sanitized = redactNames(sanitized);
  // Broad numeric matchers last (avoid misclassifying other IDs)
  sanitized = redactSSN(sanitized);
  sanitized = redactPhoneNumbers(sanitized);
  // Network identifiers
  sanitized = redactIPv4(sanitized);
  sanitized = redactIPv6(sanitized);
  sanitized = redactMACAddresses(sanitized);

  const redacted = countRedactions(text, sanitized);

  return {
    text: sanitized,
    redacted,
  };
}

/**
 * Sanitizes an array of prompts and returns sanitized prompts with total redaction count.
 *
 * @param prompts - Array of prompts to sanitize
 * @returns Sanitized prompts and total number of redactions across all prompts
 *
 * @example
 * ```typescript
 * const prompts = [
 *   'My key is sk-123...',
 *   'Email me at user@example.com'
 * ];
 * const result = sanitizePrompts(prompts);
 * // {
 * //   prompts: ['My key is [REDACTED_OPENAI_KEY]', 'Email me at [REDACTED_EMAIL]'],
 * //   totalRedacted: 2
 * // }
 * ```
 */
export function sanitizePrompts(
  prompts: readonly string[],
): SanitizePromptsResult {
  if (prompts.length === 0) {
    return { prompts: [], totalRedacted: 0 };
  }

  logger.debug(
    `Sanitizing ${String(prompts.length)} prompts for secrets`,
    'sanitizer',
  );

  const sanitizedPrompts: string[] = [];
  let totalRedacted = 0;

  for (const prompt of prompts) {
    const result = sanitize(prompt);
    sanitizedPrompts.push(result.text);
    totalRedacted += result.redacted;
  }

  if (totalRedacted > 0) {
    logger.debug(
      `Redacted ${String(totalRedacted)} secret(s) from prompts`,
      'sanitizer',
    );
  } else {
    logger.debug('No secrets found to redact', 'sanitizer');
  }

  return {
    prompts: sanitizedPrompts,
    totalRedacted,
  };
}
