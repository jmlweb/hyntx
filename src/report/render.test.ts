import { describe, expect, it } from 'vitest';

import { buildReport } from '../core/report.js';
import { at, makeCall, makeSession, makeTurn } from '../core/test-helpers.js';
import { type Report } from '../types/index.js';
import { renderHtml } from './html.js';
import { renderMarkdown } from './markdown.js';
import { formatMinutes, formatTokens } from './shared.js';
import { renderTerminal } from './terminal.js';

const err = (command: string): ReturnType<typeof makeCall> =>
  makeCall('Bash', {
    command,
    error: true,
    text: 'Exit code 1\nconnection refused',
  });

function reportWithInsights(): Report {
  const sessions = [1, 2, 3].map((d) =>
    makeSession([
      makeTurn(0, 'refactor the billing module', {
        ts: at(d),
        calls: [err('make'), err('make test'), err('make lint')],
        interruptions: [{ timestamp: at(d, 2), duringToolUse: true }],
      }),
      makeTurn(1, 'only touch the invoice helpers', { ts: at(d, 5) }),
    ]),
  );
  return buildReport({
    sessions,
    stats: {
      filesRead: 3,
      subagentFilesRead: 0,
      recordsRead: 30,
      recordsSkipped: 0,
      unknownRecordTypes: {},
      duplicateRecords: 0,
      orphanToolResults: 0,
      claudeCodeVersions: ['2.1.278'],
      filesFailed: 0,
      failedFiles: [],
      emptySessions: 0,
    },
    from: new Date(2026, 8, 1),
    to: new Date(2026, 8, 7),
    project: null,
    version: '4.0.0',
  });
}

describe('renderTerminal', () => {
  it('shows headline numbers, top insights with evidence and action, then metrics', () => {
    const output = renderTerminal(reportWithInsights(), { color: false });
    expect(output).toContain('3 sessions');
    expect(output).toContain('6 typed prompts');
    expect(output).toContain('Top insights');
    expect(output).toContain('evidence:');
    expect(output).toContain('do:');
    expect(output).toContain('Metrics');
    expect(output.indexOf('Top insights')).toBeLessThan(
      output.indexOf('Metrics'),
    );

    expect(output).not.toMatch(/\u001b\[/);
  });

  it('limits the number of insights shown', () => {
    const output = renderTerminal(reportWithInsights(), {
      color: false,
      maxInsights: 1,
    });
    expect(output).toMatch(/Top insights \(1 of \d+\)/);
  });

  it('is honest when there is not enough data', () => {
    const report = buildReport({
      sessions: [makeSession([makeTurn(0, 'hi')])],
      stats: {
        filesRead: 1,
        subagentFilesRead: 0,
        recordsRead: 1,
        recordsSkipped: 0,
        unknownRecordTypes: {},
        duplicateRecords: 0,
        orphanToolResults: 0,
        claudeCodeVersions: [],
        filesFailed: 0,
        failedFiles: [],
        emptySessions: 0,
      },
      from: new Date(2026, 8, 1),
      to: new Date(2026, 8, 7),
      project: null,
      version: '4.0.0',
    });
    const output = renderTerminal(report, { color: false });
    expect(output).toContain('Not enough data');
  });
});

describe('renderMarkdown', () => {
  it('renders all sections', () => {
    const output = renderMarkdown(reportWithInsights());
    for (const heading of [
      '# Hyntx report',
      '## Summary',
      '## Insights',
      '## Metrics',
      '## Daily trend',
      '## Data quality',
    ]) {
      expect(output).toContain(heading);
    }
    expect(output).toContain('**Action:**');
    expect(output).toContain('| 2026-09-01 |');
  });
});

describe('renderHtml (phase 2 stub)', () => {
  it('returns a valid html document', () => {
    const html = renderHtml(reportWithInsights());
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
});

describe('formatters', () => {
  it('formats tokens and minutes compactly', () => {
    expect(formatTokens(950)).toBe('950');
    expect(formatTokens(12_500)).toBe('12.5k');
    expect(formatTokens(78_100_000)).toBe('78.1M');
    expect(formatMinutes(30)).toBe('30m');
    expect(formatMinutes(120)).toBe('2.0h');
  });
});

describe('action blocks and wording', () => {
  const withRule = (text: string): Report => {
    const base = reportWithInsights();
    const insight = base.insights[0];
    if (!insight) {
      throw new Error('fixture changed');
    }
    return {
      ...base,
      insights: [
        {
          ...insight,
          action: {
            kind: 'claude-md-rule',
            scope: 'user',
            project: null,
            file: '~/.claude/CLAUDE.md',
            text,
          },
        },
      ],
    };
  };

  it('markdown fences are longer than any backtick run inside the content', () => {
    const out = renderMarkdown(withRule('- Wrap code in ```ts fences```'));
    expect(out).toContain('````\n- Wrap code in ```ts fences```\n````');
    const plain = renderMarkdown(withRule('- plain rule'));
    expect(plain).toContain('```\n- plain rule\n```');
  });

  it('uses proper plurals instead of (s) suffixes', () => {
    const base = reportWithInsights();
    const one: Report = {
      ...base,
      metrics: {
        ...base.metrics,
        overall: {
          ...base.metrics.overall,
          sessions: 1,
          typedPrompts: 1,
          toolCalls: 1,
          interruptions: 1,
          compactions: 1,
        },
      },
    };
    const out = renderTerminal(one, { color: false });
    expect(out).toContain('1 session ');
    expect(out).toContain('1 typed prompt ');
    expect(out).toContain('1 tool call ');
    expect(out).not.toMatch(/\(s\)/);
    expect(renderTerminal(reportWithInsights(), { color: false })).not.toMatch(
      /\w\(s\)/,
    );
    expect(renderMarkdown(reportWithInsights())).not.toMatch(/\w\(s\)/);
  });

  it('strips nothing readable but never emits raw escape sequences', () => {
    const esc = String.fromCharCode(27);
    expect(
      renderTerminal(reportWithInsights(), { color: false }),
    ).not.toContain(esc);
  });
});
