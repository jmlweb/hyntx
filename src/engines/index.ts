/**
 * Interpretation engines: the optional LLM step that confirms heuristic
 * episodes and phrases recommendations. Engines receive the sanitized
 * `Report` and return an `Interpretation`; returning null means "not
 * available", which is recorded as a data-quality note, never an error.
 */

import { reviewInsights } from '../core/insight-review.js';
import { sanitizeReport } from '../core/report.js';
import {
  type Interpretation,
  InterpretationEngine,
  type InterpretOptions,
  type Report,
} from '../types/index.js';
import { interpretWithClaude } from './claude.js';
import { interpretWithOllama } from './ollama.js';
import { EngineUnavailableError } from './shared.js';

export { InterpretationEngine, type InterpretOptions };

type EngineFn = (
  report: Report,
  options: InterpretOptions,
) => Promise<Interpretation | null>;

const ENGINES: Readonly<Record<InterpretationEngine, EngineFn>> = {
  [InterpretationEngine.CLAUDE]: interpretWithClaude,
  [InterpretationEngine.OLLAMA]: interpretWithOllama,
};

function withNote(report: Report, note: string): Report {
  return {
    ...report,
    dataQuality: {
      ...report.dataQuality,
      notes: [...report.dataQuality.notes, note],
    },
  };
}

export async function interpretReport(
  report: Report,
  options: InterpretOptions,
): Promise<Report> {
  try {
    const interpretation = await ENGINES[options.engine](report, options);
    if (!interpretation) {
      return withNote(
        report,
        'Nothing to interpret: no findings or flagged episodes in this period.',
      );
    }
    const sanitized = sanitizeReport({ ...report, interpretation });
    return {
      ...sanitized,
      insightReviews: reviewInsights(
        sanitized.insights,
        sanitized.interpretation,
      ),
    };
  } catch (error) {
    // The deterministic report stays valuable when the LLM step fails.
    const reason = error instanceof Error ? error.message : String(error);
    return withNote(
      report,
      error instanceof EngineUnavailableError
        ? `Interpretation skipped (${options.engine}): ${reason}`
        : `Interpretation with "${options.engine}" failed: ${reason}. Showing deterministic findings only; pass --no-llm to skip this step.`,
    );
  }
}
