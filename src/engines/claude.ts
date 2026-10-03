/**
 * Claude interpretation engine (default). Phase 2 shells out to `claude -p`.
 */

import {
  type Interpretation,
  type InterpretOptions,
  type Report,
} from '../types/index.js';

export function interpretWithClaude(
  _report: Report,
  _options: InterpretOptions,
): Promise<Interpretation | null> {
  return Promise.resolve(null);
}
