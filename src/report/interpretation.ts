/**
 * Applies interpretation verdicts to insights for display: an insight whose
 * flagged episodes were all rejected is dismissed, one with a confirmed
 * episode is marked confirmed.
 */

import {
  type Insight,
  type Interpretation,
  type InterpretationVerdict,
  type Report,
} from '../types/index.js';

export type InsightState = 'confirmed' | 'dismissed' | 'unverified';

export type JudgedInsight = {
  readonly insight: Insight;
  readonly state: InsightState;
  /** Verdict notes for this insight's episodes, strongest first. */
  readonly notes: readonly {
    readonly verdict: InterpretationVerdict;
    readonly note: string;
  }[];
};

const ORDER: Readonly<Record<InterpretationVerdict, number>> = {
  confirmed: 0,
  rejected: 1,
  unclear: 2,
};

export function judgeInsight(
  insight: Insight,
  interpretation: Interpretation | null,
): JudgedInsight {
  const ids = new Set(insight.episodeIds);
  const verdicts = (interpretation?.episodeVerdicts ?? []).filter((v) =>
    ids.has(v.episodeId),
  );
  const notes = verdicts
    .map((v) => ({ verdict: v.verdict, note: v.note }))
    .sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
  const state: InsightState =
    verdicts.length === 0
      ? 'unverified'
      : verdicts.some((v) => v.verdict === 'confirmed')
        ? 'confirmed'
        : verdicts.every((v) => v.verdict === 'rejected')
          ? 'dismissed'
          : 'unverified';
  return { insight, state, notes };
}

export function judgeInsights(report: Report): {
  readonly kept: readonly JudgedInsight[];
  readonly dismissed: readonly JudgedInsight[];
} {
  const judged = report.insights.map((insight) =>
    judgeInsight(insight, report.interpretation),
  );
  return {
    kept: judged.filter((j) => j.state !== 'dismissed'),
    dismissed: judged.filter((j) => j.state === 'dismissed'),
  };
}
