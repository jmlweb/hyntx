/**
 * Persistent daily-metrics history under ~/.hyntx so trends outlive Claude
 * Code's log retention. Only aggregate numbers are stored, never text.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { type DailyPoint } from '../types/index.js';
import { DAILY_HISTORY_FILE } from '../utils/paths.js';

const HISTORY_SCHEMA_VERSION = 1;

type HistoryFile = {
  readonly schemaVersion: typeof HISTORY_SCHEMA_VERSION;
  readonly days: readonly DailyPoint[];
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

export async function loadDailyHistory(
  filePath: string = DAILY_HISTORY_FILE,
): Promise<readonly DailyPoint[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf-8'));
    const days =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { days?: unknown }).days
        : null;
    return Array.isArray(days) ? days.filter(isDailyPoint) : [];
  } catch {
    // Missing or corrupt history is not fatal: it is rebuilt from the logs.
    return [];
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

export async function saveDailyHistory(
  days: readonly DailyPoint[],
  filePath: string = DAILY_HISTORY_FILE,
): Promise<void> {
  const content: HistoryFile = { schemaVersion: HISTORY_SCHEMA_VERSION, days };
  await mkdir(dirname(filePath), { recursive: true });
  const tmpFile = `${filePath}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(content)}\n`, 'utf-8');
  await rename(tmpFile, filePath);
}
