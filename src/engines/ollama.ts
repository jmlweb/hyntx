/**
 * Ollama interpretation engine (opt-in, fully local): plain `fetch` against
 * the Ollama HTTP API with schema-constrained JSON output.
 */

import {
  type Interpretation,
  type InterpretOptions,
  type Report,
} from '../types/index.js';
import {
  buildUserPrompt,
  EngineOutputError,
  EngineUnavailableError,
  OLLAMA_BUDGET,
  parseJsonObject,
  RESPONSE_SCHEMA,
  selectEvidence,
  SYSTEM_PROMPT,
  validateAnswer,
} from './shared.js';

export const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b';
export const OLLAMA_TIMEOUT_MS = 240_000;
const DEFAULT_HOST = 'http://localhost:11434';
/** Ollama's default context (4096) would silently truncate the evidence. */
const CONTEXT_TOKENS = 8192;

export type FetchFn = typeof fetch;

export function resolveOllamaHost(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) {
    return DEFAULT_HOST;
  }
  const withScheme = /^https?:\/\//.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace(/\/+$/, '').replace('//0.0.0.0', '//localhost');
}

export async function interpretWithOllama(
  report: Report,
  options: InterpretOptions,
  fetchFn: FetchFn = fetch,
): Promise<Interpretation | null> {
  const evidence = selectEvidence(report, OLLAMA_BUDGET);
  if (evidence.episodes.length === 0 && evidence.insights.length === 0) {
    return null;
  }
  const host = resolveOllamaHost(process.env['OLLAMA_HOST']);
  const model = options.model ?? DEFAULT_OLLAMA_MODEL;
  const timeout = AbortSignal.timeout(OLLAMA_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;

  let response: Response;
  try {
    response = await fetchFn(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: RESPONSE_SCHEMA,
        options: { temperature: 0.1, num_ctx: CONTEXT_TOKENS },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(evidence) },
        ],
      }),
    });
  } catch (error) {
    if (timeout.aborted) {
      throw new EngineOutputError(
        `Ollama did not answer within ${String(OLLAMA_TIMEOUT_MS / 1000)}s`,
      );
    }
    if (options.signal?.aborted) {
      throw new EngineOutputError('interpretation was cancelled');
    }
    throw new EngineUnavailableError(
      `Ollama is not reachable at ${host} (${error instanceof Error ? error.message : 'network error'}). Start it with \`ollama serve\`, set OLLAMA_HOST, use --engine claude, or pass --no-llm.`,
    );
  }

  if (!response.ok) {
    const body = (await response.text().catch(() => '')).slice(0, 200);
    if (response.status === 404) {
      throw new EngineUnavailableError(
        `Ollama model "${model}" is not installed. Run \`ollama pull ${model}\`, pick another with --model, or pass --no-llm.`,
      );
    }
    throw new EngineOutputError(
      `Ollama returned HTTP ${String(response.status)}${body ? `: ${body}` : ''}`,
    );
  }

  const envelope: unknown = await response.json().catch(() => null);
  const content =
    typeof envelope === 'object' && envelope !== null
      ? (envelope as { message?: { content?: unknown } }).message?.content
      : undefined;
  if (typeof content !== 'string') {
    throw new EngineOutputError('Ollama returned no message content');
  }
  const answer = validateAnswer(parseJsonObject(content), evidence);
  return {
    engine: 'ollama',
    model,
    generatedAt: new Date().toISOString(),
    ...answer,
  };
}
