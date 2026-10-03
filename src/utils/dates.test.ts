import { describe, expect, it } from 'vitest';

import {
  addDays,
  isoToDateKey,
  listDateKeys,
  parseDateInput,
  toDateKey,
} from './dates.js';

describe('dates', () => {
  it('parses ISO, today and yesterday in local time', () => {
    const now = new Date(2026, 8, 20, 10);
    expect(toDateKey(parseDateInput('2026-09-05', now))).toBe('2026-09-05');
    expect(toDateKey(parseDateInput('today', now))).toBe('2026-09-20');
    expect(toDateKey(parseDateInput('Yesterday', now))).toBe('2026-09-19');
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => parseDateInput('09/05/2026')).toThrow('Invalid date');
    expect(() => parseDateInput('2026-02-31')).toThrow('Invalid calendar date');
  });

  it('lists inclusive day keys across month boundaries', () => {
    expect(
      listDateKeys(new Date(2026, 8, 29), new Date(2026, 9, 2, 5)),
    ).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(toDateKey(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31');
  });

  it('maps ISO timestamps to local day keys', () => {
    expect(isoToDateKey(new Date(2026, 8, 20, 12).toISOString())).toBe(
      '2026-09-20',
    );
  });
});
