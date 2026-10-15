/**
 * Applies interpretation verdicts to insights. The single source of truth for
 * which insights are confirmed, dismissed or unverified: every renderer and
 * the JSON report use this.
 */

import {
  type Episode,
  EpisodeType,
  type Insight,
  type InsightReview,
  type Interpretation,
} from '../types/index.js';

/** Episodes whose label is a heuristic guess the model can confirm or reject. */
export function needsVerdict(episode: Episode): boolean {
  switch (episode.type) {
    case EpisodeType.CORRECTION:
    case EpisodeType.REPEATED_INSTRUCTION:
    case EpisodeType.REWORK:
    case EpisodeType.TOOL_ERROR_LOOP:
      return true;
    case EpisodeType.CONTEXT_PRESSURE:
      return episode.confidence < 0.8;
    default:
      return false;
  }
}

export function reviewInsight(
  insight: Insight,
  interpretation: Interpretation | null,
  episodeList: readonly Episode[] = [],
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
  // An insight made only of counted facts (denials, model switches,
  // interruptions) has nothing for a model to judge, so "unverified" would
  // wrongly suggest doubt. Unknown episodes are not assumed to be facts.
  const byId = new Map(episodeList.map((e) => [e.id, e]));
  const isCountedFact =
    episodes > 0 &&
    insight.episodeIds.every((id) => {
      const episode = byId.get(id);
      return episode !== undefined && !needsVerdict(episode);
    });
  const state =
    confirmed > 0
      ? 'confirmed'
      : episodes > 0 && rejected === episodes
        ? 'dismissed'
        : isCountedFact
          ? 'not-needed'
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
  episodes: readonly Episode[] = [],
): readonly InsightReview[] {
  return insights.map((insight) =>
    reviewInsight(insight, interpretation, episodes),
  );
}
