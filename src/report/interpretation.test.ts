import { describe, expect, it } from 'vitest';

import {
  EPISODE_ID,
  fixtureReport,
  GOOD_ANSWER,
} from '../engines/test-fixtures.js';
import { type Report } from '../types/index.js';
import { judgeInsights } from './interpretation.js';
import { renderMarkdown } from './markdown.js';
import { renderTerminal } from './terminal.js';

function withVerdict(verdict: 'confirmed' | 'rejected' | 'unclear'): Report {
  return {
    ...fixtureReport(),
    interpretation: {
      engine: 'claude',
      model: null,
      generatedAt: '2026-09-07T00:00:00.000Z',
      summary: GOOD_ANSWER.summary,
      episodeVerdicts: [
        {
          episodeId: EPISODE_ID,
          verdict,
          note: 'You said "only the invoice helpers".',
        },
      ],
      recommendations: GOOD_ANSWER.recommendations,
    },
  };
}

describe('judgeInsights', () => {
  it('confirms, dismisses or leaves insights unverified', () => {
    expect(judgeInsights(withVerdict('confirmed')).kept[0]?.state).toBe(
      'confirmed',
    );
    expect(judgeInsights(withVerdict('unclear')).kept[0]?.state).toBe(
      'unverified',
    );
    const rejected = judgeInsights(withVerdict('rejected'));
    expect(rejected.kept).toHaveLength(0);
    expect(rejected.dismissed).toHaveLength(1);
    expect(judgeInsights(fixtureReport()).kept[0]?.state).toBe('unverified');
  });
});

describe('renderers with an interpretation', () => {
  it('terminal shows summary, recommendations and the confirmed marker', () => {
    const out = renderTerminal(withVerdict('confirmed'), { color: false });
    expect(out).toContain('Interpretation (claude)');
    expect(out).toContain('Scope refactors up front');
    expect(out).toContain('[confirmed]');
    expect(out).toContain('confirmed: You said');
  });

  it('terminal demotes insights whose episodes were all rejected, with the reason', () => {
    const out = renderTerminal(withVerdict('rejected'), { color: false });
    expect(out).toContain('Dismissed by the interpretation (1)');
    expect(out).not.toContain('[MEDIUM]');
  });

  it('markdown has interpretation, recommendations, verdicts and dismissed sections', () => {
    const confirmed = renderMarkdown(withVerdict('confirmed'));
    expect(confirmed).toContain('## Interpretation (claude)');
    expect(confirmed).toContain('### Recommendations');
    expect(confirmed).toContain('### Episode verdicts');
    expect(confirmed).toContain('- confirmed');
    const rejected = renderMarkdown(withVerdict('rejected'));
    expect(rejected).toContain('## Dismissed by the interpretation');
  });
});
