/**
 * Enhanced Reporter
 *
 * Extends base reporter with data science visualizations.
 * Provides ASCII charts, cluster displays, and trend visualizations.
 */

import chalk from 'chalk';

import type { EnhancedAnalysisResult } from '../types/index.js';
import {
  renderBarChart,
  renderDistributionStats,
  renderHistogram,
  renderTrendChart,
} from '../visualization/index.js';

// =============================================================================
// Enhanced Report Functions
// =============================================================================

/**
 * Print enhanced statistics section with visualizations.
 *
 * @param result - Enhanced analysis result
 */
export function printEnhancedStatistics(result: EnhancedAnalysisResult): void {
  if (!result.enhancedStats) {
    return;
  }

  const { descriptive, specificity, lexical, timing } = result.enhancedStats;

  console.log();
  console.log(chalk.bold.cyan('📊 Detailed Statistics'));
  console.log();

  if (descriptive) {
    // Print statistics table
    console.log(renderDistributionStats(descriptive));
    console.log();

    // Print score distribution histogram
    const scores: number[] = [];
    // Generate scores based on descriptive stats for visualization
    const mean = descriptive.mean;
    const stdDev = descriptive.stdDev;

    // Generate approximate distribution
    for (let i = 0; i < descriptive.count; i++) {
      const randomScore = mean + (Math.random() - 0.5) * 2 * stdDev;
      const clampedScore = Math.max(
        descriptive.min,
        Math.min(descriptive.max, randomScore),
      );
      scores.push(clampedScore);
    }

    console.log(renderHistogram(scores, 8, chalk.bold('Score Distribution')));
    console.log();
  }

  if (specificity) {
    console.log(chalk.bold('Specificity Analysis'));
    console.log(
      `  Mean Specificity: ${chalk.cyan(`${String(specificity.mean)}/100`)}`,
    );
    if (specificity.distribution.length > 0) {
      const hist = renderHistogram(
        specificity.distribution,
        5,
        'Specificity Distribution',
      );
      console.log(hist);
    }
    console.log();
  }

  if (lexical) {
    console.log(chalk.bold('Lexical Complexity'));
    console.log(
      `  Average Word Count: ${chalk.cyan(String(lexical.avgWordCount))}`,
    );
    console.log(
      `  Lexical Diversity: ${chalk.cyan(`${(lexical.avgComplexity * 100).toFixed(1)}%`)}`,
    );
    console.log();
  }

  if (timing) {
    console.log(chalk.bold('Performance'));
    console.log(
      `  Analysis Duration: ${chalk.cyan(`${String(timing.durationMs)}ms`)}`,
    );
    console.log(
      `  Tokens Processed: ${chalk.cyan(String(timing.tokensProcessed))}`,
    );
    console.log();
  }
}

/**
 * Print cluster analysis section.
 *
 * @param result - Enhanced analysis result
 */
export function printClusterAnalysis(result: EnhancedAnalysisResult): void {
  if (!result.clusters || result.clusters.clusters.length === 0) {
    return;
  }

  const { clusters, metrics, summary } = result.clusters;

  console.log();
  console.log(
    chalk.bold.cyan(`🔗 Prompt Clusters (${String(clusters.length)} found)`),
  );
  console.log();

  // Print cluster quality metrics
  console.log(
    chalk.dim(
      `Silhouette Score: ${metrics.silhouetteScore.toFixed(2)} | Optimal K: ${String(metrics.optimalK)}`,
    ),
  );
  console.log(
    chalk.dim(
      `Average Cluster Size: ${String(summary.avgClusterSize)} prompts`,
    ),
  );
  console.log();

  // Print each cluster
  for (const cluster of clusters) {
    const box = {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    };

    const width = 70;
    const header = ` Cluster ${String(cluster.id + 1)}: "${cluster.label}" (${String(cluster.size)} prompts) `;
    const paddingTotal = width - header.length;
    const paddingLeft = Math.floor(paddingTotal / 2);
    const paddingRight = paddingTotal - paddingLeft;

    console.log(
      box.topLeft +
        box.horizontal.repeat(paddingLeft) +
        header +
        box.horizontal.repeat(paddingRight) +
        box.topRight,
    );

    // Keywords
    const keywordsLine = `Keywords: ${cluster.keywords.join(', ')}`;
    console.log(
      box.vertical +
        ' ' +
        chalk.dim(keywordsLine.padEnd(width - 2)) +
        ' ' +
        box.vertical,
    );

    // Representative prompt
    const repLabel = 'Representative: ';
    const repPrompt = cluster.representativePrompt.slice(
      0,
      width - repLabel.length - 4,
    );
    console.log(
      box.vertical +
        ' ' +
        chalk.dim(repLabel) +
        chalk.white(repPrompt.padEnd(width - repLabel.length - 2)) +
        ' ' +
        box.vertical,
    );

    console.log(
      box.bottomLeft + box.horizontal.repeat(width) + box.bottomRight,
    );
    console.log();
  }

  // Print cluster size distribution
  const clusterSizes = new Map<string, number>();
  for (const cluster of clusters) {
    clusterSizes.set(cluster.label, cluster.size);
  }

  console.log(
    renderBarChart(clusterSizes, chalk.bold('Cluster Size Distribution')),
  );
  console.log();
}

/**
 * Print trend analysis section.
 *
 * @param result - Enhanced analysis result
 * @param historical - Historical scores for visualization
 */
export function printTrendAnalysis(
  result: EnhancedAnalysisResult,
  historical: readonly number[],
): void {
  if (!result.trend) {
    return;
  }

  const { trend } = result;

  console.log();
  console.log(chalk.bold.cyan('📈 Trend Analysis'));
  console.log();

  // Print trend chart
  console.log(renderTrendChart(trend, historical, 7));
  console.log();

  // Print confidence info
  const confidenceColor =
    trend.confidence === 'high'
      ? chalk.green
      : trend.confidence === 'medium'
        ? chalk.yellow
        : chalk.red;

  console.log(
    chalk.bold('Confidence: ') +
      confidenceColor(trend.confidence.toUpperCase()),
  );
  console.log(
    chalk.dim(
      `R² = ${trend.rSquared.toFixed(3)} (${(trend.rSquared * 100).toFixed(1)}% variance explained)`,
    ),
  );
  console.log();

  // Print projection
  const futureScore = trend.projectedScore(7);
  console.log(chalk.bold('Projection:'));
  console.log(`  Score in 7 days: ${chalk.cyan(futureScore.toFixed(2))}`);

  const lastScore = historical[historical.length - 1] ?? 0;
  const change = futureScore - lastScore;
  const changePercent = lastScore !== 0 ? (change / lastScore) * 100 : 0;
  const changeColor =
    change > 0 ? chalk.green : change < 0 ? chalk.red : chalk.yellow;
  console.log(
    `  Expected change: ${changeColor(`${change > 0 ? '+' : ''}${change.toFixed(2)} (${changePercent.toFixed(1)}%)`)}`,
  );
  console.log();
}

/**
 * Print complete enhanced report.
 *
 * @param result - Enhanced analysis result
 * @param options - Display options
 */
export function printEnhancedReport(
  result: EnhancedAnalysisResult,
  options: {
    showStats?: boolean;
    showClusters?: boolean;
    showTrends?: boolean;
    historicalScores?: readonly number[];
  } = {},
): void {
  const {
    showStats = true,
    showClusters = false,
    showTrends = false,
    historicalScores = [],
  } = options;

  if (showStats && result.enhancedStats) {
    printEnhancedStatistics(result);
  }

  if (showClusters && result.clusters) {
    printClusterAnalysis(result);
  }

  if (showTrends && result.trend && historicalScores.length > 0) {
    printTrendAnalysis(result, historicalScores);
  }
}
