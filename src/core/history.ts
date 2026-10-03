/**
 * Persistent daily-metrics history under ~/.hyntx so trends outlive Claude
 * Code's log retention. Only aggregate numbers are stored, never text.
 */

import { readFile, rename } from 'node:fs/promises';

import { type DailyPoint } from '../types/index.js';
import { writeFileAtomic } from '../utils/atomic-write.js';
import { DAILY_HISTORY_FILE } from '../utils/paths.js';

const HISTORY_SCHEMA_VERSION = 1;

type HistoryFile = {
  readonly schemaVersion: typeof HISTORY_SCHEMA_VERSION;
  readonly days: readonly DailyPoint[];
};

export type LoadedHistory = {
  readonly days: readonly DailyPoint[];
  /** True when a history file existed but could not be used. */
  readonly unreadable: boolean;
};

function isDailyPoint(value: unknown): value is DailyPoint {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const point = value as Record<string, unknown>;
  return (
    typeof point['date'] === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(point['date']) &&
    typeof point['sessions'] === 'number' &&
    typeof point['tokens'] === 'object' &&
    point['tokens'] !== null
  );
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && (error as { code?: unknown }).code === 'ENOENT'
  );
}

/**
 * A missing file is normal. A corrupt one is set aside (not overwritten
 * silently) and reported, so the user knows older trends may be gone.
 */
export async function loadDailyHistory(
  filePath: string = DAILY_HISTORY_FILE,
): Promise<LoadedHistory> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (error) {
    return { days: [], unreadable: !isMissing(error) };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const days =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { days?: unknown }).days
        : null;
    if (!Array.isArray(days)) {
      throw new Error('no days array');
    }
    return { days: days.filter(isDailyPoint), unreadable: false };
  } catch {
    await rename(filePath, `${filePath}.corrupt`).catch(() => undefined);
    return { days: [], unreadable: true };
  }
}

function magnitude(point: DailyPoint): number {
  return point.turns + point.toolCalls + point.sessions;
}

/**
 * Merges by day. A fresh point replaces the stored one unless the stored one
 * saw more activity, which means Claude Code already pruned part of that day.
 */
export function mergeDaily(
  stored: readonly DailyPoint[],
  fresh: readonly DailyPoint[],
): readonly DailyPoint[] {
  const byDate = new Map(stored.map((point) => [point.date, point]));
  for (const point of fresh) {
    const existing = byDate.get(point.date);
    if (!existing || magnitude(point) >= magnitude(existing)) {
      byDate.set(point.date, point);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Re-reads the file right before writing and merges, so a run that finished
 * while this one was analyzing is not overwritten. The write itself is atomic.
 */
export async function saveDailyHistory(
  days: readonly DailyPoint[],
  filePath: string = DAILY_HISTORY_FILE,
): Promise<void> {
  const latest = await loadDailyHistory(filePath);
  const content: HistoryFile = {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    days: mergeDaily(latest.days, days),
  };
  await writeFileAtomic(filePath, `${JSON.stringify(content)}\n`);
}
