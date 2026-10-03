/**
 * Applies interpretation verdicts to insights. The single source of truth for
 * which insights are confirmed, dismissed or unverified: every renderer and
 * the JSON report use this.
 */

import {
  type Insight,
  type InsightReview,
  type Interpretation,
} from '../types/index.js';

export function reviewInsight(
  insight: Insight,
  interpretation: Interpretation | null,
): InsightReview {
  const ids = new Set(insight.episodeIds);
  const verdicts = (interpretation?.episodeVerdicts ?? []).filter((v) =>
    ids.has(v.episodeId),
  );
  const count = (kind: string): number =>
    verdicts.filter((v) => v.verdict === kind).length;
  const confirmed = count('confirmed');
  const rejected = count('rejected');
  const unclear = count('unclear');
  const episodes = ids.size;
  // Dismissing on a partial review would hide an insight because its few
  // judged episodes looked wrong while most were never looked at.
  const state =
    confirmed > 0
      ? 'confirmed'
      : episodes > 0 && rejected === episodes
        ? 'dismissed'
        : 'unverified';
  return {
    insightId: insight.id,
    state,
    episodes,
    reviewed: verdicts.length,
    confirmed,
    rejected,
    unclear,
  };
}

export function reviewInsights(
  insights: readonly Insight[],
  interpretation: Interpretation | null,
): readonly InsightReview[] {
  return insights.map((insight) => reviewInsight(insight, interpretation));
}
