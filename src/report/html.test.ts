import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { type Insight, type Report } from '../types/index.js';
import { renderHtml } from './html.js';
import { esc } from './html/escape.js';
import {
  makeDaily,
  makeLowDataReport,
  makeRichReport,
} from './html/fixtures.js';

const HOSTILE = [
  '</script><script>alert(1)</script>',
  '"><img src=x onerror=alert(2)>',
  `' onmouseover='alert(3)`,
  '<svg onload=alert(4)>',
  '&lt;already&amp;escaped',
].join(' ');

function hostileReport(): Report {
  const rich = makeRichReport();
  const [first] = rich.insights;
  const [episode] = rich.episodes;
  const [trait] = rich.promptTraits;
  if (!first || !episode || !trait) {
    throw new Error('fixture is incomplete');
  }
  const hostileInsight: Insight = {
    ...first,
    title: HOSTILE,
    finding: HOSTILE,
    evidence: {
      ...first.evidence,
      projects: [HOSTILE],
      examples: [
        {
          project: HOSTILE,
          date: HOSTILE,
          sessionId: 's',
          quote: HOSTILE,
          note: HOSTILE,
        },
      ],
    },
    action: {
      kind: 'claude-md-rule',
      scope: 'user',
      project: HOSTILE,
      file: HOSTILE,
      text: HOSTILE,
    },
  };
  const others: Insight[] = [
    {
      ...first,
      id: 'h2',
      action: {
        kind: 'permission-allow',
        patterns: [HOSTILE],
        file: HOSTILE,
        snippet: HOSTILE,
      },
    },
    {
      ...first,
      id: 'h3',
      action: {
        kind: 'slash-command',
        name: HOSTILE,
        file: HOSTILE,
        content: HOSTILE,
      },
    },
    {
      ...first,
      id: 'h4',
      action: {
        kind: 'prompt-habit',
        habit: HOSTILE,
        before: HOSTILE,
        after: HOSTILE,
      },
    },
    {
      ...first,
      id: 'h5',
      action: { kind: 'workflow', suggestion: HOSTILE, steps: [HOSTILE] },
    },
  ];
  return {
    ...rich,
    generatedAt: HOSTILE,
    generator: { name: 'hyntx', version: HOSTILE },
    filters: { project: HOSTILE },
    dataQuality: {
      ...rich.dataQuality,
      notes: [HOSTILE],
      claudeCodeVersions: [HOSTILE],
      unknownRecordTypes: { [HOSTILE]: 1 },
    },
    metrics: {
      ...rich.metrics,
      overall: {
        ...rich.metrics.overall,
        tools: [
          { name: HOSTILE, calls: 3, errors: 1, denied: 0, errorRate: 0.3 },
        ],
        models: [{ model: HOSTILE, messages: 1, tokens: 1, share: 1 }],
        slashCommands: [{ name: HOSTILE, count: 1 }],
      },
      byProject: [
        { ...rich.metrics.overall, project: HOSTILE },
        { ...rich.metrics.overall, project: 'b' },
      ],
    },
    episodes: [
      {
        ...episode,
        summary: HOSTILE,
        prompt: HOSTILE,
        project: HOSTILE,
        type: HOSTILE as never,
      },
    ],
    promptTraits: [{ ...trait, description: HOSTILE }],
    insights: [hostileInsight, ...others],
    interpretation: {
      engine: HOSTILE,
      model: HOSTILE,
      generatedAt: HOSTILE,
      summary: HOSTILE,
      episodeVerdicts: [
        { episodeId: 'e1', verdict: 'confirmed', note: HOSTILE },
      ],
      recommendations: [{ title: HOSTILE, body: HOSTILE, basedOn: [HOSTILE] }],
    },
  };
}

describe('esc', () => {
  it('escapes html, quotes and backticks', () => {
    expect(esc(`<a href="x">'&\``)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#96;',
    );
    expect(esc(null)).toBe('');
  });
});

describe('renderHtml', () => {
  it('renders a full report with insights before metrics', () => {
    const html = renderHtml(makeRichReport());
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('You repeat scope instructions');
    expect(html).toContain('Only touch files I name');
    expect(html).toContain('data-copy-target');
    expect(html).toContain('Pnpm'.toLowerCase());
    expect(html.indexOf('What to change')).toBeLessThan(
      html.indexOf('>Trends<'),
    );
    expect(html.indexOf('>Trends<')).toBeLessThan(html.indexOf('>Metrics<'));
    expect(html).toContain('prefers-color-scheme:dark');
    expect(html.match(/<svg /g)?.length).toBeGreaterThanOrEqual(7);
    expect(html.match(/role="img"/g)?.length).toBeGreaterThanOrEqual(7);
  });

  it('renders every action kind with copyable content', () => {
    const html = renderHtml(makeRichReport());
    for (const needle of [
      'Add to CLAUDE.md in project',
      'Merge into .claude/settings.json',
      'Create .claude/commands/status.md',
      'Prompt habit:',
      'Workflow: Split long tasks',
      'Fix the null check',
    ]) {
      expect(html).toContain(needle);
    }
  });

  it('is honest about low data: notice, no charts, no insights fabricated', () => {
    const html = renderHtml(makeLowDataReport());
    expect(html).toContain('Not much data yet');
    expect(html).toContain('No findings yet');
    expect(html).toContain('Only 1 day of history');
    expect(html).toContain('too few to chart');
    expect(html).not.toContain('<svg ');
  });

  it('handles two days with a table and no trend charts', () => {
    const report = { ...makeRichReport(), daily: makeDaily(2) };
    expect(renderHtml(report)).toContain('Only 2 days of history');
  });

  it('handles empty daily history', () => {
    const html = renderHtml({ ...makeRichReport(), daily: [] });
    expect(html).toContain('No daily history yet');
  });

  it('handles a long history', () => {
    const html = renderHtml({ ...makeRichReport(), daily: makeDaily(400) });
    expect(html).toContain('<svg ');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('says so when there is no interpretation', () => {
    const html = renderHtml({ ...makeRichReport(), interpretation: null });
    expect(html).toContain('No LLM interpretation');
    expect(html).not.toContain('>Recommendations<');
  });

  it('renders interpretation summary, verdicts and recommendations', () => {
    const html = renderHtml(makeRichReport());
    expect(html).toContain('Most friction comes from unclear scope');
    expect(html).toContain('State scope up front');
    expect(html).toContain('1 confirmed');
    expect(html).toContain('Clear scope drift.');
  });

  it('escapes hostile strings everywhere', () => {
    const html = renderHtml(hostileReport());
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toMatch(/onerror=alert\(2\)>/);
    expect(html).not.toContain(`'' onmouseover`);
    expect(html).toContain('&lt;/script&gt;&lt;script&gt;alert(1)');
    // The only real script element is the static one.
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    // No attribute can be broken out of: every `onxxx=` is inside escaped text.
    const withoutQuotedValues = html.replace(/"[^"]*"/g, '""');
    expect(withoutQuotedValues).not.toMatch(/<[^>]+\son\w+=/);
  });

  it('never loads external resources', () => {
    for (const report of [makeRichReport(), makeLowDataReport()]) {
      const html = renderHtml(report);
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).not.toMatch(/\s(src|href|action|srcset)\s*=/i);
      expect(html).not.toMatch(
        /@import|url\(|<link|<iframe|<img|fetch\(|XMLHttpRequest|WebSocket/,
      );
      expect(html).toContain('default-src &#39;none&#39;');
    }
  });

  it('is deterministic', () => {
    const report = makeRichReport();
    expect(renderHtml(report)).toBe(renderHtml(report));
  });

  it('does not blow up on non-finite numbers', () => {
    const rich = makeRichReport();
    const daily = rich.daily.map((d) => ({ ...d, typedPrompts: Number.NaN }));
    const html = renderHtml({ ...rich, daily });
    expect(html).not.toContain('NaN"');
    expect(html).not.toMatch(/(?:x|y|cx|cy|width|height)="NaN/);
  });

  it('writes samples when HYNTX_HTML_SAMPLE_DIR is set', () => {
    const dir = process.env['HYNTX_HTML_SAMPLE_DIR'];
    if (!dir) {
      return;
    }
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'rich.html'), renderHtml(makeRichReport()));
    writeFileSync(join(dir, 'low-data.html'), renderHtml(makeLowDataReport()));
  });
});
