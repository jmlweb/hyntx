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
