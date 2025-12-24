# Add Centralized Logging and Warning Collection System

## Metadata

- **Priority**: P1
- **Phase**: 3
- **Dependencies**: cli-entry-basico.md
- **Estimation**: TBD
- **Source**: IDEA-004 - Implement Centralized Logging and Warning Collection System

## Description

Currently, the codebase has inconsistent error handling with silent error swallowing in multiple locations (`log-reader.ts`, `shell-config.ts`) and direct `console.log`/`error`/`warn` calls scattered throughout. This makes debugging difficult and violates the error handling strategy defined in `TECHNICAL_DEBT.md` items #3 and #4.

The system should provide a unified logging interface that:

- Collects warnings during execution (non-fatal issues)
- Logs errors with proper context (file, line, operation)
- Reports warnings at appropriate times (end of analysis, end of CLI run)
- Provides consistent formatting using chalk for colors
- Supports different log levels (error, warn, info, debug)

## Objective

Provide consistent, centralized logging throughout the codebase and eliminate silent error swallowing.

## Scope

- Includes:
  - Create `Logger` utility class with error, warn, info, debug methods
  - Implement warning collection system
  - Replace silent catch blocks with proper logging
  - Replace direct console calls with logger calls
  - Display warning summary at end of CLI execution
- Excludes:
  - File-based logging
  - External logging services
  - Structured logging (JSON format for logs)

## Files to Create/Modify

- `src/utils/logger.ts` - Create Logger utility
- `src/core/log-reader.ts` - Replace silent catch blocks
- `src/utils/shell-config.ts` - Replace silent catch blocks
- `src/index.ts` - Integrate warning reporting at CLI end
- All files with direct console.\* calls - Replace with logger

## Implementation

1. **Create logging utility** (`src/utils/logger.ts`):

   ```typescript
   import chalk from 'chalk';

   class Logger {
     private warnings: string[] = [];
     private verboseEnabled = false;

     setVerbose(enabled: boolean) {
       this.verboseEnabled = enabled;
     }

     error(message: string, context?: string) {
       const prefix = context ? `[${context}] ` : '';
       process.stderr.write(chalk.red(`ERROR: ${prefix}${message}\n`));
     }

     warn(message: string) {
       process.stderr.write(chalk.yellow(`WARN: ${message}\n`));
     }

     info(message: string) {
       process.stderr.write(chalk.blue(`INFO: ${message}\n`));
     }

     debug(message: string) {
       if (this.verboseEnabled) {
         process.stderr.write(chalk.gray(`[DEBUG] ${message}\n`));
       }
     }

     collectWarning(message: string) {
       this.warnings.push(message);
     }

     getWarnings(): string[] {
       return [...this.warnings];
     }
     clearWarnings() {
       this.warnings = [];
     }

     reportWarnings() {
       if (this.warnings.length > 0) {
         process.stderr.write(
           chalk.yellow(`\n⚠️  ${this.warnings.length} warning(s):\n`),
         );
         this.warnings.forEach((w) =>
           process.stderr.write(chalk.yellow(`  - ${w}\n`)),
         );
         this.clearWarnings();
       }
     }
   }

   export const logger = new Logger();
   ```

2. **Replace silent catch blocks**:
   - In `log-reader.ts`: Log schema validation failures
   - In `shell-config.ts`: Log file operation failures

3. **CLI integration**:
   - Collect warnings during log reading, analysis, etc.
   - Call `logger.reportWarnings()` at end of successful runs
   - Use verbose flag to show debug-level logs

## Acceptance Criteria

- [ ] `Logger` utility class implemented with error, warn, info, debug methods
- [ ] Warning collection system accumulates warnings during execution
- [ ] Silent error swallowing in `log-reader.ts` replaced with proper logging
- [ ] Silent error swallowing in `shell-config.ts` replaced with proper logging
- [ ] Direct console calls replaced with logger calls throughout codebase
- [ ] Warnings are collected and displayed at end of CLI execution
- [ ] Error messages include context (operation, file when available)
- [ ] All logging uses chalk for consistent coloring
- [ ] Tests verify logging behavior and warning collection

## Test Cases

- Test logger methods output to stderr
- Test warning collection and retrieval
- Test warning reporting and clearing
- Test debug output only when verbose enabled
- Test chalk colors applied correctly

## References

- See ROADMAP.md for context
- See IDEA-004 for original proposal
- Addresses TECHNICAL_DEBT.md items #3 and #4
- Coordinates with IDEA-003 (verbose/debug mode)
