import { describe, expect, it } from 'vitest';

import { fixtureReport } from '../engines/test-fixtures.js';
import { EpisodeType } from '../types/index.js';
import { reviewInsight } from './insight-review.js';

describe('reviewInsight', () => {
  const report = fixtureReport();
  const [insight] = report.insights;
  const [episode] = report.episodes;
  if (!insight || !episode) {
    throw new Error('fixture has an insight and an episode');
  }

  it('leaves an insight with a heuristic episode unverified without verdicts', () => {
    expect(reviewInsight(insight, null, report.episodes).state).toBe(
      'unverified',
    );
  });

  it('marks an insight made only of counted facts as not needing review', () => {
    const fact = { ...episode, type: EpisodeType.TOOL_DENIED };
    expect(reviewInsight(insight, null, [fact]).state).toBe('not-needed');
  });

  it('aggregates the causes of confirmed corrections, and has none without an engine', () => {
    expect(reviewInsight(insight, null, report.episodes)).not.toHaveProperty(
      'causes',
    );
    const interpretation = {
      engine: 'claude',
      model: null,
      generatedAt: '2026-10-03T10:00:00.000Z',
      summary: 'x',
      episodeVerdicts: [
        {
          episodeId: episode.id,
          verdict: 'confirmed' as const,
          note: 'n',
          cause: 'wrong-approach' as const,
        },
      ],
      recommendations: [],
    };
    expect(
      reviewInsight(insight, interpretation, report.episodes).causes,
    ).toEqual({ 'wrong-approach': 1 });
  });

  it('does not assume unknown episodes are facts', () => {
    expect(reviewInsight(insight, null, []).state).toBe('unverified');
  });
});
