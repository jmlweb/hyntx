/**
 * Quick test to verify examples are shown in full
 */

import { describe, it } from 'vitest';
import { printReport } from './src/core/reporter.js';
import type { AnalysisResult } from './src/types/index.js';

describe('Example output verification', () => {
  it('should show full example text in output', () => {
    const longExample =
      'Explore the hyntx codebase to understand: 1. How the CLI argument parsing is implemented, 2. What the main entry point functions are, 3. How the analysis results are formatted and displayed to users, 4. What configuration options are available, and 5. How the provider system works with different AI models.';

    const result: AnalysisResult = {
      date: '2025-01-15',
      patterns: [
        {
          id: 'missing-context',
          name: 'Missing Context',
          frequency: 1,
          severity: 'high',
          examples: [
            longExample,
            'Explore this codebase to understand the documentation structure. Find: 1. All markdown files, 2. How they are organized, 3. What the main documentation entry points are, and 4. How documentation is linked together.',
          ],
          suggestion:
            'Provide relevant background information - include file paths, function names, error messages, or code snippets',
          beforeAfter: {
            before: 'Explore the codebase',
            after: 'Explore the codebase starting with src/core/analyzer.ts',
          },
        },
      ],
      stats: {
        totalPrompts: 10,
        promptsWithIssues: 3,
        overallScore: 7,
      },
      topSuggestion: 'Add more context to your prompts',
    };

    // Capture console output
    const originalLog = console.log;
    let output = '';
    console.log = (...args: unknown[]) => {
      output += args.join(' ') + '\n';
    };

    try {
      printReport(result);
      // Verify the full example is in the output
      expect(output).toContain('How the CLI argument parsing is implemented');
      expect(output).toContain(
        'How the provider system works with different AI models',
      );
      expect(output).toContain('All markdown files');
      expect(output).toContain('How documentation is linked together');
      // Should NOT contain truncated version
      expect(output).not.toContain(
        'Explore the hyntx codebase to understand: 1. How the CLI argument parsing is...',
      );
    } finally {
      console.log = originalLog;
    }
  });
});
