/**
 * Comparison Script: Batch vs Individual Analysis Modes
 *
 * This script compares the performance and quality of batch vs individual analysis modes
 * by running the same dataset through both modes and measuring:
 * - Time: Total ms and per-prompt ms for each mode
 * - Accuracy: Patterns detected, categories identified
 * - Quality: Suggestions generated, overall scores
 *
 * Prerequisites:
 *   - Ollama must be running (default: http://localhost:11434)
 *   - Model must be installed (default: llama3.2)
 *
 * Usage:
 *   # Install tsx globally or use npx
 *   npm install -g tsx
 *   tsx scripts/compare-batch-vs-individual.ts
 *
 *   # Or use npx
 *   npx tsx scripts/compare-batch-vs-individual.ts
 *
 *   # With custom configuration
 *   OLLAMA_MODEL=mistral:7b tsx scripts/compare-batch-vs-individual.ts
 *   OLLAMA_HOST=http://remote:11434 tsx scripts/compare-batch-vs-individual.ts
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import chalk from 'chalk';

import { analyzePrompts } from '../src/core/analyzer.js';
import { OllamaProvider } from '../src/providers/ollama.js';
import type {
  AnalysisResult,
  ClaudeMessage,
  OllamaConfig,
} from '../src/types/index.js';

// =============================================================================
// Constants
// =============================================================================

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const FIXTURE_PATH = join(
  fileURLToPath(new URL('.', import.meta.url)),
  '../tests/fixtures/sample-logs.jsonl',
);

// =============================================================================
// Types
// =============================================================================

type ComparisonResult = {
  readonly mode: 'batch' | 'individual';
  readonly totalTimeMs: number;
  readonly avgTimePerPromptMs: number;
  readonly patternsDetected: number;
  readonly categoriesDetected: number;
  readonly overallScore: number;
  readonly result: AnalysisResult;
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Loads test prompts from JSONL fixture file.
 *
 * @returns Array of prompt strings
 */
function loadTestPrompts(): readonly string[] {
  const content = readFileSync(FIXTURE_PATH, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  const prompts: string[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as ClaudeMessage;
      if (entry.type === 'user' && entry.message.content) {
        prompts.push(entry.message.content);
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return prompts;
}

/**
 * Runs analysis in a specific mode and measures performance.
 *
 * @param mode - Analysis mode ('batch' or 'individual')
 * @param prompts - Array of prompts to analyze
 * @returns Comparison result with timing and quality metrics
 */
async function runAnalysis(
  mode: 'batch' | 'individual',
  prompts: readonly string[],
): Promise<ComparisonResult> {
  const config: OllamaConfig = {
    host: OLLAMA_HOST,
    model: OLLAMA_MODEL,
    schemaOverride: mode,
  };

  const provider = new OllamaProvider(config);

  // Check if provider is available
  const isAvailable = await provider.isAvailable();
  if (!isAvailable) {
    throw new Error(
      `Ollama is not available at ${OLLAMA_HOST}. Make sure Ollama is running and model ${OLLAMA_MODEL} is installed.`,
    );
  }

  const startTime = performance.now();

  const result = await analyzePrompts({
    provider,
    prompts,
    date: '2025-01-20',
    noCache: true, // Force fresh analysis for fair comparison
  });

  const endTime = performance.now();
  const totalTimeMs = Math.round(endTime - startTime);
  const avgTimePerPromptMs = Math.round(totalTimeMs / prompts.length);

  // Extract quality metrics
  const patternsDetected = result.patterns.length;
  const categoriesDetected = new Set(result.patterns.map((p) => p.name)).size;
  const overallScore = result.stats.overallScore;

  return {
    mode,
    totalTimeMs,
    avgTimePerPromptMs,
    patternsDetected,
    categoriesDetected,
    overallScore,
    result,
  };
}

/**
 * Prints comparison table showing both modes side by side.
 *
 * @param batchResult - Results from batch mode
 * @param individualResult - Results from individual mode
 */
function printComparison(
  batchResult: ComparisonResult,
  individualResult: ComparisonResult,
): void {
  console.log('');
  console.log(chalk.bold.cyan('='.repeat(80)));
  console.log(chalk.bold.cyan('BATCH VS INDIVIDUAL MODE COMPARISON'));
  console.log(chalk.bold.cyan('='.repeat(80)));
  console.log('');

  // Batch mode results
  console.log(chalk.bold.yellow('BATCH MODE'));
  console.log(chalk.dim(`  Model: ${OLLAMA_MODEL}`));
  console.log(`  Time: ${batchResult.totalTimeMs}ms total`);
  console.log(`  Per-prompt: ${batchResult.avgTimePerPromptMs}ms average`);
  console.log(`  Patterns: ${batchResult.patternsDetected} detected`);
  console.log(`  Categories: ${batchResult.categoriesDetected} unique`);
  console.log(`  Score: ${batchResult.overallScore}/10`);
  console.log('');

  // Individual mode results
  console.log(chalk.bold.yellow('INDIVIDUAL MODE'));
  console.log(chalk.dim(`  Model: ${OLLAMA_MODEL}`));
  console.log(`  Time: ${individualResult.totalTimeMs}ms total`);
  console.log(`  Per-prompt: ${individualResult.avgTimePerPromptMs}ms average`);
  console.log(`  Patterns: ${individualResult.patternsDetected} detected`);
  console.log(`  Categories: ${individualResult.categoriesDetected} unique`);
  console.log(`  Score: ${individualResult.overallScore}/10`);
  console.log('');

  // Comparison metrics
  console.log(chalk.bold.yellow('COMPARISON'));

  const speedup = (
    individualResult.avgTimePerPromptMs / batchResult.avgTimePerPromptMs
  ).toFixed(2);
  const speedupColor = Number.parseFloat(speedup) > 1 ? chalk.green : chalk.red;
  console.log(
    `  Speedup: ${speedupColor(`${speedup}x`)} ${speedupColor('(batch mode faster)')}`,
  );

  const patternDiff =
    individualResult.patternsDetected - batchResult.patternsDetected;
  const patternDiffColor = patternDiff > 0 ? chalk.green : chalk.yellow;
  const patternSign = patternDiff > 0 ? '+' : '';
  console.log(
    `  Patterns: ${patternDiffColor(`${patternSign}${patternDiff}`)} (individual mode)`,
  );

  const categoryDiff =
    individualResult.categoriesDetected - batchResult.categoriesDetected;
  const categoryDiffColor = categoryDiff > 0 ? chalk.green : chalk.yellow;
  const categorySign = categoryDiff > 0 ? '+' : '';
  console.log(
    `  Categories: ${categoryDiffColor(`${categorySign}${categoryDiff}`)} (individual mode)`,
  );

  const scoreDiff = individualResult.overallScore - batchResult.overallScore;
  const scoreDiffColor =
    scoreDiff > 0 ? chalk.green : scoreDiff < 0 ? chalk.red : chalk.yellow;
  const scoreSign = scoreDiff > 0 ? '+' : '';
  console.log(
    `  Score: ${scoreDiffColor(`${scoreSign}${scoreDiff}`)} (individual mode)`,
  );
  console.log('');

  // Recommendation
  console.log(chalk.bold.yellow('RECOMMENDATION'));

  if (Number.parseFloat(speedup) > 3 && categoryDiff <= 1) {
    console.log(
      chalk.green(
        '  Use batch mode for daily analysis (much faster, similar quality)',
      ),
    );
    console.log(
      chalk.dim(
        '  Use individual mode when deep analysis is needed or for learning',
      ),
    );
  } else if (categoryDiff >= 2 || patternDiff >= 3) {
    console.log(
      chalk.green(
        '  Use individual mode for important prompts (better categorization)',
      ),
    );
    console.log(
      chalk.dim('  Use batch mode for quick daily check-ins to save time'),
    );
  } else {
    console.log(
      chalk.green(
        '  Both modes provide similar quality - choose based on speed needs',
      ),
    );
    console.log(
      chalk.dim(`  Batch: ${batchResult.avgTimePerPromptMs}ms/prompt`),
    );
    console.log(
      chalk.dim(
        `  Individual: ${individualResult.avgTimePerPromptMs}ms/prompt`,
      ),
    );
  }

  console.log('');
  console.log(chalk.bold.cyan('='.repeat(80)));
  console.log('');
}

/**
 * Prints pattern details for both modes.
 *
 * @param batchResult - Results from batch mode
 * @param individualResult - Results from individual mode
 */
function printPatternDetails(
  batchResult: ComparisonResult,
  individualResult: ComparisonResult,
): void {
  console.log(chalk.bold.cyan('PATTERN DETAILS'));
  console.log('');

  // Batch patterns
  console.log(chalk.bold('Batch Mode Patterns:'));
  if (batchResult.result.patterns.length === 0) {
    console.log(chalk.dim('  No patterns detected'));
  } else {
    for (const pattern of batchResult.result.patterns.slice(0, 5)) {
      console.log(
        `  - ${pattern.name} (${pattern.severity}): ${pattern.frequency} occurrence(s)`,
      );
    }
  }
  console.log('');

  // Individual patterns
  console.log(chalk.bold('Individual Mode Patterns:'));
  if (individualResult.result.patterns.length === 0) {
    console.log(chalk.dim('  No patterns detected'));
  } else {
    for (const pattern of individualResult.result.patterns.slice(0, 5)) {
      console.log(
        `  - ${pattern.name} (${pattern.severity}): ${pattern.frequency} occurrence(s)`,
      );
    }
  }
  console.log('');
}

// =============================================================================
// Main Function
// =============================================================================

async function main(): Promise<void> {
  console.log('');
  console.log(chalk.bold.cyan('Batch vs Individual Mode Comparison'));
  console.log(chalk.dim(`Using Ollama at ${OLLAMA_HOST}`));
  console.log(chalk.dim(`Model: ${OLLAMA_MODEL}`));
  console.log('');

  // Load test prompts
  console.log(chalk.dim('Loading test prompts...'));
  const prompts = loadTestPrompts();
  console.log(chalk.green(`Loaded ${prompts.length} prompts from fixtures`));
  console.log('');

  // Run batch mode analysis
  console.log(chalk.dim('Running batch mode analysis...'));
  const batchResult = await runAnalysis('batch', prompts);
  console.log(
    chalk.green(
      `Batch mode complete in ${batchResult.totalTimeMs}ms (${batchResult.avgTimePerPromptMs}ms/prompt)`,
    ),
  );
  console.log('');

  // Run individual mode analysis
  console.log(chalk.dim('Running individual mode analysis...'));
  const individualResult = await runAnalysis('individual', prompts);
  console.log(
    chalk.green(
      `Individual mode complete in ${individualResult.totalTimeMs}ms (${individualResult.avgTimePerPromptMs}ms/prompt)`,
    ),
  );
  console.log('');

  // Print comparison
  printComparison(batchResult, individualResult);

  // Print pattern details
  printPatternDetails(batchResult, individualResult);

  console.log(chalk.dim('Comparison complete!'));
  console.log('');
}

// =============================================================================
// Entry Point
// =============================================================================

main().catch((error) => {
  console.error(chalk.red('Error:'), error.message);
  process.exit(1);
});
