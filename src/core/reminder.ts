/**
 * Reminder system for Hyntx.
 *
 * This module provides functions to track the last execution and show
 * periodic reminders to encourage regular prompt analysis.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { differenceInDays, parseISO } from 'date-fns';
import chalk from 'chalk';
import prompts from 'prompts';
import { getEnvConfig } from '../utils/env.js';
import { LAST_RUN_FILE } from '../utils/paths.js';

/**
 * Valid reminder frequencies.
 */
const REMINDER_FREQUENCIES: Record<string, number> = {
  '7d': 7,
  '14d': 14,
  '30d': 30,
} as const;

/**
 * Reminder prompt options.
 */
const REMINDER_OPTIONS = [
  { title: 'Continue with analysis', value: 'continue' },
  { title: 'Remind me later', value: 'postpone' },
  { title: 'Disable reminders', value: 'disable' },
] as const;

/**
 * Reads the last run timestamp from the state file.
 *
 * @returns ISO timestamp string or null if never run
 */
export function getLastRun(): string | null {
  if (!existsSync(LAST_RUN_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(LAST_RUN_FILE, 'utf-8').trim();
    // Validate it's a valid ISO date
    const date = parseISO(content);
    if (isNaN(date.getTime())) {
      return null;
    }
    return content;
  } catch {
    return null;
  }
}

/**
 * Saves the current timestamp as the last run time.
 */
export function saveLastRun(): void {
  const now = new Date().toISOString();
  writeFileSync(LAST_RUN_FILE, now, 'utf-8');
}

/**
 * Calculates the number of days elapsed since the last run.
 *
 * @returns Number of days or null if never run
 */
export function getDaysElapsed(): number | null {
  const lastRun = getLastRun();
  if (!lastRun) {
    return null;
  }

  const lastRunDate = parseISO(lastRun);
  const now = new Date();
  return differenceInDays(now, lastRunDate);
}

/**
 * Checks if a reminder should be shown based on configuration and elapsed time.
 *
 * @returns true if reminder should be shown
 */
export function shouldShowReminder(): boolean {
  const config = getEnvConfig();
  const reminder = config.reminder;

  // Never show reminder if disabled
  if (reminder === 'never') {
    return false;
  }

  const days = getDaysElapsed();

  // First run - show welcome reminder
  if (days === null) {
    return true;
  }

  // Check if enough days have passed
  const threshold = REMINDER_FREQUENCIES[reminder];
  if (!threshold) {
    return false;
  }

  return days >= threshold;
}

/**
 * Shows the interactive reminder prompt.
 *
 * @returns true if user wants to continue with analysis, false otherwise
 */
export async function showReminder(): Promise<boolean> {
  const days = getDaysElapsed();

  // Build message based on last run
  const message =
    days === null
      ? chalk.cyan("It's time to analyze your prompts!")
      : chalk.cyan(
          `It's been ${chalk.bold(days)} days since your last analysis.`,
        );

  console.log('\n' + message + '\n');

  const response = (await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [...REMINDER_OPTIONS],
  })) as { action?: string };

  const action = response.action;

  if (action === 'continue') {
    return true;
  }

  if (action === 'disable') {
    console.log(
      '\n' +
        chalk.yellow('To disable reminders, set ') +
        chalk.bold('HYNTX_REMINDER=never') +
        chalk.yellow(' in your shell config.\n'),
    );
    return false;
  }

  // postpone or cancelled
  return false;
}

/**
 * Main reminder check function.
 * Checks if a reminder should be shown and handles user interaction.
 *
 * @returns true if analysis should proceed, false otherwise
 */
export async function checkReminder(): Promise<boolean> {
  if (!shouldShowReminder()) {
    return true; // No reminder needed, proceed with analysis
  }

  return await showReminder();
}
