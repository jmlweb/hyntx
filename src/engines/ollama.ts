/**
 * Ollama interpretation engine (local, privacy-first). Phase 2 fills this in.
 */

import {
  type Interpretation,
  type InterpretOptions,
  type Report,
} from '../types/index.js';

export function interpretWithOllama(
  _report: Report,
  _options: InterpretOptions,
): Promise<Interpretation | null> {
  return Promise.resolve(null);
}
