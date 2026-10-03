import { describe, expect, it } from 'vitest';

import { reviewInsights } from '../core/insight-review.js';
import {
  EPISODE_ID,
  fixtureReport,
  GOOD_ANSWER,
} from '../engines/test-fixtures.js';
import { type InsightReview, type Report } from '../types/index.js';
import { renderHtml } from './html.js';
import { describeCoverage, judgeInsights } from './interpretation.js';
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

function firstReview(
  kept: ReturnType<typeof judgeInsights>['kept'],
): InsightReview {
  const review = kept[0]?.review;
  if (!review) {
    throw new Error('no insight kept');
  }
  return review;
}

describe('coverage of verdicts', () => {
  function withEpisodes(
    verdicts: readonly ('confirmed' | 'rejected' | 'unclear')[],
    total: number,
  ): Report {
    const base = withVerdict('rejected');
    const insight = base.insights[0];
    if (!insight || !base.interpretation) {
      throw new Error('fixture changed');
    }
    const ids = Array.from({ length: total }, (_, i) =>
      i === 0 ? EPISODE_ID : `extra-${String(i)}`,
    );
    return {
      ...base,
      insights: [{ ...insight, episodeIds: ids }],
      interpretation: {
        ...base.interpretation,
        episodeVerdicts: verdicts.map((verdict, i) => ({
          episodeId: ids[i] ?? EPISODE_ID,
          verdict,
          note: 'You said "only the invoice helpers".',
        })),
      },
    };
  }

  it('does not dismiss an insight whose episodes were mostly never judged', () => {
    const report = withEpisodes(['rejected'], 5);
    const { kept, dismissed } = judgeInsights(report);
    expect(dismissed).toHaveLength(0);
    expect(kept[0]?.state).toBe('unverified');
    expect(describeCoverage(firstReview(kept))).toBe(
      'LLM reviewed 1 of 5 episodes: 1 rejected; 4 not reviewed',
    );
  });

  it('dismisses only when every episode was reviewed and rejected', () => {
    expect(
      judgeInsights(withEpisodes(['rejected', 'rejected'], 2)).dismissed,
    ).toHaveLength(1);
    expect(
      judgeInsights(withEpisodes(['rejected', 'unclear'], 2)).dismissed,
    ).toHaveLength(0);
  });

  it('keeps a confirmed insight and says how much of it was reviewed', () => {
    const report = withEpisodes(['confirmed', 'rejected'], 6);
    const out = renderTerminal(report, { color: false });
    expect(out).toContain('[confirmed]');
    expect(out).toContain(
      'LLM reviewed 2 of 6 episodes: 1 confirmed, 1 rejected; 4 not reviewed',
    );
    expect(renderMarkdown(report)).toContain('LLM reviewed 2 of 6 episodes');
    expect(renderHtml(report)).toContain('LLM reviewed 2 of 6 episodes');
  });

  it('exposes the same state in the report for JSON and plugin consumers', () => {
    const report = withEpisodes(['rejected', 'rejected'], 2);
    const reviews = reviewInsights(report.insights, report.interpretation);
    expect(reviews[0]).toMatchObject({
      state: 'dismissed',
      episodes: 2,
      reviewed: 2,
      rejected: 2,
    });
  });
});

describe('every renderer agrees on dismissed insights', () => {
  it('hides a dismissed insight in terminal, markdown and HTML, and lists it as dismissed', () => {
    const report = withVerdict('rejected');
    const title = report.insights[0]?.title ?? '';
    expect(title).not.toBe('');
    const html = renderHtml(report);
    const start = html.indexOf('id="h-insights"');
    const body = html.slice(start, html.indexOf('</section>', start));
    expect(body).toContain('Dismissed by the interpretation (1)');
    expect(body).not.toContain('class="card"');
    expect(renderTerminal(report, { color: false })).not.toContain('[MEDIUM]');
    expect(renderMarkdown(report)).not.toMatch(/### 1\./);
  });
});
