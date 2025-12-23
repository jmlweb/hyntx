# Reminder System

## Metadata

- **Priority**: P3
- **Phase**: 4
- **Dependencies**: tipos-base.md, utils-completos.md
- **Estimation**: 3-4 hours

## Description

Implement the reminder system that tracks the last execution and shows periodic reminders to users to analyze their prompts regularly.

## Objective

Help users maintain the habit of analyzing their prompts regularly through configurable periodic reminders.

## Scope

- Includes: Last execution persistence, days elapsed calculation, reminder logic, interactive prompt, shell config integration
- Excludes: Integration with .zshrc/.bashrc (already in setup-inicial.md), actual analysis (done by CLI)

## Files to Create/Modify

- `src/core/reminder.ts` - Reminder system functions
- `src/utils/paths.ts` - Add LAST_RUN_FILE constant

## Implementation

### TypeScript Types

Uses types from `src/types/index.ts`:

- `EnvConfig` (for reminder frequency)

### Main Functions/Classes

**src/core/reminder.ts:**

- `getLastRun()` - Reads last execution timestamp
- `saveLastRun()` - Saves last execution timestamp
- `checkReminder()` - Checks if reminder should be shown
- `showReminder()` - Shows interactive reminder prompt

### Integrations

- Uses `date-fns` for day calculation
- Uses `prompts` for interaction
- Uses `chalk` for colors
- Reads/writes `~/.hyntx-last-run` file
- Uses `getEnvConfig()` from `utils/env.ts`

## Acceptance Criteria

- [ ] Correctly reads last execution timestamp
- [ ] Saves last execution timestamp in ISO format
- [ ] Correctly calculates elapsed days
- [ ] Respects configured frequency (7d, 14d, 30d, never)
- [ ] Shows reminder when appropriate
- [ ] Does not show reminder when not appropriate
- [ ] Handles first execution case (never executed)
- [ ] Interactive prompt allows continue, postpone, or disable
- [ ] Shows instructions to disable reminders
- [ ] Exit code 0 when reminder should not be shown
- [ ] Returns true/false to continue with analysis

## Test Cases

- First execution (never executed before)
- Execution within period (should not show)
- Execution after period (should show)
- Different frequencies (7d, 14d, 30d)
- Reminders disabled (never)
- Prompt options (continue, postpone, disable)
- Handling corrupted or invalid file

## References

- Section 9 of `docs/SPECS.md` - Reminder System
- Section 2.4 of `docs/SPECS.md` - Persistent State
