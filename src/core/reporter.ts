/**
 * Terminal reporter for analysis results.
 *
 * This module provides formatted terminal output for analysis results,
 * including patterns, statistics, and suggestions.
 */

import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import figlet from 'figlet';
import type {
  AnalysisResult,
  AnalysisPattern,
  BeforeAfter,
  PatternSeverity,
  AnalysisStats,
  ComparisonResult,
  PatternChange,
  HistoryEntry,
} from '../types/index.js';

/**
 * Options for report printing.
 */
export type PrintReportOptions = {
  readonly showHeader?: boolean;
  readonly headerText?: string;
  readonly maxTextLength?: number;
};

/**
 * Returns an emoji icon for a severity level.
 *
 * @param severity - Pattern severity
 * @returns Emoji icon
 */
export function severityIcon(severity: PatternSeverity): string {
  const icons: Record<PatternSeverity, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };
  return icons[severity];
}

/**
 * Colors text based on a score value.
 *
 * @param score - Score value (0-100)
 * @param text - Text to color
 * @returns Colored text
 */
export function scoreColor(score: number, text: string): string {
  if (score >= 8) {
    return chalk.green(text);
  }
  if (score >= 6) {
    return chalk.yellow(text);
  }
  return chalk.red(text);
}

/**
 * Truncates text to a maximum length at word boundaries.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Find last space before maxLength
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > 0) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Formats the header with optional ASCII art.
 *
 * @param title - Header title (optional)
 * @returns Formatted header
 */
export function formatHeader(title?: string): string {
  const headerText = title ?? 'Hyntx Analysis';

  try {
    const ascii = figlet.textSync(headerText, {
      font: 'Standard',
      horizontalLayout: 'default',
    });
    return chalk.cyan(ascii);
  } catch {
    // Fallback if figlet fails
    return chalk.cyan.bold(`\n${headerText}\n`);
  }
}

/**
 * Formats statistics table.
 *
 * @param stats - Analysis statistics
 * @param projectCount - Number of projects (optional)
 * @returns Formatted statistics table
 */
export function formatStats(
  stats: AnalysisStats,
  projectCount?: number,
): string {
  const table = new Table({
    head: [chalk.bold('Metric'), chalk.bold('Value')],
    colWidths: [30, 20],
  });

  table.push(
    ['Total Prompts', String(stats.totalPrompts)],
    ['Prompts with Issues', String(stats.promptsWithIssues)],
    [
      'Overall Score',
      scoreColor(stats.overallScore, `${String(stats.overallScore)}/10`),
    ],
  );

  if (projectCount !== undefined) {
    table.push(['Projects Analyzed', String(projectCount)]);
  }

  return table.toString();
}

/**
 * Formats a single pattern with examples and suggestion.
 *
 * @param pattern - Analysis pattern
 * @param index - Pattern index (for numbering)
 * @returns Formatted pattern section
 */
export function formatPattern(pattern: AnalysisPattern, index: number): string {
  const lines: string[] = [];

  // Header with severity icon
  lines.push(
    chalk.bold(
      `${String(index + 1)}. ${severityIcon(pattern.severity)} ${pattern.name}`,
    ),
  );
  lines.push(
    chalk.dim(
      `   Frequency: ${String(pattern.frequency)} | Severity: ${pattern.severity}`,
    ),
  );
  lines.push('');

  // Examples
  if (pattern.examples.length > 0) {
    lines.push(chalk.yellow('   Examples:'));
    for (const example of pattern.examples) {
      lines.push(chalk.dim(`   • ${example}`));
    }
    lines.push('');
  }

  // Suggestion
  lines.push(chalk.green('   Suggestion:'));
  lines.push(chalk.dim(`   ${pattern.suggestion}`));

  // Box the entire pattern
  return boxen(lines.join('\n'), {
    padding: 1,
    borderColor: pattern.severity === 'high' ? 'red' : 'yellow',
    borderStyle: 'round',
  });
}

/**
 * Formats before/after example.
 *
 * @param beforeAfter - Before/after example
 * @returns Formatted before/after section
 */
export function formatBeforeAfter(beforeAfter: BeforeAfter): string {
  const sections: string[] = [];

  // Before box
  const beforeBox = boxen(chalk.red(beforeAfter.before), {
    padding: 1,
    borderColor: 'red',
    borderStyle: 'round',
    title: '❌ Before',
  });
  sections.push(beforeBox);

  // After box
  const afterBox = boxen(chalk.green(beforeAfter.after), {
    padding: 1,
    borderColor: 'green',
    borderStyle: 'round',
    title: '✅ After',
  });
  sections.push(afterBox);

  return sections.join('\n\n');
}

/**
 * Formats the top suggestion with highlighting.
 *
 * @param suggestion - Top suggestion text
 * @returns Formatted suggestion
 */
export function formatTopSuggestion(suggestion: string): string {
  return boxen(chalk.cyan.bold(suggestion), {
    padding: 1,
    borderColor: 'cyan',
    borderStyle: 'double',
    title: '💡 Top Suggestion',
  });
}

/**
 * Prints a formatted analysis report to the console.
 *
 * @param result - Analysis result
 * @param options - Formatting options
 */
export function printReport(
  result: AnalysisResult,
  options?: PrintReportOptions,
): void {
  const opts = {
    showHeader: options?.showHeader ?? true,
    headerText: options?.headerText,
    maxTextLength: options?.maxTextLength ?? 200,
  };

  const output: string[] = [];

  // Header
  if (opts.showHeader) {
    output.push(formatHeader(opts.headerText));
    output.push('');
  }

  // Statistics
  output.push(chalk.bold('📊 Statistics'));
  output.push('');
  output.push(formatStats(result.stats));
  output.push('');

  // Top suggestion
  if (result.topSuggestion) {
    output.push(formatTopSuggestion(result.topSuggestion));
    output.push('');
  }

  // Patterns
  if (result.patterns.length > 0) {
    output.push(chalk.bold('🔍 Detected Patterns'));
    output.push('');

    for (const [index, pattern] of result.patterns.entries()) {
      // Truncate long examples
      const truncatedPattern = {
        ...pattern,
        examples: pattern.examples.map((ex) =>
          truncateText(ex, opts.maxTextLength),
        ),
        suggestion: truncateText(pattern.suggestion, opts.maxTextLength),
      };

      output.push(formatPattern(truncatedPattern, index));
      output.push('');

      // Show before/after for first pattern (most important)
      if (index === 0) {
        const truncatedBeforeAfter: BeforeAfter = {
          before: truncateText(pattern.beforeAfter.before, opts.maxTextLength),
          after: truncateText(pattern.beforeAfter.after, opts.maxTextLength),
        };
        output.push(formatBeforeAfter(truncatedBeforeAfter));
        output.push('');
      }
    }
  } else {
    output.push(chalk.green('✅ No issues detected!'));
    output.push('');
  }

  // Date footer
  output.push(chalk.dim(`Analysis Date: ${result.date}`));

  // Single console.log for entire output
  console.log(output.join('\n'));
}

/**
 * Formats an analysis result as JSON.
 *
 * @param result - Analysis result to format
 * @param compact - Whether to output compact JSON (single line, no indentation). Default: false (pretty-printed with 2-space indentation)
 * @returns JSON string representation of the analysis result
 *
 * @example
 * // Pretty-printed (default)
 * formatJson(result) // Returns multi-line JSON with 2-space indentation
 *
 * // Compact
 * formatJson(result, true) // Returns single-line JSON
 */
export function formatJson(result: AnalysisResult, compact = false): string {
  return compact ? JSON.stringify(result) : JSON.stringify(result, null, 2);
}

/**
 * Returns a text icon for a severity level (Markdown-friendly).
 *
 * @param severity - Pattern severity
 * @returns Text icon
 */
function severityIconMarkdown(severity: PatternSeverity): string {
  const icons: Record<PatternSeverity, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };
  return icons[severity];
}

/**
 * Formats an analysis result as Markdown.
 *
 * @param result - Analysis result to format
 * @returns Markdown string representation of the analysis result
 *
 * @example
 * const markdown = formatMarkdown(result);
 * fs.writeFileSync('report.md', markdown);
 */
export function formatMarkdown(result: AnalysisResult): string {
  const lines: string[] = [];

  // Header
  lines.push('# Hyntx Analysis Report');
  lines.push('');
  lines.push(`**Date:** ${result.date}`);
  lines.push('');

  // Statistics table
  lines.push('## Statistics');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Total Prompts | ${String(result.stats.totalPrompts)} |`);
  lines.push(
    `| Prompts with Issues | ${String(result.stats.promptsWithIssues)} |`,
  );
  lines.push(`| Overall Score | ${String(result.stats.overallScore)}/10 |`);
  lines.push('');

  // Top suggestion
  if (result.topSuggestion) {
    lines.push('## Top Suggestion');
    lines.push('');
    lines.push(`> 💡 ${result.topSuggestion}`);
    lines.push('');
  }

  // Patterns
  if (result.patterns.length > 0) {
    lines.push('## Detected Patterns');
    lines.push('');

    for (const [index, pattern] of result.patterns.entries()) {
      // Pattern header with severity
      lines.push(
        `### ${String(index + 1)}. ${severityIconMarkdown(pattern.severity)} ${pattern.name}`,
      );
      lines.push('');
      lines.push(
        `**Frequency:** ${String(pattern.frequency)} | **Severity:** ${pattern.severity}`,
      );
      lines.push('');

      // Examples
      if (pattern.examples.length > 0) {
        lines.push('**Examples:**');
        lines.push('');
        for (const example of pattern.examples) {
          lines.push(`- ${example}`);
        }
        lines.push('');
      }

      // Suggestion
      lines.push('**Suggestion:**');
      lines.push('');
      lines.push(pattern.suggestion);
      lines.push('');

      // Before/After
      lines.push('**Before/After:**');
      lines.push('');
      lines.push('> ❌ **Before:**');
      lines.push('>');
      // Split before text into lines and prefix each with >
      for (const line of pattern.beforeAfter.before.split('\n')) {
        lines.push(`> ${line}`);
      }
      lines.push('');
      lines.push('> ✅ **After:**');
      lines.push('>');
      // Split after text into lines and prefix each with >
      for (const line of pattern.beforeAfter.after.split('\n')) {
        lines.push(`> ${line}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  } else {
    lines.push('## Results');
    lines.push('');
    lines.push('✅ No issues detected! Your prompts look great.');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by [Hyntx](https://github.com/hyntx/hyntx)*');

  return lines.join('\n');
}

// =============================================================================
// Comparison Formatting
// =============================================================================

/**
 * Returns a visual indicator for score changes.
 *
 * @param delta - Score change (positive or negative)
 * @returns Visual indicator with arrow
 */
function scoreDeltaIndicator(delta: number): string {
  if (delta > 0) {
    return chalk.green(`↑ +${delta.toFixed(1)}`);
  }
  if (delta < 0) {
    return chalk.red(`↓ ${delta.toFixed(1)}`);
  }
  return chalk.dim('→ 0.0');
}

/**
 * Returns an icon for pattern change status.
 *
 * @param status - Pattern change status
 * @returns Status icon
 */
function patternStatusIcon(status: 'new' | 'resolved' | 'changed'): string {
  const icons = {
    new: '🆕',
    resolved: '✅',
    changed: '📊',
  };
  return icons[status];
}

/**
 * Prints a comparison between two analysis results to the terminal.
 *
 * @param comparison - Comparison result
 */
export function printComparison(comparison: ComparisonResult): void {
  const output: string[] = [];

  // Header
  output.push('');
  output.push(
    chalk.bold.cyan(
      `Comparison: ${comparison.before.date} → ${comparison.after.date}`,
    ),
  );
  output.push('');

  // Score change
  const delta = comparison.changes.scoreDelta;
  output.push(chalk.bold('📊 Score Change'));
  output.push('');
  output.push(
    `  Before: ${scoreColor(comparison.before.stats.overallScore, comparison.before.stats.overallScore.toFixed(1))}/10`,
  );
  output.push(
    `  After:  ${scoreColor(comparison.after.stats.overallScore, comparison.after.stats.overallScore.toFixed(1))}/10`,
  );
  output.push(`  Change: ${scoreDeltaIndicator(delta)}`);
  output.push('');

  // New patterns
  if (comparison.changes.newPatterns.length > 0) {
    output.push(chalk.bold('🆕 New Patterns Detected'));
    output.push('');
    for (const pattern of comparison.changes.newPatterns) {
      output.push(
        `  ${severityIcon(pattern.severity)} ${pattern.name} (${pattern.frequency}x)`,
      );
    }
    output.push('');
  }

  // Resolved patterns
  if (comparison.changes.resolvedPatterns.length > 0) {
    output.push(chalk.bold.green('✅ Resolved Patterns'));
    output.push('');
    for (const pattern of comparison.changes.resolvedPatterns) {
      output.push(
        `  ${severityIcon(pattern.severity)} ${pattern.name} (was ${pattern.frequency}x)`,
      );
    }
    output.push('');
  }

  // Changed patterns
  if (comparison.changes.changedPatterns.length > 0) {
    output.push(chalk.bold('📊 Changed Patterns'));
    output.push('');
    for (const change of comparison.changes.changedPatterns) {
      const freqChange =
        change.frequencyAfter !== undefined && change.frequencyBefore
          ? change.frequencyAfter - change.frequencyBefore
          : 0;
      const freqIndicator =
        freqChange > 0
          ? chalk.red(`+${freqChange}`)
          : freqChange < 0
            ? chalk.green(`${freqChange}`)
            : chalk.dim('±0');

      output.push(`  ${change.name}`);

      if (
        change.frequencyBefore !== undefined &&
        change.frequencyAfter !== undefined
      ) {
        output.push(
          `    Frequency: ${change.frequencyBefore} → ${change.frequencyAfter} (${freqIndicator})`,
        );
      }

      if (
        change.severityBefore !== undefined &&
        change.severityAfter !== undefined &&
        change.severityBefore !== change.severityAfter
      ) {
        output.push(
          `    Severity: ${change.severityBefore} → ${change.severityAfter}`,
        );
      }
    }
    output.push('');
  }

  // Summary
  if (
    comparison.changes.newPatterns.length === 0 &&
    comparison.changes.resolvedPatterns.length === 0 &&
    comparison.changes.changedPatterns.length === 0
  ) {
    output.push(chalk.green('✅ No pattern changes detected'));
    output.push('');
  }

  console.log(output.join('\n'));
}

/**
 * Formats a comparison result as Markdown.
 *
 * @param comparison - Comparison result
 * @returns Markdown string
 */
export function formatComparisonMarkdown(comparison: ComparisonResult): string {
  const lines: string[] = [];

  // Header
  lines.push('# Hyntx Comparison Report');
  lines.push('');
  lines.push(
    `**Comparison:** ${comparison.before.date} → ${comparison.after.date}`,
  );
  lines.push('');

  // Score change table
  lines.push('## Score Change');
  lines.push('');
  lines.push('| Metric | Before | After | Change |');
  lines.push('|--------|--------|-------|--------|');
  lines.push(
    `| Overall Score | ${comparison.before.stats.overallScore.toFixed(1)}/10 | ${comparison.after.stats.overallScore.toFixed(1)}/10 | ${comparison.changes.scoreDelta > 0 ? '+' : ''}${comparison.changes.scoreDelta.toFixed(1)} |`,
  );
  lines.push('');

  // New patterns
  if (comparison.changes.newPatterns.length > 0) {
    lines.push('## 🆕 New Patterns Detected');
    lines.push('');
    for (const pattern of comparison.changes.newPatterns) {
      lines.push(
        `- ${severityIconMarkdown(pattern.severity)} **${pattern.name}** (${pattern.frequency}x)`,
      );
    }
    lines.push('');
  }

  // Resolved patterns
  if (comparison.changes.resolvedPatterns.length > 0) {
    lines.push('## ✅ Resolved Patterns');
    lines.push('');
    for (const pattern of comparison.changes.resolvedPatterns) {
      lines.push(
        `- ${severityIconMarkdown(pattern.severity)} **${pattern.name}** (was ${pattern.frequency}x)`,
      );
    }
    lines.push('');
  }

  // Changed patterns
  if (comparison.changes.changedPatterns.length > 0) {
    lines.push('## 📊 Changed Patterns');
    lines.push('');
    for (const change of comparison.changes.changedPatterns) {
      lines.push(`### ${change.name}`);
      lines.push('');
      lines.push(
        `- **Frequency:** ${change.frequencyBefore} → ${change.frequencyAfter}`,
      );
      if (change.severityBefore !== change.severityAfter) {
        lines.push(
          `- **Severity:** ${change.severityBefore} → ${change.severityAfter}`,
        );
      }
      lines.push('');
    }
  }

  // Summary
  if (
    comparison.changes.newPatterns.length === 0 &&
    comparison.changes.resolvedPatterns.length === 0 &&
    comparison.changes.changedPatterns.length === 0
  ) {
    lines.push('## Summary');
    lines.push('');
    lines.push('✅ No pattern changes detected between these analyses.');
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push('');
  lines.push('*Generated by [Hyntx](https://github.com/hyntx/hyntx)*');

  return lines.join('\n');
}

/**
 * Formats a comparison result as JSON.
 *
 * @param comparison - Comparison result
 * @param compact - Whether to use compact JSON
 * @returns JSON string
 */
export function formatComparisonJson(
  comparison: ComparisonResult,
  compact = false,
): string {
  return compact
    ? JSON.stringify(comparison)
    : JSON.stringify(comparison, null, 2);
}

/**
 * Prints a list of history entries to the terminal.
 *
 * @param entries - Array of tuples containing date and history entry
 */
export function printHistoryList(
  entries: readonly [string, HistoryEntry][],
): void {
  if (entries.length === 0) {
    console.log('');
    console.log(chalk.yellow('No history entries found'));
    console.log('');
    return;
  }

  const output: string[] = [];

  output.push('');
  output.push(chalk.bold.cyan('Analysis History'));
  output.push('');

  const table = new Table({
    head: [
      chalk.bold('Date'),
      chalk.bold('Score'),
      chalk.bold('Patterns'),
      chalk.bold('Provider'),
      chalk.bold('Prompts'),
    ],
    colWidths: [15, 10, 12, 15, 12],
  });

  for (const [date, entry] of entries) {
    table.push([
      date,
      scoreColor(
        entry.result.stats.overallScore,
        `${entry.result.stats.overallScore.toFixed(1)}/10`,
      ),
      String(entry.result.patterns.length),
      entry.metadata.provider,
      String(entry.metadata.promptCount),
    ]);
  }

  output.push(table.toString());
  output.push('');

  console.log(output.join('\n'));
}

/**
 * Prints a summary of history entries to the terminal.
 *
 * @param entries - Array of tuples containing date and history entry
 */
export function printHistorySummary(
  entries: readonly [string, HistoryEntry][],
): void {
  if (entries.length === 0) {
    console.log('');
    console.log(chalk.yellow('No history entries found'));
    console.log('');
    return;
  }

  const output: string[] = [];

  output.push('');
  output.push(chalk.bold.cyan('History Summary'));
  output.push('');

  // Calculate statistics
  const totalEntries = entries.length;
  const scores = entries.map((e) => e[1].result.stats.overallScore);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  const providers = new Set(entries.map((e) => e[1].metadata.provider));
  const totalPrompts = entries.reduce(
    (sum, e) => sum + e[1].metadata.promptCount,
    0,
  );

  const table = new Table({
    head: [chalk.bold('Metric'), chalk.bold('Value')],
    colWidths: [30, 20],
  });

  table.push(
    ['Total Entries', String(totalEntries)],
    ['Average Score', scoreColor(avgScore, `${avgScore.toFixed(1)}/10`)],
    ['Min Score', scoreColor(minScore, `${minScore.toFixed(1)}/10`)],
    ['Max Score', scoreColor(maxScore, `${maxScore.toFixed(1)}/10`)],
    ['Providers Used', Array.from(providers).join(', ')],
    ['Total Prompts Analyzed', String(totalPrompts)],
  );

  output.push(table.toString());
  output.push('');

  console.log(output.join('\n'));
}
