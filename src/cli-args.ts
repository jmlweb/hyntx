/**
 * CLI argument helpers, kept apart from cli.ts so they can be unit tested.
 */

import {
  addDays,
  endOfDay,
  parseDateInput,
  startOfDay,
} from './utils/dates.js';

export const DEFAULT_DAYS = 7;

export class UsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}

/** parseArgs has no optional-value strings, so fold `--html [path]` first. */
export function normalizeHtmlFlag(argv: readonly string[]): readonly string[] {
  return argv.flatMap((arg, i): string[] => {
    if (arg === '--html') {
      const next = argv[i + 1];
      return next !== undefined && !next.startsWith('-') ? [] : ['--html='];
    }
    if (i > 0 && argv[i - 1] === '--html' && !arg.startsWith('-')) {
      return [`--html=${arg}`];
    }
    return [arg];
  });
}

export function parseEnum<T extends string>(
  value: string,
  allowed: Readonly<Record<string, T>>,
  flag: string,
): T {
  const match = Object.values(allowed).find((v) => v === value);
  if (!match) {
    throw new UsageError(
      `Invalid ${flag} "${value}". Use one of: ${Object.values(allowed).join(', ')}.`,
    );
  }
  return match;
}

export function resolvePeriod(
  values: { days?: string; from?: string; to?: string },
  now: Date,
): { from: Date; to: Date } {
  if (values.days !== undefined && (values.from || values.to)) {
    throw new UsageError('Use either --days or --from/--to, not both.');
  }
  if (values.from || values.to) {
    const to = values.to ? endOfDay(parseDateInput(values.to, now)) : now;
    const from = values.from
      ? parseDateInput(values.from, now)
      : addDays(startOfDay(to), -(DEFAULT_DAYS - 1));
    if (from > to) {
      throw new UsageError('--from must not be after --to.');
    }
    return { from, to };
  }
  const days = values.days === undefined ? DEFAULT_DAYS : Number(values.days);
  if (!Number.isInteger(days) || days < 1) {
    throw new UsageError('--days must be a positive integer.');
  }
  return { from: addDays(startOfDay(now), -(days - 1)), to: now };
}
