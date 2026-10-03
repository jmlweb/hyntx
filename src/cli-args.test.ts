import { describe, expect, it } from 'vitest';

import {
  normalizeHtmlFlag,
  parseEnum,
  resolvePeriod,
  UsageError,
} from './cli-args.js';
import { OutputFormat } from './types/index.js';

const NOW = new Date(2026, 8, 20, 15, 30);

describe('resolvePeriod', () => {
  it('defaults to the last 7 calendar days including today', () => {
    const { from, to } = resolvePeriod({}, NOW);
    expect(from).toEqual(new Date(2026, 8, 14));
    expect(to).toEqual(NOW);
  });

  it('supports --days and explicit ranges with an inclusive end date', () => {
    expect(resolvePeriod({ days: '1' }, NOW).from).toEqual(
      new Date(2026, 8, 20),
    );
    const range = resolvePeriod({ from: '2026-09-01', to: '2026-09-03' }, NOW);
    expect(range.from).toEqual(new Date(2026, 8, 1));
    expect(range.to.getDate()).toBe(3);
    expect(range.to.getHours()).toBe(23);
  });

  it('rejects invalid combinations and values', () => {
    expect(() => resolvePeriod({ days: '0' }, NOW)).toThrow(UsageError);
    expect(() => resolvePeriod({ days: 'abc' }, NOW)).toThrow(UsageError);
    expect(() => resolvePeriod({ days: '3', from: '2026-09-01' }, NOW)).toThrow(
      'either',
    );
    expect(() =>
      resolvePeriod({ from: '2026-09-05', to: '2026-09-01' }, NOW),
    ).toThrow('after');
    expect(() => resolvePeriod({ from: '2026-13-45' }, NOW)).toThrow();
  });
});

describe('normalizeHtmlFlag', () => {
  it('folds an optional path into --html=', () => {
    expect(normalizeHtmlFlag(['--html', 'out.html', '--days', '3'])).toEqual([
      '--html=out.html',
      '--days',
      '3',
    ]);
    expect(normalizeHtmlFlag(['--html'])).toEqual(['--html=']);
    expect(normalizeHtmlFlag(['--html', '--verbose'])).toEqual([
      '--html=',
      '--verbose',
    ]);
  });
});

describe('parseEnum', () => {
  it('accepts known values and rejects others', () => {
    expect(parseEnum('json', OutputFormat, '--format')).toBe('json');
    expect(() => parseEnum('xml', OutputFormat, '--format')).toThrow(
      'Invalid --format',
    );
  });
});
