/**
 * ASCII Charts Visualization Module
 *
 * Provides ASCII-based charts for terminal output including histograms,
 * line charts, and trend visualizations.
 */

import asciichart from 'asciichart';
import chalk from 'chalk';

import type { DescriptiveStats, TrendAnalysis } from '../types/index.js';

// =============================================================================
// Main Visualization Functions
// =============================================================================

/**
 * Render a line chart using ASCII characters.
 *
 * @param data - Array of numeric values to plot
 * @param title - Optional chart title
 * @param height - Chart height in lines (default: 10)
 * @returns ASCII line chart as string
 *
 * @example
 * ```typescript
 * const scores = [5.2, 5.8, 6.1, 6.4, 6.8, 7.2];
 * const chart = renderLineChart(scores, 'Score Over Time');
 * console.log(chart);
 * ```
 */
export function renderLineChart(
  data: readonly number[],
  title?: string,
  height = 10,
): string {
  if (data.length === 0) {
    return 'No data to display';
  }

  const chart = asciichart.plot([...data], {
    height,
    padding: '       ',
    format: (x: number) => x.toFixed(1).padStart(5),
  });

  if (title) {
    return `${chalk.bold(title)}\n${chart}`;
  }

  return chart;
}

/**
 * Render a histogram showing distribution of values.
 *
 * @param data - Array of numeric values
 * @param bins - Number of bins for histogram (default: 10)
 * @param title - Optional title
 * @returns ASCII histogram as string
 *
 * @example
 * ```typescript
 * const scores = [4.5, 5.2, 5.8, 6.1, 6.4, 6.8, 7.2, 7.5, 8.1];
 * const histogram = renderHistogram(scores, 5, 'Score Distribution');
 * console.log(histogram);
 * // Output:
 * // 4.0-5.0 │████ (1)
 * // 5.0-6.0 │████████ (2)
 * // 6.0-7.0 │████████████ (3)
 * // ...
 * ```
 */
export function renderHistogram(
  data: readonly number[],
  bins = 10,
  title?: string,
): string {
  if (data.length === 0) {
    return 'No data to display';
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / bins;

  // Create histogram bins
  const histogram: number[] = Array(bins).fill(0) as number[];
  for (const value of data) {
    const binIndex = Math.min(Math.floor((value - min) / binWidth), bins - 1);
    const currentValue = histogram[binIndex];
    if (currentValue !== undefined) {
      histogram[binIndex] = currentValue + 1;
    }
  }

  // Find max count for scaling
  const maxCount = Math.max(...histogram);
  const scale = maxCount > 0 ? 40 / maxCount : 1; // Max 40 characters wide

  // Build histogram lines
  const lines: string[] = [];

  if (title) {
    lines.push(chalk.bold(title));
  }

  for (let i = 0; i < bins; i++) {
    const rangeStart = (min + i * binWidth).toFixed(1);
    const rangeEnd = (min + (i + 1) * binWidth).toFixed(1);
    const histValue = histogram[i] ?? 0;
    const barLength = Math.round(histValue * scale);
    const bar = chalk.cyan('█'.repeat(barLength));
    const count = chalk.dim(`(${String(histValue)})`);

    lines.push(`${rangeStart}-${rangeEnd} │${bar} ${count}`);
  }

  return lines.join('\n');
}

/**
 * Render a trend chart with historical data and projections.
 *
 * @param trend - Trend analysis result
 * @param historical - Historical score values
 * @param forecastPeriods - Number of periods to project (default: 7)
 * @returns ASCII trend chart with projection
 *
 * @example
 * ```typescript
 * const historical = [5.2, 5.8, 6.1, 6.4, 6.8, 7.2];
 * const trend = analyzeTrend(data);
 * const chart = renderTrendChart(trend, historical, 5);
 * console.log(chart);
 * ```
 */
export function renderTrendChart(
  trend: TrendAnalysis,
  historical: readonly number[],
  forecastPeriods = 7,
): string {
  if (historical.length === 0) {
    return 'No data to display';
  }

  // Generate projected values
  const projected: number[] = [];
  for (let i = 1; i <= forecastPeriods; i++) {
    projected.push(trend.projectedScore(i));
  }

  // Combine historical and projected
  const combined = [...historical, ...projected];

  const chart = asciichart.plot(combined, {
    height: 10,
    padding: '       ',
    format: (x: number) => x.toFixed(1).padStart(5),
  });

  // Create separator line showing where projection starts
  const historicalWidth = historical.length * 2;
  const projectedWidth = forecastPeriods * 2;
  const separator = `       ${chalk.dim('─'.repeat(historicalWidth))}${chalk.yellow('┬')}${chalk.dim('─ '.repeat(Math.floor(projectedWidth / 2)))}`;

  const legend = `       ${chalk.dim('Historical'.padEnd(historicalWidth))}${chalk.yellow('│')} ${chalk.yellow('Projected')}`;

  // Add trend direction indicator
  const directionSymbol =
    trend.direction === 'improving'
      ? '↑'
      : trend.direction === 'declining'
        ? '↓'
        : '→';
  const directionColor =
    trend.direction === 'improving'
      ? chalk.green
      : trend.direction === 'declining'
        ? chalk.red
        : chalk.yellow;

  const trendInfo = directionColor(
    `Trend: ${directionSymbol} ${trend.direction.charAt(0).toUpperCase() + trend.direction.slice(1)} (slope: ${(trend.slope * 7).toFixed(2)}/week, R²=${trend.rSquared.toFixed(2)})`,
  );

  return `${chart}\n${separator}\n${legend}\n\n${trendInfo}`;
}

/**
 * Render distribution statistics as ASCII table.
 *
 * @param stats - Descriptive statistics
 * @returns Formatted statistics table
 *
 * @example
 * ```typescript
 * const stats = computeDescriptiveStats(scores);
 * const table = renderDistributionStats(stats);
 * console.log(table);
 * ```
 */
export function renderDistributionStats(stats: DescriptiveStats): string {
  const rows = [
    ['Count', stats.count.toString()],
    ['Mean', stats.mean.toFixed(2)],
    ['Median', stats.median.toFixed(2)],
    ['Std Dev', stats.stdDev.toFixed(2)],
    ['Min', stats.min.toFixed(2)],
    ['Max', stats.max.toFixed(2)],
    ['25th %ile', stats.percentiles.p25.toFixed(2)],
    ['75th %ile', stats.percentiles.p75.toFixed(2)],
    ['90th %ile', stats.percentiles.p90.toFixed(2)],
    ['95th %ile', stats.percentiles.p95.toFixed(2)],
  ];

  const maxLabelLength = Math.max(...rows.map((r) => (r[0] ?? '').length));

  const lines = rows.map(([label, value]) => {
    const paddedLabel = (label ?? '').padEnd(maxLabelLength);
    return `│ ${chalk.dim(paddedLabel)} │ ${chalk.cyan((value ?? '').padStart(8))} │`;
  });

  const separator = `├${'─'.repeat(maxLabelLength + 2)}┼${'─'.repeat(10)}┤`;
  const top = `┌${'─'.repeat(maxLabelLength + 2)}┬${'─'.repeat(10)}┐`;
  const bottom = `└${'─'.repeat(maxLabelLength + 2)}┴${'─'.repeat(10)}┘`;

  return [top, lines[0], separator, ...lines.slice(1), bottom].join('\n');
}

/**
 * Render a simple bar chart for categorical data.
 *
 * @param data - Map of labels to values
 * @param title - Optional title
 * @returns ASCII bar chart
 *
 * @example
 * ```typescript
 * const data = new Map([
 *   ['Vague', 15],
 *   ['No Context', 12],
 *   ['Too Broad', 8],
 * ]);
 * const chart = renderBarChart(data, 'Issue Distribution');
 * console.log(chart);
 * ```
 */
export function renderBarChart(
  data: ReadonlyMap<string, number>,
  title?: string,
): string {
  if (data.size === 0) {
    return 'No data to display';
  }

  const entries = Array.from(data.entries());
  const maxValue = Math.max(...entries.map(([, v]) => v));
  const maxLabelLength = Math.max(...entries.map(([k]) => k.length));
  const scale = maxValue > 0 ? 30 / maxValue : 1; // Max 30 characters wide

  const lines: string[] = [];

  if (title) {
    lines.push(chalk.bold(title));
    lines.push('');
  }

  for (const [label, value] of entries) {
    const paddedLabel = label.padEnd(maxLabelLength);
    const barLength = Math.round(value * scale);
    const bar = chalk.cyan('█'.repeat(barLength));
    const count = chalk.dim(`(${String(value)})`);

    lines.push(`${paddedLabel} │${bar} ${count}`);
  }

  return lines.join('\n');
}
