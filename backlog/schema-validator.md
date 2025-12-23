# Log Schema Validator

## Metadata

- **Priority**: P0
- **Phase**: 1
- **Dependencies**: tipos-base.md
- **Estimation**: 2 hours

## Description

Implement the schema validation system for Claude Code logs. Allows detecting schema versions and handling log format changes gracefully.

## Objective

Provide resilience against changes in Claude Code log format, allowing the system to continue functioning even if the schema evolves, with appropriate warnings to the user.

## Scope

- Includes: Schema version detection, compatibility validation, warning message generation
- Excludes: Log parsing (done in log-reader), handling multiple versions (only detects and warns)

## Files to Create/Modify

- `src/core/schema-validator.ts` - Schema validation functions

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `SchemaVersion`

### Main Functions/Classes

**src/core/schema-validator.ts:**

- `detectSchemaVersion()` - Detects schema version from message structure
- `isSchemaSupported()` - Verifies if a schema version is supported
- `getSchemaWarning()` - Generates user-friendly warning message

### Integrations

- Used by `log-reader.ts` to validate schemas before processing
- Has no external dependencies beyond types

## Acceptance Criteria

- [ ] Correctly detects schema v1.0 from message structure
- [ ] Returns `null` for unknown schemas
- [ ] Correctly validates if a schema is supported
- [ ] Generates clear and useful warning messages
- [ ] Handles messages with unknown structure gracefully
- [ ] List of supported schemas is easy to extend

## Test Cases

- Detection of valid v1.0 schema
- Detection of unknown schema (different structure)
- Validation of supported vs unsupported schema
- Warning message generation for different cases

## References

- Section 10 of `docs/SPECS.md` - Schema Validator
