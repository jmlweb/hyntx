/**
 * Terminal renderer: compact and scannable. Headline numbers, top insights
 * with evidence and an apply-ready action, then a short metrics summary.
 */

import chalk, { Chalk, type ChalkInstance } from 'chalk';

import { type Insight, type Report } from '../types/index.js';
import {
  describeAction,
  formatMinutes,
  formatNumber,
  formatPercent,
  formatTokens,
  periodLabel,
} from './shared.js';

export type TerminalOptions = {
  readonly color?: boolean;
  readonly maxInsights?: number;
};

const DEFAULT_MAX_INSIGHTS = 5;

export function renderTerminal(
  report: Report,
  options: TerminalOptions = {},
): string {
  const c = new Chalk({ level: options.color === false ? 0 : chalk.level });
  const severityColor = {
    high: c.red.bold,
    medium: c.yellow.bold,
    low: c.blue.bold,
  } as const;
  const { overall } = report.metrics;
  const lines: string[] = [];
  const push = (...rows: string[]): void => {
    lines.push(...rows);
  };

  push(c.bold('hyntx') + c.dim(`  ${periodLabel(report)}`), '');
  push(
    `${c.bold(formatNumber(overall.sessions))} sessions  ` +
      `${c.bold(formatNumber(overall.typedPrompts))} typed prompts  ` +
      `${c.bold(formatNumber(overall.toolCalls))} tool calls ` +
      c.dim(`(${formatPercent(overall.toolErrorRate, 1)} errors)`),
    `${c.bold(formatTokens(overall.tokens.total))} tokens ` +
      c.dim(
        `(${formatPercent(overall.tokens.cacheHitRatio)} cache hits, ${formatTokens(overall.tokens.output)} output)  `,
      ) +
      `${c.bold(String(overall.interruptions))} interruptions  ` +
      `${c.bold(String(overall.compactions))} compactions`,
    '',
  );

  const max = options.maxInsights ?? DEFAULT_MAX_INSIGHTS;
  if (report.insights.length === 0) {
    push(
      c.bold('Insights'),
      report.dataQuality.enoughData
        ? '  No recurring friction found in this period.'
        : '  Not enough data for findings yet.',
      '',
    );
  } else {
    push(
      c.bold(
        `Top insights (${String(Math.min(max, report.insights.length))} of ${String(report.insights.length)})`,
      ),
      '',
    );
    report.insights.slice(0, max).forEach((insight, i) => {
      push(...renderInsight(insight, i + 1, c, severityColor));
    });
  }

  push(c.bold('Metrics'));
  const projects = report.metrics.byProject
    .slice(0, 4)
    .map((p) => `${p.project} ${String(p.typedPrompts)}`)
    .join(', ');
  const tools = overall.tools
    .slice(0, 5)
    .map(
      (t) =>
        `${t.name} ${String(t.calls)}${t.errors > 0 ? c.dim(` (${String(t.errors)} err)`) : ''}`,
    )
    .join(', ');
  const models = overall.models
    .slice(0, 3)
    .map((m) => `${m.model} ${formatPercent(m.share)}`)
    .join(', ');
  const rows: readonly (readonly [string, string])[] = [
    ['Projects', projects || '-'],
    ['Tools', tools || '-'],
    ['Models', models || '-'],
    [
      'Sessions',
      `median ${formatMinutes(overall.sessionMinutes.median)}, p90 ${formatMinutes(overall.sessionMinutes.p90)}, ` +
        `${String(overall.sessionTurns.median)} turns median`,
    ],
    [
      'Agents',
      `${String(overall.subagents.invocations)} subagent calls in ${String(overall.subagents.sessionsUsing)} sessions; ` +
        `plan mode in ${String(overall.planMode.sessionsUsing)} sessions`,
    ],
    [
      'Commands',
      overall.slashCommands
        .slice(0, 4)
        .map((s) => `/${s.name} ${String(s.count)}`)
        .join(', ') || '-',
    ],
  ];
  for (const [label, value] of rows) {
    push(`  ${c.dim(label.padEnd(9))}${value}`);
  }

  const notes = report.dataQuality.notes;
  if (notes.length > 0) {
    push('', c.bold('Notes'), ...notes.map((n) => c.dim(`  - ${n}`)));
  }
  return `${lines.join('\n')}\n`;
}

function renderInsight(
  insight: Insight,
  position: number,
  c: ChalkInstance,
  severityColor: Record<Insight['severity'], (text: string) => string>,
): string[] {
  const out: string[] = [];
  out.push(
    `${c.dim(`${String(position)}.`)} ${severityColor[insight.severity](`[${insight.severity.toUpperCase()}]`)} ${c.bold(insight.title)}`,
    `   ${insight.finding}`,
  );
  const evidence = insight.evidence;
  const example = evidence.examples[0];
  const scope =
    evidence.sessions > 0
      ? `${String(evidence.count)} in ${String(evidence.sessions)} session(s)`
      : `n=${String(evidence.count)}`;
  out.push(
    c.dim(
      `   evidence: ${scope}` +
        (example
          ? `; e.g. "${example.quote}" (${example.project}, ${example.date})`
          : ''),
    ),
  );
  const action = describeAction(insight.action);
  out.push(`   ${c.green('do:')} ${action.label}`);
  for (const line of [...action.lines, ...action.verbatim]) {
    out.push(c.cyan(`      ${line}`));
  }
  out.push('');
  return out;
}
