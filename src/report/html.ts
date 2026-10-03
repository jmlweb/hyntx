/**
 * Self-contained HTML report: inline CSS/JS/SVG, no network access.
 * Every report string is untrusted log text and goes through `esc`.
 */

import {
  type DailyPoint,
  type Episode,
  type Insight,
  type InsightAction,
  type Report,
} from '../types/index.js';
import { CSS, JS } from './html/assets.js';
import {
  type ChartFrame,
  renderCategoryChart,
  renderTimeChart,
} from './html/charts.js';
import { esc, round, safeNumber } from './html/escape.js';
import {
  formatMinutes,
  formatNumber,
  formatPercent,
  formatTokens,
} from './shared.js';

/** Below this many typed prompts, hour/weekday charts would be noise. */
const MIN_PROMPTS_FOR_HABIT_CHARTS = 20;
const MIN_DAYS_FOR_TRENDS = 3;
/** A day with fewer tool calls has a meaningless error rate. */
const MIN_CALLS_FOR_RATE = 5;
const MAX_EPISODES_SHOWN = 40;
const MAX_TOOLS_SHOWN = 12;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const EPISODE_LABELS: Readonly<Record<string, string>> = {
  interruption: 'Interruption',
  correction: 'Correction',
  'tool-error-loop': 'Tool error loop',
  'tool-denied': 'Tool denied',
  rework: 'Rework',
  'context-pressure': 'Context pressure',
  'repeated-instruction': 'Repeated instruction',
  'frequent-readonly-command': 'Frequent read-only command',
};

type Ids = () => string;

function createIds(): Ids {
  let next = 0;
  return () => {
    next += 1;
    return `c${String(next)}`;
  };
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}

function section(id: string, heading: string, body: string): string {
  return `<section aria-labelledby="h-${id}">
<h2 id="h-${id}">${esc(heading)}</h2>
${body}
</section>`;
}

function copyBlock(
  ids: Ids,
  label: string,
  text: string,
  copyLabel: string,
): string {
  const id = ids();
  return `<div class="action">
<div class="label"><span>${esc(label)}</span><button type="button" class="copy" data-copy-target="${id}" aria-label="${esc(`Copy: ${copyLabel}`)}">Copy</button></div>
<pre id="${id}">${esc(text)}</pre>
</div>`;
}

function renderAction(action: InsightAction, ids: Ids): string {
  switch (action.kind) {
    case 'claude-md-rule':
      return copyBlock(
        ids,
        action.scope === 'project'
          ? `Add to ${action.file} in project "${action.project ?? '?'}"`
          : `Add to ${action.file} (all projects)`,
        action.text,
        'CLAUDE.md rule',
      );
    case 'permission-allow':
      return copyBlock(
        ids,
        `Merge into ${action.file}`,
        action.snippet,
        'settings.json snippet',
      );
    case 'slash-command':
      return copyBlock(
        ids,
        `Create ${action.file}${action.name}.md`,
        action.content.trimEnd(),
        `slash command /${action.name}`,
      );
    case 'prompt-habit': {
      const beforeId = ids();
      const afterId = ids();
      const pair =
        action.before !== null || action.after !== null
          ? `<div class="ba">
${action.before !== null ? `<div><div class="tag">Before</div><pre id="${beforeId}">${esc(action.before)}</pre></div>` : ''}
${action.after !== null ? `<div><div class="tag">After <button type="button" class="copy" data-copy-target="${afterId}" aria-label="Copy: improved prompt">Copy</button></div><pre id="${afterId}">${esc(action.after)}</pre></div>` : ''}
</div>`
          : '';
      return `<div class="action"><div class="label"><span>Prompt habit: ${esc(action.habit)}</span></div>${pair}</div>`;
    }
    case 'workflow': {
      const id = ids();
      const text = [
        action.suggestion,
        ...action.steps.map((step, i) => `${String(i + 1)}. ${step}`),
      ].join('\n');
      return `<div class="action">
<div class="label"><span>Workflow: ${esc(action.suggestion)}</span><button type="button" class="copy" data-copy-target="${id}" aria-label="Copy: workflow steps">Copy</button></div>
${action.steps.length > 0 ? `<ol class="steps">${action.steps.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>` : ''}
<pre id="${id}" class="sr-only">${esc(text)}</pre>
</div>`;
    }
  }
}

function verdictCounts(
  report: Report,
  insight: Insight,
): { confirmed: number; rejected: number; unclear: number } {
  const ids = new Set(insight.episodeIds);
  const counts = { confirmed: 0, rejected: 0, unclear: 0 };
  for (const verdict of report.interpretation?.episodeVerdicts ?? []) {
    if (ids.has(verdict.episodeId)) {
      counts[verdict.verdict] += 1;
    }
  }
  return counts;
}

function renderInsight(report: Report, insight: Insight, ids: Ids): string {
  const { evidence } = insight;
  const facts = [
    plural(evidence.count, 'occurrence'),
    plural(evidence.sessions, 'session'),
    evidence.outOf !== null ? `out of ${formatNumber(evidence.outOf)}` : null,
    evidence.projects.length > 0 ? evidence.projects.join(', ') : null,
    `confidence ${formatPercent(insight.confidence)}`,
  ].filter((fact): fact is string => fact !== null);

  const verdicts = verdictCounts(report, insight);
  const verdictHtml =
    verdicts.confirmed + verdicts.rejected + verdicts.unclear > 0
      ? `<p class="facts">LLM review: ${[
          verdicts.confirmed > 0
            ? `${String(verdicts.confirmed)} confirmed`
            : null,
          verdicts.rejected > 0
            ? `${String(verdicts.rejected)} rejected`
            : null,
          verdicts.unclear > 0 ? `${String(verdicts.unclear)} unclear` : null,
        ]
          .filter((part): part is string => part !== null)
          .join(', ')}</p>`
      : '';

  const examples =
    evidence.examples.length > 0
      ? `<details><summary>Evidence (${plural(evidence.examples.length, 'example')})</summary>${evidence.examples
          .map(
            (example) =>
              `<blockquote>${esc(example.quote)}<span class="src">${esc(example.project)} - ${esc(example.date)}${example.note ? ` - ${esc(example.note)}` : ''}</span></blockquote>`,
          )
          .join('')}</details>`
      : '';

  return `<article class="card">
<header><span class="badge ${esc(insight.severity)}">${esc(insight.severity)}</span><h3>${esc(insight.title)}</h3></header>
<p class="finding">${esc(insight.finding)}</p>
<p class="facts">${facts.map(esc).join(' &middot; ')}</p>
${verdictHtml}
${renderAction(insight.action, ids)}
${examples}
</article>`;
}

function renderHeader(report: Report): string {
  const { overall } = report.metrics;
  const scope = report.filters.project ?? 'all projects';
  const tiles: readonly (readonly [string, string])[] = [
    [formatNumber(overall.sessions), 'sessions'],
    [formatNumber(overall.typedPrompts), 'typed prompts'],
    [formatNumber(overall.toolCalls), 'tool calls'],
    [formatPercent(overall.toolErrorRate, 1), 'tool error rate'],
    [formatTokens(overall.tokens.total), 'tokens'],
    [formatPercent(overall.tokens.cacheHitRatio), 'cache hit'],
    [formatMinutes(overall.sessionMinutes.median), 'median active session'],
    [formatNumber(overall.interruptions), 'interruptions'],
  ];
  return `<header class="top">
<h1>Hyntx report</h1>
<div class="meta">${esc(report.period.from)} to ${esc(report.period.to)} (${esc(plural(report.period.days, 'day'))}) &middot; ${esc(scope)} &middot; generated ${esc(report.generatedAt)}</div>
<ul class="tiles">${tiles
    .map(
      ([value, label]) =>
        `<li class="tile"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div></li>`,
    )
    .join('')}</ul>
</header>`;
}

function renderQualityNotice(report: Report): string {
  const { dataQuality } = report;
  if (dataQuality.enoughData) {
    return '';
  }
  return `<div class="notice" role="note"><strong>Not much data yet.</strong> ${esc(plural(dataQuality.sessionsInPeriod, 'session'))} and ${esc(plural(dataQuality.typedPrompts, 'typed prompt'))} in this period. Treat findings as hints, not conclusions, and expect trends to firm up as history builds.</div>`;
}

function renderInterpretationSummary(report: Report): string {
  const { interpretation } = report;
  if (interpretation === null) {
    return '<p class="muted small">No LLM interpretation in this report: findings below come from heuristics only and are not confirmed.</p>';
  }
  const by = [interpretation.engine, interpretation.model]
    .filter((part): part is string => part !== null)
    .join(' / ');
  return `<div class="summary"><p>${esc(interpretation.summary)}</p><p class="muted small">Interpretation by ${esc(by)} &middot; ${esc(interpretation.generatedAt)}</p></div>`;
}

function renderRecommendations(report: Report): string {
  const recommendations = report.interpretation?.recommendations ?? [];
  if (recommendations.length === 0) {
    return '';
  }
  return section(
    'recommendations',
    'Recommendations',
    recommendations
      .map(
        (rec) =>
          `<article class="card"><h3>${esc(rec.title)}</h3><p class="finding">${esc(rec.body)}</p>${rec.basedOn.length > 0 ? `<p class="facts">Based on: ${esc(rec.basedOn.join(', '))}</p>` : ''}</article>`,
      )
      .join(''),
  );
}

function renderInsights(report: Report, ids: Ids): string {
  const body =
    report.insights.length === 0
      ? `<p class="empty">${report.dataQuality.enoughData ? 'No actionable friction found in this period. Nothing to change.' : 'No findings yet. There is not enough data to say anything reliable.'}</p>`
      : report.insights
          .map((insight) => renderInsight(report, insight, ids))
          .join('');
  return section(
    'insights',
    `What to change${report.insights.length > 0 ? ` (${String(report.insights.length)})` : ''}`,
    `${renderInterpretationSummary(report)}${body}`,
  );
}

const count = (value: number): string => formatNumber(value);

function trendSeries(daily: readonly DailyPoint[]): string {
  const dates = daily.map((d) => d.date);
  const charts: readonly string[] = [
    renderTimeChart({
      kind: 'bars',
      dates,
      chart: describeChart(
        dates,
        'prompts',
        'Typed prompts per day',
        'prompts',
        daily.map((d) => d.typedPrompts),
        count,
      ),
      series: [
        {
          name: 'Typed prompts',
          tone: 1,
          values: daily.map((d) => d.typedPrompts),
        },
      ],
    }),
    renderTimeChart({
      kind: 'bars',
      dates,
      chart: describeChart(
        dates,
        'tokens',
        'Tokens per day (input, output, cache writes; cache reads excluded)',
        'tokens',
        daily.map(
          (d) => d.tokens.input + d.tokens.output + d.tokens.cacheCreation,
        ),
        formatTokens,
      ),
      series: [
        {
          name: 'Tokens',
          tone: 3,
          values: daily.map(
            (d) => d.tokens.input + d.tokens.output + d.tokens.cacheCreation,
          ),
        },
      ],
    }),
    renderTimeChart({
      kind: 'line',
      dates,
      chart: describeChart(
        dates,
        'errors',
        `Tool error rate per day (days with under ${String(MIN_CALLS_FOR_RATE)} calls omitted)`,
        'error rate',
        daily.map((d) =>
          d.toolCalls >= MIN_CALLS_FOR_RATE
            ? (d.toolErrors / d.toolCalls) * 100
            : null,
        ),
        (v) => `${String(round(v, 1))}%`,
      ),
      series: [
        {
          name: 'Error rate',
          tone: 2,
          values: daily.map((d) =>
            d.toolCalls >= MIN_CALLS_FOR_RATE
              ? (d.toolErrors / d.toolCalls) * 100
              : null,
          ),
        },
      ],
    }),
    renderTimeChart({
      kind: 'bars',
      dates,
      chart: describeChart(
        dates,
        'friction',
        'Friction events per day',
        'events',
        daily.map((d) => d.corrections + d.interruptions + d.toolDenied),
        count,
      ),
      series: [
        {
          name: 'Corrections',
          tone: 2,
          values: daily.map((d) => d.corrections),
        },
        {
          name: 'Interruptions',
          tone: 4,
          values: daily.map((d) => d.interruptions),
        },
        {
          name: 'Denied tools',
          tone: 3,
          values: daily.map((d) => d.toolDenied),
        },
      ],
    }),
  ];
  return `<div class="charts">${charts.join('')}</div>`;
}

function describeChart(
  labels: readonly string[],
  id: string,
  title: string,
  noun: string,
  values: readonly (number | null)[],
  formatValue: (value: number) => string,
): ChartFrame {
  const present = values.filter((v): v is number => v !== null);
  const peak = Math.max(0, ...present);
  const peakIndex = values.findIndex((v) => v === peak);
  const total = present.reduce((sum, v) => sum + v, 0);
  const summary =
    present.length === 0
      ? 'No data.'
      : `${String(present.length)} days with data; peak ${formatValue(peak)} ${noun} (${labels[peakIndex] ?? 'n/a'}); average ${formatValue(total / present.length)}.`;
  return { id, title, description: `${title}. ${summary}`, formatValue };
}

function renderDailyTable(daily: readonly DailyPoint[]): string {
  return `<div class="tablewrap"><table><caption class="sr-only">Daily activity</caption><thead><tr><th scope="col">Date</th><th scope="col" class="num">Sessions</th><th scope="col" class="num">Prompts</th><th scope="col" class="num">Tool calls</th><th scope="col" class="num">Errors</th><th scope="col" class="num">Corrections</th><th scope="col" class="num">Interruptions</th></tr></thead><tbody>${daily
    .map(
      (d) =>
        `<tr><th scope="row">${esc(d.date)}</th><td class="num">${esc(count(d.sessions))}</td><td class="num">${esc(count(d.typedPrompts))}</td><td class="num">${esc(count(d.toolCalls))}</td><td class="num">${esc(count(d.toolErrors))}</td><td class="num">${esc(count(d.corrections))}</td><td class="num">${esc(count(d.interruptions))}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;
}

function renderTrends(report: Report): string {
  const { daily } = report;
  let body: string;
  if (daily.length === 0) {
    body = '<p class="empty">No daily history yet.</p>';
  } else if (daily.length < MIN_DAYS_FOR_TRENDS) {
    body = `<p class="empty">Only ${esc(plural(daily.length, 'day'))} of history so far. Trend charts need at least ${String(MIN_DAYS_FOR_TRENDS)} days, so here are the raw numbers instead.</p>${renderDailyTable(daily)}`;
  } else {
    body = `${trendSeries(daily)}<details><summary>Daily numbers</summary>${renderDailyTable(daily)}</details>`;
  }
  return section('trends', 'Trends', body);
}

function renderTools(report: Report): string {
  const tools = report.metrics.overall.tools.slice(0, MAX_TOOLS_SHOWN);
  if (tools.length === 0) {
    return '<p class="empty">No tool calls recorded.</p>';
  }
  const max = Math.max(1, ...tools.map((t) => t.calls));
  return `<div class="tablewrap"><table><caption class="sr-only">Tool usage</caption><thead><tr><th scope="col">Tool</th><th scope="col" class="num">Calls</th><th scope="col" class="num">Errors</th><th scope="col" class="num">Denied</th><th scope="col" class="num">Error rate</th></tr></thead><tbody>${tools
    .map(
      (t) =>
        `<tr><th scope="row" class="name">${esc(t.name)}<span class="bar" aria-hidden="true" style="width:${String(round((safeNumber(t.calls) / max) * 100, 1))}%"></span></th><td class="num">${esc(count(t.calls))}</td><td class="num">${esc(count(t.errors))}</td><td class="num">${esc(count(t.denied))}</td><td class="num">${esc(formatPercent(t.errorRate, 1))}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;
}

function renderModels(report: Report): string {
  const { models } = report.metrics.overall;
  if (models.length === 0) {
    return '<p class="empty">No model usage recorded.</p>';
  }
  return `<div class="tablewrap"><table><caption class="sr-only">Model mix</caption><thead><tr><th scope="col">Model</th><th scope="col" class="num">Messages</th><th scope="col" class="num">Tokens</th><th scope="col" class="num">Share</th></tr></thead><tbody>${models
    .map(
      (m) =>
        `<tr><th scope="row" class="name">${esc(m.model)}<span class="bar" aria-hidden="true" style="width:${String(round(safeNumber(m.share) * 100, 1))}%"></span></th><td class="num">${esc(count(m.messages))}</td><td class="num">${esc(formatTokens(m.tokens))}</td><td class="num">${esc(formatPercent(m.share))}</td></tr>`,
    )
    .join('')}</tbody></table></div>`;
}

function renderHabits(report: Report): string {
  const { overall, activity } = report.metrics;
  if (overall.typedPrompts < MIN_PROMPTS_FOR_HABIT_CHARTS) {
    return `<p class="empty">${esc(plural(overall.typedPrompts, 'typed prompt'))} so far: too few to chart when you work. Charts appear from ${String(MIN_PROMPTS_FOR_HABIT_CHARTS)} prompts.</p>`;
  }
  const charts = [
    renderCategoryChart({
      chart: describeChart(
        activity.byHour.map((_, h) => `${String(h)}:00`),
        'hours',
        'Typed prompts by hour of day (local time)',
        'prompts',
        [...activity.byHour],
        count,
      ),
      labels: activity.byHour.map((_, hour) => String(hour)),
      values: activity.byHour,
      labelEvery: 3,
    }),
    renderCategoryChart({
      chart: describeChart(
        [...WEEKDAYS],
        'weekdays',
        'Typed prompts by weekday',
        'prompts',
        [...activity.byWeekday],
        count,
      ),
      labels: [...WEEKDAYS],
      values: activity.byWeekday,
    }),
    renderCategoryChart({
      chart: describeChart(
        overall.sessionMinutes.buckets.map((b) => b.label),
        'session-length',
        'Sessions by active length',
        'sessions',
        overall.sessionMinutes.buckets.map((b) => b.count),
        count,
      ),
      labels: overall.sessionMinutes.buckets.map((b) => b.label),
      values: overall.sessionMinutes.buckets.map((b) => b.count),
    }),
  ];
  return `<div class="charts">${charts.join('')}</div>`;
}

function renderMetrics(report: Report): string {
  const { overall, byProject } = report.metrics;
  const traits =
    report.promptTraits.length > 0
      ? `<h3>Prompt traits</h3><ul>${report.promptTraits
          .map(
            (t) =>
              `<li>${esc(t.description)} <span class="muted small">(${t.significant ? 'meaningful gap' : 'not significant'})</span></li>`,
          )
          .join('')}</ul>`
      : '';
  const projects =
    byProject.length > 1
      ? `<h3>Projects</h3><div class="tablewrap"><table><caption class="sr-only">Projects</caption><thead><tr><th scope="col">Project</th><th scope="col" class="num">Sessions</th><th scope="col" class="num">Prompts</th><th scope="col" class="num">Tool calls</th><th scope="col" class="num">Error rate</th></tr></thead><tbody>${byProject
          .map(
            (p) =>
              `<tr><th scope="row" class="name">${esc(p.project)}</th><td class="num">${esc(count(p.sessions))}</td><td class="num">${esc(count(p.typedPrompts))}</td><td class="num">${esc(count(p.toolCalls))}</td><td class="num">${esc(formatPercent(p.toolErrorRate, 1))}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : '';
  const extras = [
    overall.subagents.invocations > 0
      ? `${plural(overall.subagents.invocations, 'subagent call')} in ${plural(overall.subagents.sessionsUsing, 'session')}`
      : null,
    overall.planMode.sessionsUsing > 0
      ? `plan mode in ${plural(overall.planMode.sessionsUsing, 'session')}`
      : null,
    overall.compactions > 0 ? plural(overall.compactions, 'compaction') : null,
    overall.apiErrors > 0 ? plural(overall.apiErrors, 'API error') : null,
    overall.slashCommands.length > 0
      ? `slash commands: ${overall.slashCommands
          .slice(0, 6)
          .map((c) => `/${c.name} x${String(c.count)}`)
          .join(', ')}`
      : null,
  ].filter((part): part is string => part !== null);
  return section(
    'metrics',
    'Metrics',
    `${renderHabits(report)}
<div class="cols" style="margin-top:16px"><div><h3>Tools</h3>${renderTools(report)}</div><div><h3>Models</h3>${renderModels(report)}</div></div>
${extras.length > 0 ? `<p class="muted small">${extras.map(esc).join(' &middot; ')}</p>` : ''}
${traits}${projects}`,
  );
}

function renderEpisode(report: Report, episode: Episode): string {
  const verdict = report.interpretation?.episodeVerdicts.find(
    (v) => v.episodeId === episode.id,
  );
  return `<div class="ep"><span class="type">${esc(EPISODE_LABELS[episode.type] ?? episode.type)}</span>${verdict ? `<span class="badge ${esc(verdict.verdict)}">${esc(verdict.verdict)}</span> ` : ''}${esc(episode.summary)}${episode.count > 1 ? ` (x${esc(episode.count)})` : ''}<div class="muted small">${esc(episode.project)} - ${esc(episode.timestamp.slice(0, 10))}${episode.prompt ? ` - &ldquo;${esc(episode.prompt)}&rdquo;` : ''}${verdict?.note ? ` - ${esc(verdict.note)}` : ''}</div></div>`;
}

function renderEpisodes(report: Report): string {
  if (report.episodes.length === 0) {
    return '';
  }
  const shown = report.episodes.slice(0, MAX_EPISODES_SHOWN);
  const hidden = report.episodes.length - shown.length;
  return section(
    'episodes',
    `Friction episodes (${String(report.episodes.length)})`,
    `<details><summary>Show all detected episodes</summary>${shown.map((e) => renderEpisode(report, e)).join('')}${hidden > 0 ? `<p class="muted small">${esc(plural(hidden, 'more episode'))} not shown; see the JSON report.</p>` : ''}</details>`,
  );
}

function renderDataQuality(report: Report): string {
  const q = report.dataQuality;
  const unknown = Object.entries(q.unknownRecordTypes);
  const rows: readonly (readonly [string, string])[] = [
    [
      'Files read',
      `${count(q.filesRead)} (+${count(q.subagentFilesRead)} subagent)`,
    ],
    ['Records read', count(q.recordsRead)],
    ['Records skipped', count(q.recordsSkipped)],
    ['Duplicate records', count(q.duplicateRecords)],
    ['Orphan tool results', count(q.orphanToolResults)],
    ['Claude Code versions', q.claudeCodeVersions.join(', ') || 'unknown'],
    ...(unknown.length > 0
      ? [
          [
            'Unknown record types',
            unknown.map(([k, v]) => `${k} x${String(v)}`).join(', '),
          ] as const,
        ]
      : []),
  ];
  return section(
    'quality',
    'Data quality',
    `${q.notes.length > 0 ? `<ul>${q.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="muted">No caveats.</p>'}
<details><summary>Parsing details</summary><div class="tablewrap"><table><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table></div></details>`,
  );
}

/** Blocks any network use even if a future change slips an external URL in. */
const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'";

export function renderHtml(report: Report): string {
  const ids = createIds();
  const title = `Hyntx report ${report.period.from} to ${report.period.to}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${esc(CSP)}">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
${renderHeader(report)}
<main>
${renderQualityNotice(report)}
${renderInsights(report, ids)}
${renderRecommendations(report)}
${renderTrends(report)}
${renderMetrics(report)}
${renderEpisodes(report)}
${renderDataQuality(report)}
</main>
<footer>Generated by ${esc(report.generator.name)} ${esc(report.generator.version)}. This file is self-contained and makes no network requests.</footer>
</div>
<div id="live" class="sr-only" aria-live="polite"></div>
<script>${JS}</script>
</body>
</html>
`;
}
