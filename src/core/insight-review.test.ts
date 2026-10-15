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

  it('does not assume unknown episodes are facts', () => {
    expect(reviewInsight(insight, null, []).state).toBe('unverified');
  });
});
