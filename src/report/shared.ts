/**
 * Formatting helpers shared by the terminal and markdown renderers.
 */

import { type InsightAction, type Report } from '../types/index.js';

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function formatTokens(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}k`;
  }
  return String(value);
}

export function formatPercent(ratio: number | null, digits = 0): string {
  return ratio === null ? 'n/a' : `${(ratio * 100).toFixed(digits)}%`;
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 90) {
    return `${(minutes / 60).toFixed(1)}h`;
  }
  return `${String(Math.round(minutes))}m`;
}

export function periodLabel(report: Report): string {
  const { from, to, days } = report.period;
  const scope = report.filters.project ?? 'all projects';
  return `${from} to ${to} (${String(days)} day${days === 1 ? '' : 's'}) - ${scope}`;
}

export type ActionDescription = {
  readonly label: string;
  readonly lines: readonly string[];
  /** Lines that should be shown verbatim (copy-paste material). */
  readonly verbatim: readonly string[];
};

export function describeAction(action: InsightAction): ActionDescription {
  switch (action.kind) {
    case 'claude-md-rule':
      return {
        label:
          action.scope === 'project'
            ? `Add to CLAUDE.md in project "${action.project ?? '?'}"`
            : `Add to ${action.file}`,
        lines: [],
        verbatim: action.text.split('\n'),
      };
    case 'permission-allow':
      return {
        label: `Allow in ${action.file}`,
        lines: [],
        verbatim: action.snippet.split('\n'),
      };
    case 'slash-command':
      return {
        label: `Create ${action.file}${action.name}.md`,
        lines: [],
        verbatim: action.content.trimEnd().split('\n'),
      };
    case 'prompt-habit':
      return {
        label: action.habit,
        lines: [],
        verbatim: [
          ...(action.before ? [`before: ${action.before}`] : []),
          ...(action.after ? [`after:  ${action.after}`] : []),
        ],
      };
    case 'workflow':
      return {
        label: action.suggestion,
        lines: action.steps.map((step, i) => `${String(i + 1)}. ${step}`),
        verbatim: [],
      };
  }
}
