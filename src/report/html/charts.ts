/**
 * Inline SVG charts. No libraries: every chart is a function from numbers to
 * markup, colored through CSS classes so light/dark themes apply.
 */

import { esc, round, safeNumber } from './escape.js';

const WIDTH = 400;
const HEIGHT = 172;
const PAD = { left: 38, right: 8, top: 10, bottom: 24 } as const;
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const DAY_MS = 86_400_000;

export type Series = {
  readonly name: string;
  /** Index into the palette classes `s1`..`s4`. */
  readonly tone: 1 | 2 | 3 | 4;
  /** null means "no data" (breaks lines, draws no bar). */
  readonly values: readonly (number | null)[];
};

export type ChartFrame = {
  /** Static slug (never report text); keeps SVG ids unique and deterministic. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly formatValue: (value: number) => string;
};

export function niceMax(value: number): number {
  if (!(value > 0)) {
    return 1;
  }
  if (value >= 1 && value <= 10) {
    // Even integers keep the mid gridline on a whole number for counts.
    return Math.max(2, 2 * Math.ceil(value / 2));
  }
  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const fraction = value / base;
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return step * base;
}

export function parseDay(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(ms) ? null : Math.floor(ms / DAY_MS);
}

function frame(
  chart: ChartFrame,
  inner: string,
  legend: readonly Series[],
): string {
  const id = `chart-${chart.id}`;
  const legendHtml =
    legend.length > 1
      ? `<ul class="legend" aria-hidden="true">${legend
          .map(
            (s) =>
              `<li><span class="swatch s${String(s.tone)}"></span>${esc(s.name)}</li>`,
          )
          .join('')}</ul>`
      : '';
  return `<figure class="chart">
<figcaption>${esc(chart.title)}</figcaption>
<svg viewBox="0 0 ${String(WIDTH)} ${String(HEIGHT)}" role="img" aria-labelledby="${id}-t ${id}-d" focusable="false">
<title id="${id}-t">${esc(chart.title)}</title>
<desc id="${id}-d">${esc(chart.description)}</desc>
${inner}
</svg>
${legendHtml}
</figure>`;
}

function yAxis(max: number, formatValue: (value: number) => string): string {
  return [0, 0.5, 1]
    .map((fraction) => {
      const y = round(PAD.top + PLOT_H * (1 - fraction));
      return `<line class="grid" x1="${String(PAD.left)}" x2="${String(WIDTH - PAD.right)}" y1="${String(y)}" y2="${String(y)}"/><text class="tick" x="${String(PAD.left - 5)}" y="${String(y + 3.5)}" text-anchor="end">${esc(formatValue(max * fraction))}</text>`;
    })
    .join('');
}

function xLabel(x: number, text: string, anchor: string): string {
  return `<text class="tick" x="${String(round(x))}" y="${String(HEIGHT - 7)}" text-anchor="${anchor}">${esc(text)}</text>`;
}

function stackTotals(series: readonly Series[], count: number): number[] {
  return Array.from({ length: count }, (_, i) =>
    series.reduce((sum, s) => sum + safeNumber(s.values[i] ?? 0), 0),
  );
}

export type TimeChartInput = {
  readonly chart: ChartFrame;
  /** Ascending ISO dates, parallel to every series' values. */
  readonly dates: readonly string[];
  readonly series: readonly Series[];
  readonly kind: 'bars' | 'line';
};

/**
 * Time-scaled chart: x position follows the real calendar day, so gaps in the
 * history stay visible instead of being squeezed together.
 */
export function renderTimeChart(input: TimeChartInput): string {
  const { chart, dates, series, kind } = input;
  const days = dates.map(parseDay);
  const first = days.find((d): d is number => d !== null);
  const last = [...days].reverse().find((d): d is number => d !== null);
  if (first === undefined || last === undefined) {
    return '';
  }
  const span = last - first + 1;
  const xAt = (day: number): number =>
    PAD.left + ((day - first + 0.5) / span) * PLOT_W;

  const totals = stackTotals(series, dates.length);
  const max = niceMax(
    kind === 'bars'
      ? Math.max(0, ...totals)
      : Math.max(0, ...series.flatMap((s) => s.values.map((v) => v ?? 0))),
  );
  const yAt = (value: number): number =>
    PAD.top + PLOT_H * (1 - safeNumber(value) / max);

  let marks = '';
  if (kind === 'bars') {
    const barWidth = Math.max(1, Math.min(18, (PLOT_W / span) * 0.78));
    marks = dates
      .map((date, i) => {
        const day = days[i];
        if (day === null || day === undefined) {
          return '';
        }
        let base = 0;
        const parts = series
          .map((s) => {
            const value = safeNumber(s.values[i] ?? 0);
            if (value <= 0) {
              return '';
            }
            const top = yAt(base + value);
            const height = yAt(base) - top;
            base += value;
            return `<rect class="s${String(s.tone)}" x="${String(round(xAt(day) - barWidth / 2, 2))}" y="${String(round(top, 2))}" width="${String(round(barWidth, 2))}" height="${String(round(Math.max(height, 0.5), 2))}"><title>${esc(date)} ${esc(s.name)}: ${esc(chart.formatValue(value))}</title></rect>`;
          })
          .join('');
        return parts;
      })
      .join('');
  } else {
    marks = series
      .map((s) => {
        const segments: string[][] = [[]];
        dates.forEach((_, i) => {
          const day = days[i];
          const value = s.values[i];
          if (
            day === null ||
            day === undefined ||
            value === null ||
            value === undefined
          ) {
            if ((segments.at(-1)?.length ?? 0) > 0) {
              segments.push([]);
            }
            return;
          }
          segments
            .at(-1)
            ?.push(`${String(round(xAt(day)))},${String(round(yAt(value)))}`);
        });
        const lines = segments
          .filter((points) => points.length > 1)
          .map(
            (points) =>
              `<polyline class="line s${String(s.tone)}" points="${points.join(' ')}"/>`,
          )
          .join('');
        const dots = dates
          .map((date, i) => {
            const day = days[i];
            const value = s.values[i];
            if (
              day === null ||
              day === undefined ||
              value === null ||
              value === undefined
            ) {
              return '';
            }
            return `<circle class="dot s${String(s.tone)}" cx="${String(round(xAt(day)))}" cy="${String(round(yAt(value)))}" r="${dates.length > 40 ? '1.6' : '2.6'}"><title>${esc(date)} ${esc(s.name)}: ${esc(chart.formatValue(value))}</title></circle>`;
          })
          .join('');
        return lines + dots;
      })
      .join('');
  }

  const labels = [
    xLabel(PAD.left, dates[0] ?? '', 'start'),
    xLabel(WIDTH - PAD.right, dates.at(-1) ?? '', 'end'),
  ].join('');
  return frame(
    chart,
    `${yAxis(max, chart.formatValue)}${marks}${labels}`,
    series,
  );
}

export type CategoryChartInput = {
  readonly chart: ChartFrame;
  readonly labels: readonly string[];
  readonly values: readonly number[];
  /** Show every nth label so dense axes (24 hours) stay legible. */
  readonly labelEvery?: number;
};

export function renderCategoryChart(input: CategoryChartInput): string {
  const { chart, labels, values, labelEvery = 1 } = input;
  if (values.length === 0) {
    return '';
  }
  const max = niceMax(Math.max(0, ...values));
  const slot = PLOT_W / values.length;
  const barWidth = Math.min(32, slot * 0.7);
  const marks = values
    .map((raw, i) => {
      const value = safeNumber(raw);
      const x = PAD.left + slot * i + slot / 2;
      const height = (value / max) * PLOT_H;
      const label = labels[i] ?? '';
      const bar =
        value > 0
          ? `<rect class="s1" x="${String(round(x - barWidth / 2, 2))}" y="${String(round(PAD.top + PLOT_H - height, 2))}" width="${String(round(barWidth, 2))}" height="${String(round(Math.max(height, 0.5), 2))}"><title>${esc(label)}: ${esc(chart.formatValue(value))}</title></rect>`
          : '';
      const tick = i % labelEvery === 0 ? xLabel(x, label, 'middle') : '';
      return bar + tick;
    })
    .join('');
  return frame(chart, `${yAxis(max, chart.formatValue)}${marks}`, []);
}
