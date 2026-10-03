/**
 * Builds the serializable `Report` from sessions. Pure: all IO (reading logs,
 * history, writing files) happens in the caller.
 */

import {
  type DailyPoint,
  type DataQuality,
  type Episode,
  EpisodeType,
  type ReadStats,
  type Report,
  REPORT_SCHEMA_VERSION,
  type Session,
} from '../types/index.js';
import { listDateKeys, toDateKey } from '../utils/dates.js';
import { detectFriction } from './friction.js';
import { mergeDaily } from './history.js';
import { generateInsights } from './insights.js';
import { computeDailyPoints, computeMetrics } from './metrics.js';
import { type AllowedRules } from './permissions.js';
import { sanitize } from './sanitizer.js';

export const MIN_SESSIONS_FOR_FINDINGS = 3;
export const MIN_PROMPTS_FOR_FINDINGS = 10;

export type BuildReportOptions = {
  readonly sessions: readonly Session[];
  readonly stats: ReadStats;
  readonly from: Date;
  readonly to: Date;
  readonly project: string | null;
  readonly history?: readonly DailyPoint[];
  readonly allowedRules?: AllowedRules;
  readonly version: string;
  readonly now?: Date;
};

/** Keys whose values are identifiers or structured data, not free text. */
const UNSANITIZED_KEYS: ReadonlySet<string> = new Set([
  'claudeCodeVersions',
  'sessionId',
  'id',
  'episodeIds',
  'episodeId',
  'basedOn',
  'date',
  'timestamp',
  'generatedAt',
  'startedAt',
  'endedAt',
  'from',
  'to',
  'version',
  'schemaVersion',
]);

function sanitizeValue(value: unknown, key: string | null): unknown {
  if (typeof value === 'string') {
    return key !== null && UNSANITIZED_KEYS.has(key)
      ? value
      : sanitize(value).text;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, sanitizeValue(v, k)]),
    );
  }
  return value;
}

/**
 * Final safety net: run every free-text string of the report through the
 * sanitizer, whatever produced it (detectors, insights, LLM engines).
 */
export function sanitizeReport(report: Report): Report {
  return sanitizeValue(report, null) as Report;
}

function buildDataQuality(
  stats: ReadStats,
  sessions: readonly Session[],
  typedPrompts: number,
  periodDays: number,
  episodes: readonly Episode[],
): DataQuality {
  const enoughData =
    sessions.length >= MIN_SESSIONS_FOR_FINDINGS &&
    typedPrompts >= MIN_PROMPTS_FOR_FINDINGS;
  const unknownCount = Object.values(stats.unknownRecordTypes).reduce(
    (a, b) => a + b,
    0,
  );
  const notes = [
    ...(enoughData
      ? []
      : [
          `Only ${String(sessions.length)} session(s) and ${String(typedPrompts)} typed prompt(s) in the last ${String(periodDays)} day(s); findings need at least ${String(MIN_SESSIONS_FOR_FINDINGS)} sessions and ${String(MIN_PROMPTS_FOR_FINDINGS)} prompts to be reliable.`,
        ]),
    ...(unknownCount > 0
      ? [
          `${String(unknownCount)} record(s) of unknown type were skipped (${Object.keys(stats.unknownRecordTypes).join(', ')}); the log format may have changed.`,
        ]
      : []),
    ...(stats.recordsSkipped > 0
      ? [`${String(stats.recordsSkipped)} malformed line(s) were skipped.`]
      : []),
    ...(episodes.some((e) => e.type === EpisodeType.CORRECTION)
      ? [
          'Corrections are detected heuristically from phrasing and are not confirmed without an interpretation step.',
        ]
      : []),
  ];
  return {
    filesRead: stats.filesRead,
    subagentFilesRead: stats.subagentFilesRead,
    recordsRead: stats.recordsRead,
    recordsSkipped: stats.recordsSkipped,
    unknownRecordTypes: stats.unknownRecordTypes,
    duplicateRecords: stats.duplicateRecords,
    orphanToolResults: stats.orphanToolResults,
    claudeCodeVersions: stats.claudeCodeVersions,
    sessionsInPeriod: sessions.length,
    typedPrompts,
    enoughData,
    notes,
  };
}

export function buildReport(options: BuildReportOptions): Report {
  const { sessions, stats, from, to, project } = options;
  const metrics = computeMetrics(sessions);
  const { episodes, promptTraits } = detectFriction(sessions);
  const insights = generateInsights({
    metrics,
    episodes,
    promptTraits,
    ...(options.allowedRules ? { allowedRules: options.allowedRules } : {}),
  });
  const currentDaily = computeDailyPoints(sessions, episodes);
  // The stored history is global; merging a project-filtered slice into it
  // would mix scopes, so filtered runs only show their own series.
  const daily =
    project === null
      ? mergeDaily(options.history ?? [], currentDaily)
      : currentDaily;
  const periodDays = listDateKeys(from, to).length;

  const report: Report = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generator: { name: 'hyntx', version: options.version },
    generatedAt: (options.now ?? new Date()).toISOString(),
    period: { from: toDateKey(from), to: toDateKey(to), days: periodDays },
    filters: { project },
    dataQuality: buildDataQuality(
      stats,
      sessions,
      metrics.overall.typedPrompts,
      periodDays,
      episodes,
    ),
    metrics,
    daily,
    episodes,
    promptTraits,
    insights,
    interpretation: null,
  };
  return sanitizeReport(report);
}
