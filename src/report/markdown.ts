/**
 * Markdown renderer: the full report, suited for sharing or committing.
 */

import { type Report } from '../types/index.js';
import {
  describeAction,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatTokens,
  periodLabel,
} from './shared.js';

function fence(lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : ['```', ...lines, '```'];
}

function escapeCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderMarkdown(report: Report): string {
  const { overall } = report.metrics;
  const out: string[] = [
    '# Hyntx report',
    '',
    `_${periodLabel(report)} - generated ${report.generatedAt}_`,
    '',
    '## Summary',
    '',
    `- **${formatNumber(overall.sessions)}** sessions, **${formatNumber(overall.typedPrompts)}** typed prompts, **${formatNumber(overall.turns)}** turns`,
    `- **${formatNumber(overall.toolCalls)}** tool calls, ${formatPercent(overall.toolErrorRate, 1)} errors, ${formatNumber(overall.toolDenied)} denied`,
    `- **${formatTokens(overall.tokens.total)}** tokens (${formatTokens(overall.tokens.output)} output, ${formatPercent(overall.tokens.cacheHitRatio)} cache hit ratio)`,
    `- ${String(overall.interruptions)} interruptions, ${String(overall.compactions)} compactions, ${String(overall.subagents.invocations)} subagent calls`,
    '',
    '## Insights',
    '',
  ];

  if (report.insights.length === 0) {
    out.push(
      report.dataQuality.enoughData
        ? 'No recurring friction found in this period.'
        : 'Not enough data for findings yet.',
      '',
    );
  }
  report.insights.forEach((insight, i) => {
    const action = describeAction(insight.action);
    out.push(
      `### ${String(i + 1)}. ${insight.title} (${insight.severity})`,
      '',
      insight.finding,
      '',
      `**Evidence:** ${String(insight.evidence.count)}${insight.evidence.outOf ? ` of ${String(insight.evidence.outOf)}` : ''}` +
        (insight.evidence.sessions > 0
          ? ` in ${String(insight.evidence.sessions)} session(s)`
          : ''),
      '',
      ...insight.evidence.examples.map(
        (e) =>
          `- "${e.quote}" - ${e.project}, ${e.date}${e.note ? ` (${e.note})` : ''}`,
      ),
      '',
      `**Action:** ${action.label}`,
      '',
      ...action.lines.map((line) => line),
      ...fence(action.verbatim),
      '',
    );
  });

  out.push(
    '## Metrics',
    '',
    '| Project | Sessions | Typed prompts | Tool calls | Tokens |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...report.metrics.byProject.map(
      (p) =>
        `| ${escapeCell(p.project)} | ${String(p.sessions)} | ${String(p.typedPrompts)} | ${String(p.toolCalls)} | ${formatTokens(p.tokens.total)} |`,
    ),
    '',
    '| Tool | Calls | Errors | Denied |',
    '| --- | ---: | ---: | ---: |',
    ...overall.tools
      .slice(0, 10)
      .map(
        (t) =>
          `| ${escapeCell(t.name)} | ${String(t.calls)} | ${String(t.errors)} | ${String(t.denied)} |`,
      ),
    '',
    `Models: ${overall.models.map((m) => `${m.model} ${formatPercent(m.share)}`).join(', ') || '-'}`,
    '',
    `Session length: median ${formatMinutes(overall.sessionMinutes.median)}, p90 ${formatMinutes(overall.sessionMinutes.p90)}; ${String(overall.sessionTurns.median)} turns median.`,
    '',
    '## Daily trend',
    '',
    '| Date | Sessions | Prompts | Tool errors | Interruptions | Corrections | Tokens |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...report.daily.map(
      (d) =>
        `| ${d.date} | ${String(d.sessions)} | ${String(d.typedPrompts)} | ${String(d.toolErrors)} | ${String(d.interruptions)} | ${String(d.corrections)} | ${formatTokens(d.tokens.input + d.tokens.output + d.tokens.cacheRead + d.tokens.cacheCreation)} |`,
    ),
    '',
  );

  if (report.interpretation) {
    out.push('## Interpretation', '', report.interpretation.summary, '');
  }
  out.push(
    '## Data quality',
    '',
    `Files read: ${String(report.dataQuality.filesRead)} (${String(report.dataQuality.subagentFilesRead)} subagent), records: ${formatNumber(report.dataQuality.recordsRead)}, skipped: ${String(report.dataQuality.recordsSkipped)}.`,
    '',
    ...report.dataQuality.notes.map((n) => `- ${n}`),
    '',
  );
  return out.join('\n');
}
