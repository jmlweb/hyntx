/**
 * Local-time date helpers. Days are always the user's local calendar days.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

export function toDateKey(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isoToDateKey(iso: string): string {
  return toDateKey(new Date(iso));
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Parses 'today', 'yesterday' or YYYY-MM-DD into a local-midnight Date.
 * @throws Error on anything else.
 */
export function parseDateInput(input: string, now = new Date()): Date {
  const value = input.trim().toLowerCase();
  if (value === 'today') {
    return startOfDay(now);
  }
  if (value === 'yesterday') {
    return addDays(startOfDay(now), -1);
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(
      `Invalid date "${input}". Use YYYY-MM-DD, "today" or "yesterday".`,
    );
  }
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (toDateKey(parsed) !== value) {
    throw new Error(`Invalid calendar date "${input}".`);
  }
  return parsed;
}

/** Inclusive list of YYYY-MM-DD keys between two dates. */
export function listDateKeys(from: Date, to: Date): readonly string[] {
  const keys: string[] = [];
  for (
    let cursor = startOfDay(from);
    cursor <= to;
    cursor = addDays(cursor, 1)
  ) {
    keys.push(toDateKey(cursor));
  }
  return keys;
}

export function diffMinutes(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000;
}
