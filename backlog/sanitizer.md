# Secret Sanitizer

## Metadata

- **Priority**: P1
- **Phase**: 2
- **Dependencies**: tipos-base.md
- **Estimation**: 3 hours

## Description

Implement the sanitization system that automatically redacts secrets and sensitive information from prompts before sending them to AI providers.

## Objective

Ensure user privacy by automatically redacting secrets, API keys, credentials, and other sensitive information from prompts before analysis.

## Scope

- Includes: Detection and redaction of all specified secret types, redaction counter
- Excludes: Secret validation (only detects and replaces), sending to providers (done in other modules)

## Files to Create/Modify

- `src/core/sanitizer.ts` - Sanitization functions

## Implementation

### TypeScript Types

Does not require additional types beyond basic TypeScript.

### Main Functions/Classes

**src/core/sanitizer.ts:**

- `sanitize()` - Sanitizes a single text and returns clean text + counter
- `sanitizePrompts()` - Sanitizes an array of prompts and returns clean prompts + total redacted

### Integrations

- Used by CLI before sending prompts to providers
- Has no external dependencies

## Acceptance Criteria

- [ ] Detects and redacts OpenAI API keys (`sk-*`)
- [ ] Detects and redacts Anthropic API keys (`sk-ant-*`)
- [ ] Detects and redacts AWS credentials (`AKIA*`)
- [ ] Detects and redacts Bearer tokens
- [ ] Detects and redacts credentials in URLs (`https://user:pass@example.com`)
- [ ] Detects and redacts email addresses
- [ ] Detects and redacts private keys (PEM format)
- [ ] Returns accurate counter of redacted secrets
- [ ] Works correctly with arrays of prompts
- [ ] Does not affect the rest of the text (only replaces secrets)

## Test Cases

- Sanitization of each secret type individually
- Sanitization of text with multiple secret types
- Sanitization of array of prompts
- Verify that counter is accurate
- Verify that non-secret text remains intact
- Edge cases: secrets at start/end of text, secrets in different formats

## References

- Section 12 of `docs/SPECS.md` - Sanitizer
