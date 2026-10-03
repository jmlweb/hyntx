/**
 * Display-side view of the insight reviews: pairs each insight with its
 * review and verdict notes. A dismissed insight is hidden by every renderer.
 */

import { reviewInsight } from '../core/insight-review.js';
import {
  type Insight,
  type InsightReview,
  type InsightState,
  type Interpretation,
  type InterpretationVerdict,
  type Report,
} from '../types/index.js';

export type { InsightState };

export type JudgedInsight = {
  readonly insight: Insight;
  readonly state: InsightState;
  readonly review: InsightReview;
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
  const notes = (interpretation?.episodeVerdicts ?? [])
    .filter((v) => ids.has(v.episodeId))
    .map((v) => ({ verdict: v.verdict, note: v.note }))
    .sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
  const review = reviewInsight(insight, interpretation);
  return { insight, state: review.state, review, notes };
}

/** "3 of 9 episodes reviewed: 1 confirmed, 2 rejected", or null if none were. */
export function describeCoverage(review: InsightReview): string | null {
  if (review.reviewed === 0) {
    return null;
  }
  const parts = [
    review.confirmed > 0 ? `${String(review.confirmed)} confirmed` : null,
    review.rejected > 0 ? `${String(review.rejected)} rejected` : null,
    review.unclear > 0 ? `${String(review.unclear)} unclear` : null,
  ].filter((part): part is string => part !== null);
  const unreviewed = review.episodes - review.reviewed;
  return (
    `LLM reviewed ${String(review.reviewed)} of ${String(review.episodes)} ` +
    `${review.episodes === 1 ? 'episode' : 'episodes'}: ${parts.join(', ')}` +
    (unreviewed > 0 ? `; ${String(unreviewed)} not reviewed` : '')
  );
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
